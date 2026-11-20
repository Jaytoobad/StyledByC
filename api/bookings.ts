/**
 * StyledByC — booking submission backend.
 *
 * POST /api/bookings accepts a booking request, validates it server-side
 * (service, date/time, contact details, questionnaire for checklist
 * services, policy acceptance, photos), writes a pending_approval booking
 * to Neon, stores photos inline in Neon Postgres (bytea) and records
 * photo references in booking_photos.
 *
 * The price is always read from the shared services config — it is never
 * trusted from the browser. No Google Apps Script is involved in this flow.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { and, eq, gte, lt, or } from 'drizzle-orm';
import { hasBookingAbuse } from './_lib/abuse.js';
import { validateBookingInput } from './_lib/validation.js';
import { checkRateLimit } from './_lib/rate-limit.js';
import { isWhatsAppOnlyService, services as configServices } from '../src/config.js';
import { sendSms } from './_lib/sms.js';
import * as templates from '../src/lib/sms-templates.js';
import { env } from './_lib/env.js';
import { db } from '../src/db/index.js';
import { services as servicesTable } from '../src/db/schema.js';
import {
  MAX_PHOTOS,
  MIN_PHOTOS,
  PAYMENT_WINDOW_MINUTES,
  POLICY_VERSION,
} from '../src/config/booking.js';
import { validateBrowQuestionnaire } from './_lib/questionnaire-validation.js';
import { bookings, bookingPhotos, availability } from '../src/db/schema.js';
import { availabilityCoversBooking } from '../src/lib/booking-slots.js';

const MAX_BODY_BYTES = 4 * 1024 * 1024;
const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png'];
const REF_PREFIX = 'STC-';
const REF_RETRIES = 3;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// --- Basic rate limiting per IP (fixed window, Postgres-backed) ----------
function clientIp(req: IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for'];
  if (isString(fwd)) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

async function isRateLimited(ip: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const result = await checkRateLimit(`ip:${ip}:bookings`, 60, { windowMs: 60 * 1000 });
  return { allowed: result.allowed, retryAfter: result.retryAfter };
}

// --- Small helpers --------------------------------------------------------
function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function randomRef(): string {
  const bytes = randomBytes(8);
  return REF_PREFIX + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

type BookingInput = {
  serviceId?: unknown;
  date?: unknown;
  time?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  note?: unknown;
  questionnaire?: unknown;
  policyAccepted?: unknown;
  photos?: unknown;
};

type PhotoInput = { name: string; mimeType: string; dataBase64: string };
type BookingService = Pick<
  (typeof configServices)[number],
  'id' | 'name' | 'price' | 'photoRequired' | 'tintGuideRequired'
>;

function validatePhotos(
  v: unknown,
  required: boolean,
): { ok: true; photos: PhotoInput[] } | { ok: false; error: string } {
  if (v === undefined || v === null || (Array.isArray(v) && v.length === 0)) {
    return required
      ? { ok: false, error: `Please upload ${MIN_PHOTOS}-${MAX_PHOTOS} photos.` }
      : { ok: true, photos: [] };
  }
  if (!Array.isArray(v) || v.length < MIN_PHOTOS || v.length > MAX_PHOTOS) {
    return { ok: false, error: `Please upload ${MIN_PHOTOS}-${MAX_PHOTOS} photos.` };
  }
  const photos: PhotoInput[] = [];
  for (const p of v) {
    if (!isPlainObject(p)) return { ok: false, error: 'Invalid photo.' };
    if (!isString(p.name) || !p.name.trim()) return { ok: false, error: 'Invalid photo name.' };
    if (!isString(p.mimeType) || !ALLOWED_PHOTO_TYPES.includes(p.mimeType))
      return { ok: false, error: 'Photos must be JPEG or PNG.' };
    if (!isString(p.dataBase64) || !p.dataBase64.length)
      return { ok: false, error: 'Invalid photo data.' };
    const cleaned = p.dataBase64.replace(/\s+/g, '');
    let bytes: Buffer;
    try {
      bytes = Buffer.from(cleaned, 'base64');
    } catch {
      return { ok: false, error: 'Invalid photo data.' };
    }
    if (bytes.toString('base64') !== cleaned) return { ok: false, error: 'Invalid photo data.' };
    if (bytes.length > MAX_PHOTO_BYTES)
      return { ok: false, error: 'Each photo must be under 1.5 MB.' };
    photos.push({
      name: p.name.replace(/[^a-zA-Z0-9._-]/g, '_'),
      mimeType: String(p.mimeType),
      dataBase64: cleaned,
    });
  }
  return { ok: true, photos };
}

function validateInput(
  input: unknown,
  serviceCatalog: BookingService[],
):
  | { ok: true; data: BookingInput & { photos: PhotoInput[]; questionnaire: unknown } }
  | { ok: false; errors: string[] } {
  // Use shared validation for common fields (date, time, name, email, phone, note, ref, policy).
  const basic = validateBookingInput(input);
  if (basic.ok === false) return { ok: false, errors: basic.errors };
  const b = basic.data as Record<string, unknown>;
  const errors: string[] = [];

  const serviceId = String(b.serviceId || '').trim();
  const service = serviceCatalog.find((s) => s.id === serviceId);
  if (isString(b.serviceId) && isWhatsAppOnlyService(serviceId)) {
    return {
      ok: false,
      errors: [
        'This service can only be booked through WhatsApp. Please contact the studio directly.',
      ],
    };
  }
  if (!service) errors.push('Please choose a valid service.');

  const q = validateBrowQuestionnaire(b.questionnaire, !!service);
  if (q.ok === false) return { ok: false, errors: [q.error] };

  const photos = validatePhotos(b.photos, !!service);
  if (photos.ok === false) errors.push(photos.error);

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    data: {
      ...b,
      serviceId,
      photos: photos.ok ? photos.photos : [],
      questionnaire: q.value,
    },
  };
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; message?: unknown };
  return e.code === '23505' && /(ref|pay_token)/i.test(String(e.message ?? ''));
}

// --- Handler --------------------------------------------------------------
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
  }

  const rl = await isRateLimited(clientIp(req));
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter || 60));
    return sendJson(res, 429, { ok: false, error: 'Too many requests. Please try again later.' });
  }

  const contentLength = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return sendJson(res, 413, { ok: false, error: 'Request is too large. Please try again.' });
  }

  let input: unknown;
  try {
    const raw = await readBody(req);
    if (!raw)
      return sendJson(res, 400, {
        ok: false,
        error: 'The request body is empty. Please try again.',
      });
    input = JSON.parse(raw);
  } catch {
    return sendJson(res, 400, {
      ok: false,
      error: 'The request body could not be read. Please try again.',
    });
  }

  let serviceCatalog: BookingService[];
  try {
    const rows = await db.select().from(servicesTable);
    if (rows.length === 0) {
      if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
        console.error('[bookings] production catalogue is empty');
        return sendJson(res, 503, {
          ok: false,
          error: 'Services are not configured yet. Please contact the studio.',
        });
      }
      console.warn('[bookings] services table is empty; using configured fallback prices');
      serviceCatalog = configServices;
    } else {
      serviceCatalog = rows
        .filter(
          (service) => service.active && String(service.category).trim().toLowerCase() === 'brows',
        )
        .map((service) => ({
          id: service.id,
          name: service.name,
          price: service.price,
          photoRequired: service.photoRequired,
          tintGuideRequired: service.tintGuideRequired,
        }));
    }
  } catch (e) {
    console.error('[bookings] failed to load service prices:', e);
    return sendJson(res, 500, {
      ok: false,
      error: 'Could not verify service pricing. Please try again later.',
    });
  }

  const validation = validateInput(input, serviceCatalog);
  if (validation.ok === false)
    return sendJson(res, 400, { ok: false, error: validation.errors.join(' ') });
  const { serviceId, date, time, name, email, phone, photos, questionnaire } = validation.data as {
    serviceId: unknown;
    date: string;
    time: string;
    name: string;
    email: string;
    phone: string;
    photos: PhotoInput[];
    questionnaire: unknown;
  };
  const service = serviceCatalog.find((s) => s.id === serviceId);
  if (!service) {
    if (serviceCatalog !== configServices) {
      console.error('[bookings] service id missing from populated services table');
    }
    return sendJson(res, 400, {
      ok: false,
      error: 'That service is no longer available. Please choose another service.',
    });
  }

  const abuse = await hasBookingAbuse(phone, email);
  if (abuse) {
    return sendJson(res, 429, {
      ok: false,
      error: 'You already have pending bookings. Please wait for a response or contact us.',
    });
  }

  // --- Re-check slot availability server-side -----------------------------
  const startOfDay = new Date(`${date}T00:00:00Z`);
  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

  const openSlots = await db
    .select()
    .from(availability)
    .where(
      and(
        gte(availability.date, startOfDay),
        lt(availability.date, endOfDay),
        eq(availability.isOpen, true),
      ),
    );
  if (!availabilityCoversBooking(time, openSlots)) {
    return sendJson(res, 409, { ok: false, error: 'That slot is not available.' });
  }

  const { expireIfNeeded } = await import('../src/lib/expire.js');
  const holdCandidates = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        gte(bookings.approvedSlotDate, startOfDay),
        lt(bookings.approvedSlotDate, endOfDay),
        eq(bookings.approvedSlotTime, time),
        eq(bookings.status, 'approved_awaiting_payment'),
      ),
    );
  for (const candidate of holdCandidates) {
    await expireIfNeeded(candidate.id);
  }

  const taken = await db
    .select()
    .from(bookings)
    .where(
      and(
        gte(bookings.requestedDate, startOfDay),
        lt(bookings.requestedDate, endOfDay),
        eq(bookings.requestedTime, time),
        or(
          eq(bookings.status, 'confirmed'),
          eq(bookings.status, 'approved_awaiting_payment'),
          eq(bookings.status, 'paid_needs_attention'),
          eq(bookings.status, 'pending_approval'),
        ),
      ),
    )
    .limit(1);
  if (taken.length) {
    return sendJson(res, 409, {
      ok: false,
      error: 'That slot has just been booked. Please choose another time.',
    });
  }

  // --- Create the booking -------------------------------------------------
  let booking: { id: string; ref: string } | null = null;
  for (let attempt = 0; attempt < REF_RETRIES; attempt++) {
    const ref = randomRef();
    const payToken = randomUUID();
    const now = new Date();
    const paymentDeadline = new Date(now.getTime() + PAYMENT_WINDOW_MINUTES * 60 * 1000);
    try {
      const rows = await db
        .insert(bookings)
        .values({
          ref,
          status: 'pending_approval',
          name: String(name).trim(),
          email: String(email).trim(),
          phone: String(phone).trim(),
          serviceId: String(serviceId),
          serviceName: service.name,
          servicePriceGhs: service.price,
          requestedDate: new Date(`${date}T${time}:00Z`),
          requestedTime: time,
          questionnaire,
          policyAccepted: true,
          policyVersion: POLICY_VERSION,
          policyAcceptedAt: now,
          paymentDeadline,
          payToken,
        })
        .returning({ id: bookings.id, ref: bookings.ref });
      booking = rows[0];
      break;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  if (!booking) {
    return sendJson(res, 500, {
      ok: false,
      error: 'Could not create the booking. Please try again.',
    });
  }

  // --- Store photos inline in Neon Postgres (bytea) -------------------------
  let photoRowsFailed = false;
  try {
    const photoValues = photos.map((p, i) => ({
      bookingId: booking.id,
      position: i,
      mimeType: p.mimeType,
      photoData: Buffer.from(p.dataBase64, 'base64'),
    }));
    if (photoValues.length) {
      await db.insert(bookingPhotos).values(photoValues);
    }
  } catch (e) {
    photoRowsFailed = true;
    const errMsg = e instanceof Error ? e.message : String(e);
    const errCause = e instanceof Error && e.cause ? String(e.cause) : '';
    console.error('[bookings] photo insert failed:', {
      bookingRef: booking.ref,
      photoCount: photos.length,
      error: errMsg,
      cause: errCause,
      stack: e instanceof Error ? e.stack : undefined,
    });
  }

  if (photoRowsFailed) {
    try {
      await db.delete(bookingPhotos).where(eq(bookingPhotos.bookingId, booking.id));
    } catch {
      // best-effort cleanup
    }
    try {
      await db.delete(bookings).where(eq(bookings.id, booking.id));
    } catch {
      // best-effort cleanup
    }
    try {
      await sendSms(
        env.OWNER_PHONE,
        `Photo storage failed for booking ${booking.ref}; booking rolled back.`,
      );
    } catch (e) {
      console.error('[bookings] photo issue owner SMS failed:', e);
    }
    return sendJson(res, 500, {
      ok: false,
      error: 'Could not save your photos. Please try again.',
    });
  }

  let ownerNotificationStatus: 'sent' | 'stubbed' | 'failed' | 'unknown' = 'unknown';
  try {
    const result = await sendSms(
      env.OWNER_PHONE,
      templates.newRequestOwner({
        ref: booking.ref,
        name: String(name),
        service: service.name,
        date,
        time,
      }),
      { bookingId: booking.id, event: 'new_request_owner' },
    );
    ownerNotificationStatus = result.status;
  } catch (e) {
    ownerNotificationStatus = 'failed';
    console.error('[bookings] owner notification failed:', e);
  }

  let customerNotificationStatus: 'sent' | 'stubbed' | 'failed' | 'unknown' = 'unknown';
  try {
    const customerResult = await sendSms(
      String(phone).trim(),
      templates.requestReceived({
        ref: booking.ref,
        firstName: templates.firstName(String(name).trim()),
        service: service.name,
      }),
      { bookingId: booking.id, event: 'request_received_customer' },
    );
    customerNotificationStatus = customerResult.status;
  } catch (e) {
    customerNotificationStatus = 'failed';
    console.error('[bookings] customer notification failed:', e);
  }

  return sendJson(res, 200, {
    ok: true,
    booking: {
      ref: booking.ref,
      status: 'pending_approval',
      price: service.price,
      service: service.name,
    },
    ownerNotificationStatus,
    customerNotificationStatus,
  });
}
