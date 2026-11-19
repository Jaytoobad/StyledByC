/**
 * StyledByC - Pay page lookup and payment verification dispatcher.
 *
 * Single entry point for:
 *   GET  /api/pay?ref=:ref   -> pay page lookup (authenticated by one-time pay token)
 *   POST /api/pay?action=verify -> server-side Paystack verification
 *
 * Replaces pay/index.ts and pay/verify.ts serverless functions.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { bookings } from '../src/db/schema.js';
import { verifyPaystack } from '../src/lib/paystack-verify.js';
import { confirmPayment } from '../src/lib/confirm-payment.js';
import { sendSms } from './_lib/sms.js';
import { checkRateLimit } from './_lib/rate-limit.js';
import { env } from './_lib/env.js';
import { RESERVATION_FEE_GHS } from '../src/config/booking.js';
import * as templates from '../src/lib/sms-templates.js';

const MAX_BODY_BYTES = 256 * 1024;

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

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function clientIp(req: IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

async function loadBooking(ref: string) {
  const [row] = await db.select().from(bookings).where(eq(bookings.ref, ref)).limit(1);
  return row ?? null;
}

async function handlePayPage(res: ServerResponse, ref: string, token: string): Promise<void> {
  try {
    let row = await loadBooking(ref);
    if (!row) {
      return sendJson(res, 403, { ok: false, valid: false, error: 'Link not valid.' });
    }
    if (row.payToken !== token) {
      return sendJson(res, 403, { ok: false, valid: false, error: 'Link not valid.' });
    }
    const { expireIfNeeded } = await import('../src/lib/expire.js');
    if (row.status !== 'approved_awaiting_payment') {
      return sendJson(res, 403, { ok: false, valid: false, error: 'Link not valid.' });
    }
    if (row.paymentDeadline) {
      try {
        await expireIfNeeded(row.id);
      } catch (e) {
        console.error('[api/pay] expireIfNeeded failed:', e);
      }
      const [row2] = await db.select().from(bookings).where(eq(bookings.id, row.id)).limit(1);
      if (row2 && row2.status === 'expired') {
        return sendJson(res, 403, { ok: false, valid: false, error: 'Link not valid.' });
      }
      if (row2) row = row2;
    }
    if (!row.paymentReference) {
      const expectedReference = `STC-PAY-${randomUUID()}`;
      await db
        .update(bookings)
        .set({ paymentReference: expectedReference, updatedAt: new Date() })
        .where(
          and(
            eq(bookings.id, row.id),
            eq(bookings.payToken, token),
            eq(bookings.status, 'approved_awaiting_payment'),
            isNull(bookings.paymentReference),
          ),
        );
      [row] = await db.select().from(bookings).where(eq(bookings.id, row.id)).limit(1);
    }
    if (!row?.paymentReference) {
      console.error('[api/pay] could not establish expected payment reference');
      return sendJson(res, 500, { ok: false, valid: false, error: 'Failed to prepare payment.' });
    }
    return sendJson(res, 200, {
      ok: true,
      valid: true,
      booking: {
        ref: row.ref,
        status: row.status,
        service: row.serviceName,
        approvedSlotDate: row.approvedSlotDate,
        approvedSlotTime: row.approvedSlotTime,
        price: row.servicePriceGhs,
        fee: RESERVATION_FEE_GHS,
        amountPaid: row.amountPaid,
        balanceDue: row.balanceDue,
        paymentDeadline: row.paymentDeadline,
        paymentReference: row.paymentReference,
        paymentStatus: row.paymentStatus,
        paidAt: row.paidAt,
        email: row.email,
        name: row.name,
      },
    });
  } catch (e) {
    console.error('[api/pay] pay page error:', e);
    return sendJson(res, 500, { ok: false, valid: false, error: 'Failed to load payment page.' });
  }
}

async function handleVerify(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const contentLength = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return sendJson(res, 413, { ok: false, error: 'Request is too large.' });
  }

  let input: unknown;
  try {
    const raw = await readBody(req);
    if (!raw) return sendJson(res, 400, { ok: false, error: 'The request body is empty.' });
    input = JSON.parse(raw);
  } catch {
    return sendJson(res, 400, { ok: false, error: 'The request body could not be read.' });
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return sendJson(res, 400, { ok: false, error: 'The request body is invalid.' });
  }
  const body = input as Record<string, unknown>;
  const reference = isString(body.reference) ? body.reference.trim() : '';
  const bookingRef = isString(body.bookingRef) ? body.bookingRef.trim() : '';
  if (!reference) return sendJson(res, 400, { ok: false, error: 'Missing payment reference.' });

  const ip = clientIp(req);
  const ipLimit = await checkRateLimit(`ip:${ip}:pay-verify`, 10, { windowMs: 60 * 1000 });
  if (!ipLimit.allowed) {
    res.setHeader('Retry-After', String(ipLimit.retryAfter || 60));
    return sendJson(res, 429, { ok: false, error: 'Too many requests. Please try again later.' });
  }
  if (bookingRef) {
    const refLimit = await checkRateLimit(`ref:${bookingRef}:pay-verify`, 5, {
      windowMs: 60 * 1000,
    });
    if (!refLimit.allowed) {
      res.setHeader('Retry-After', String(refLimit.retryAfter || 60));
      return sendJson(res, 429, {
        ok: false,
        error: 'Too many requests for this booking. Please try again later.',
      });
    }
  }

  const verified = await verifyPaystack(reference);
  if (verified.ok === false) {
    return sendJson(res, 422, { ok: false, error: verified.error });
  }

  const row = await loadBooking(bookingRef);
  if (!row) return sendJson(res, 404, { ok: false, error: 'Booking not found.' });

  const result = await confirmPayment({
    bookingId: row.id,
    paystackReference: verified.reference,
    amountPesewas: verified.amount,
    currency: verified.currency,
    customerEmail: verified.customer?.email,
    metadataBookingRef: verified.bookingRef,
  });

  if (result.ok === false) {
    return sendJson(res, 422, { ok: false, error: result.error });
  }

  const r: any = row;
  const dateStr = r.approvedSlotDate ? new Date(r.approvedSlotDate).toISOString().slice(0, 10) : '';
  const timeStr = r.approvedSlotTime || '';
  const amountPaidInt = Math.round(verified.amount / 100);
  const balanceDue = Math.max(0, (r.servicePriceGhs || 0) - amountPaidInt);

  if (result.alreadyRecorded) {
    return sendJson(res, 200, {
      ok: true,
      status: 'already_recorded',
      booking: { ref: r.ref, status: r.status },
    });
  }

  if (result.status === 'confirmed') {
    try {
      await sendSms(
        r.phone,
        templates.confirmedAfterPayment({
          service: r.serviceName,
          date: dateStr,
          time: timeStr,
          balance: balanceDue,
        }),
        { bookingId: r.id, event: 'confirmed_after_payment' },
      );
    } catch (e: any) {
      console.error('[api/pay] customer SMS failed (non-fatal):', e?.message || e);
    }

    try {
      await sendSms(
        env.OWNER_PHONE,
        templates.confirmedOwner({
          ref: r.ref,
          customerName: r.name || '',
          customerPhone: r.phone || '',
          customerEmail: r.email || '',
          appointmentDate: dateStr,
          appointmentTime: timeStr,
        }),
        { bookingId: r.id, event: 'confirmed_owner_notification' },
      );
    } catch (e: any) {
      console.error('[api/pay] owner SMS failed (non-fatal):', e?.message || e);
    }

    return sendJson(res, 200, {
      ok: true,
      status: 'confirmed',
      booking: {
        ref: r.ref,
        status: 'confirmed',
        service: r.serviceName,
        date: dateStr,
        time: timeStr,
        price: r.servicePriceGhs,
        amountPaid: amountPaidInt,
        balanceDue,
      },
    });
  }

  if (result.status === 'paid_needs_attention') {
    try {
      await sendSms(env.OWNER_PHONE, templates.paidNeedsAttentionOwner({ ref: r.ref }), {
        bookingId: r.id,
        event: 'paid_needs_attention_owner',
      });
    } catch (e: any) {
      console.error('[api/pay] owner SMS failed (non-fatal):', e?.message || e);
    }
    return sendJson(res, 200, {
      ok: true,
      status: 'paid_needs_attention',
      booking: {
        ref: r.ref,
        status: 'paid_needs_attention',
        service: r.serviceName,
        date: dateStr,
        time: timeStr,
        price: r.servicePriceGhs,
        amountPaid: amountPaidInt,
        balanceDue,
      },
    });
  }

  return sendJson(res, 200, {
    ok: true,
    status: 'already_recorded',
    booking: { ref: r.ref, status: r.status },
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const method = (req.method || 'GET').toUpperCase();
  const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
  const action = (url.searchParams.get('action') || '').toLowerCase();
  const refParam = (url.searchParams.get('ref') || '').trim();

  // POST /api/pay/verify (routed via rewrite: /api/pay/verify -> /api/pay?action=verify)
  if (action === 'verify') {
    if (method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
    }
    return handleVerify(req, res);
  }

  // GET /api/pay/:ref (routed via rewrite: /api/pay/:ref -> /api/pay?ref=:ref)
  if (method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
  }

  // Also support :ref as a trailing path segment for direct file-route matching
  const pathRef = url.pathname.split('/').filter(Boolean).pop() || '';
  const ref = refParam || pathRef;
  const token = (url.searchParams.get('t') || '').trim();

  if (!ref || !token) {
    return sendJson(res, 403, { ok: false, valid: false, error: 'Link not valid.' });
  }
  return handlePayPage(res, ref, token);
}
