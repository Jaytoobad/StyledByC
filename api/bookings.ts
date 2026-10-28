/**
 * StyledByC — booking submission backend.
 *
 * POST /api/bookings accepts a booking request, validates it server-side
 * (service, date/time, contact details, questionnaire for checklist
 * services, policy acceptance, photos), writes a pending_approval booking
 * to Neon, uploads photos to Vercel Blob (private, unguessable pathnames)
 * and records photo references in booking_photos.
 *
 * The price is always read from the shared services config — it is never
 * trusted from the browser. No Google Apps Script is involved in this flow.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { put } from '@vercel/blob';
import { and, eq, gte, lt, or } from 'drizzle-orm';
import { services } from '../src/config.js';
import { CHECKLIST_SERVICES, MAX_PHOTOS, MIN_PHOTOS, PAYMENT_WINDOW_MINUTES, POLICY_VERSION } from '../src/config/booking.js';
import { db } from '../src/db/index.js';
import { bookings, bookingPhotos, availability } from '../src/db/schema.js';

const MAX_BODY_BYTES = 4 * 1024 * 1024;
const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png'];
const REF_PREFIX = 'STC-';
const REF_RETRIES = 3;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// --- Basic rate limiting per IP (fixed window) ---------------------------
type RateEntry = { count: number; resetAt: number };
const rateLimit = new Map<string, RateEntry>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function clientIp(req: IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for'];
  if (isString(fwd)) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count += 1;
  return false;
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

function looksLikeDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !Number.isNaN(new Date(s + 'T00:00:00').getTime());
}

function looksLikeTime(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

function isNotPastDate(s: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(s + 'T00:00:00');
  d.setHours(0, 0, 0, 0);
  return d.getTime() >= today.getTime();
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

function validatePhotos(v: unknown): { ok: true; photos: PhotoInput[] } | { ok: false; error: string } {
  if (!Array.isArray(v) || v.length < MIN_PHOTOS || v.length > MAX_PHOTOS) {
    return { ok: false, error: `Please upload ${MIN_PHOTOS}-${MAX_PHOTOS} photos.` };
  }
  const photos: PhotoInput[] = [];
  for (const p of v) {
    if (!isPlainObject(p)) return { ok: false, error: 'Invalid photo.' };
    if (!isString(p.name) || !p.name.trim()) return { ok: false, error: 'Invalid photo name.' };
    if (!isString(p.mimeType) || !ALLOWED_PHOTO_TYPES.includes(p.mimeType)) return { ok: false, error: 'Photos must be JPEG or PNG.' };
    if (!isString(p.dataBase64) || !p.dataBase64.length) return { ok: false, error: 'Invalid photo data.' };
    const cleaned = p.dataBase64.replace(/\s+/g, '');
    let bytes: Buffer;
    try {
      bytes = Buffer.from(cleaned, 'base64');
    } catch {
      return { ok: false, error: 'Invalid photo data.' };
    }
    if (bytes.toString('base64') !== cleaned) return { ok: false, error: 'Invalid photo data.' };
    if (bytes.length > MAX_PHOTO_BYTES) return { ok: false, error: 'Each photo must be under 1.5 MB.' };
    photos.push({ name: p.name.replace(/[^a-zA-Z0-9._-]/g, '_'), mimeType: String(p.mimeType), dataBase64: cleaned });
  }
  return { ok: true, photos };
}

function validateQuestionnaire(v: unknown, required: boolean): { ok: true; value: unknown } | { ok: false; error: string } {
  if (v === undefined || v === null || v === '') {
    return required ? { ok: false, error: 'Please answer all questionnaire questions.' } : { ok: true, value: null };
  }
  if (!isString(v)) return { ok: false, error: 'Invalid questionnaire.' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(v);
  } catch {
    return { ok: false, error: 'Invalid questionnaire.' };
  }
  if (!isPlainObject(parsed) || !Array.isArray(parsed.items)) return { ok: false, error: 'Invalid questionnaire.' };
  for (const item of parsed.items) {
    if (!isPlainObject(item) || (item.answer !== 'yes' && item.answer !== 'no')) {
      return { ok: false, error: 'Please answer all questionnaire questions.' };
    }
  }
  return { ok: true, value: parsed };
}

function validateInput(input: unknown): { ok: true; data: BookingInput & { photos: PhotoInput[]; questionnaire: unknown } } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!isPlainObject(input)) return { ok: false, errors: ['The request body is invalid.'] };
  const b = input as BookingInput;

  const service = services.find((s) => s.id === b.serviceId);
  if (!service) errors.push('Please choose a valid service.');
  if (!isString(b.date) || !looksLikeDate(b.date) || !isNotPastDate(b.date))
    errors.push('Please choose a valid appointment date.');
  if (!isString(b.time) || !looksLikeTime(b.time)) errors.push('Please choose a valid appointment time.');
  if (!isString(b.name) || !b.name.trim()) errors.push('Please enter your full name.');
  if (!isString(b.email) || !/^\S+@\S+\.\S+$/.test(b.email)) errors.push('Please enter a valid email address.');
  if (!isString(b.phone) || b.phone.trim().length < 7) errors.push('Please enter a valid phone number.');
  if (service && CHECKLIST_SERVICES.includes(service.name) && (!isString(b.questionnaire) || !b.questionnaire.trim())) {
    errors.push('Please answer all questionnaire questions.');
  }
  if (!isString(b.questionnaire) && b.questionnaire !== undefined && b.questionnaire !== '') {
    errors.push('Invalid questionnaire.');
  }
  if (b.policyAccepted !== true) errors.push('Please accept the policies to continue.');
  const photos = validatePhotos(b.photos);
  if (!photos.ok) errors.push(photos.error);

  if (errors.length) return { ok: false, errors };
  const qRequired = !!service && CHECKLIST_SERVICES.includes(service.name);
  const q = validateQuestionnaire(b.questionnaire, qRequired);
  if (!q.ok) return { ok: false, errors: [q.error] };
  return { ok: true, data: { ...b, photos: photos.ok ? photos.photos : [], questionnaire: q.value } };
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

  if (isRateLimited(clientIp(req))) {
    return sendJson(res, 429, { ok: false, error: 'Too many requests. Please try again later.' });
  }

  const contentLength = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return sendJson(res, 413, { ok: false, error: 'Request is too large. Please try again.' });
  }

  let input: unknown;
  try {
    const raw = await readBody(req);
    if (!raw) return sendJson(res, 400, { ok: false, error: 'The request body is empty. Please try again.' });
    input = JSON.parse(raw);
  } catch {
    return sendJson(res, 400, { ok: false, error: 'The request body could not be read. Please try again.' });
  }

  const validation = validateInput(input);
  if (!validation.ok) return sendJson(res, 400, { ok: false, error: validation.errors.join(' ') });
  const { serviceId, date, time, name, email, phone, photos, questionnaire } = validation.data as { serviceId: unknown; date: string; time: string; name: string; email: string; phone: string; photos: PhotoInput[]; questionnaire: unknown; };
  const service = services.find((s) => s.id === serviceId)!;

  // --- Re-check slot availability server-side -----------------------------
  const startOfDay = new Date(`${date}T00:00:00`);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const openSlot = await db
    .select()
    .from(availability)
    .where(and(gte(availability.date, startOfDay), lt(availability.date, endOfDay), eq(availability.startTime, time), eq(availability.isOpen, true)))
    .limit(1);
  if (!openSlot.length) {
    return sendJson(res, 409, { ok: false, error: 'That slot is not available.' });
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
          eq(bookings.status, 'pending_approval'),
        ),
      ),
    )
    .limit(1);
  if (taken.length) {
    return sendJson(res, 409, { ok: false, error: 'That slot has just been booked. Please choose another time.' });
  }

  // --- Create the booking -------------------------------------------------
  let booking: { id: string; ref: string } | null = null;
  let lastErr: unknown = null;
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
          requestedDate: new Date(`${date}T${time}:00`),
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
      lastErr = err;
      if (!isUniqueViolation(err)) throw err;
    }
  }
  if (!booking) {
    return sendJson(res, 500, { ok: false, error: 'Could not create the booking. Please try again.' });
  }

  // --- Upload photos to Vercel Blob (private, unguessable paths) ----------
  let photosFailed = false;
  const saved: Array<{ bookingId: string; position: number; blobUrl: string; mimeType: string }> = [];
  for (let i = 0; i < photos.length; i++) {
    try {
      const { url } = await put(
        `bookings/${booking.ref}/${randomUUID()}-${photos[i].name}`,
        Buffer.from(photos[i].dataBase64, 'base64'),
        { access: 'private', addRandomSuffix: true, contentType: photos[i].mimeType },
      );
      saved.push({ bookingId: booking.id, position: i, blobUrl: url, mimeType: photos[i].mimeType });
    } catch {
      photosFailed = true;
    }
  }
  if (saved.length) {
    await db.insert(bookingPhotos).values(saved);
  }

  if (photosFailed) {
    await db
      .update(bookings)
      .set({ ownerNote: 'Photos failed - ask customer to resend', updatedAt: new Date() })
      .where(eq(bookings.id, booking.id));
  }

  return sendJson(res, 200, {
    ok: true,
    booking: { ref: booking.ref, status: 'pending_approval' },
    photosFailed,
    message: photosFailed ? 'Request received. We could not save your photos — please resend them.' : undefined,
  });
}




