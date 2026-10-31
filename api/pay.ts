// @ts-no-check
/**
 * StyledByC — Pay page lookup and payment verification dispatcher.
 *
 * Single entry point for:
 *   GET  /api/pay?ref=:ref   → pay page lookup (authenticated by one-time pay token)
 *   POST /api/pay?action=verify → server-side Paystack verification
 *
 * Replaces pay/index.ts and pay/verify.ts serverless functions.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { bookings } from '../src/db/schema.js';
import { verifyPaystack } from '../src/lib/paystack-verify.js';
import { confirmPayment } from '../src/lib/confirm-payment.js';
import { sendSms } from './_lib/sms.js';
import { RESERVATION_FEE_GHS } from '../src/config/booking.js';
import * as templates from '../src/lib/sms-templates.js';

const MAX_BODY_BYTES = 256 * 1024;
const FEE_PESWAS = 10000;

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
      if (total > MAX_BODY_BYTES) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

async function loadBooking(ref: string) {
  const [row] = await db.select().from(bookings).where(eq(bookings.ref, ref)).limit(1);
  return row ?? null;
}

async function handlePayPage(res: ServerResponse, ref: string, token: string): Promise<void> {
  try {
    const [row] = await db.select().from(bookings).where(eq(bookings.ref, ref)).limit(1);
  if (!row) {
    return sendJson(res, 403, { ok: false, valid: false, error: 'Link not valid.' });
  }
  if (row.payToken !== token) {
    return sendJson(res, 403, { ok: false, valid: false, error: 'Link not valid.' });
  }
  if (row.status !== 'approved_awaiting_payment') {
    return sendJson(res, 403, { ok: false, valid: false, error: 'Link not valid.' });
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
      fee: 100,
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

  const verified = await verifyPaystack(reference);
  if (!verified.ok) {
    return sendJson(res, 422, { ok: false, error: verified.error });
  }
  if (verified.currency !== 'GHS') {
    return sendJson(res, 422, { ok: false, error: 'Invalid currency.' });
  }
  if (verified.amount !== FEE_PESWAS) {
    return sendJson(res, 422, { ok: false, error: 'Payment amount does not match.' });
  }

  const row = await loadBooking(bookingRef);
  if (!row) return sendJson(res, 404, { ok: false, error: 'Booking not found.' });

  if (row.paymentReference && row.paymentReference === reference) {
    return sendJson(res, 409, { ok: false, error: 'This payment reference has already been used.' });
  }

  const result = await confirmPayment({
    bookingId: row.id,
    paystackReference: reference,
    amountPesewas: verified.amount,
    currency: verified.currency,
    customerEmail: verified.customer?.email,
  });

  if (!result.ok) {
    return sendJson(res, 422, { ok: false, error: result.error });
  }

  const booking = result.booking as any;
  const b: any = {
    ref: row.ref,
    name: row.name,
    email: row.email,
    serviceName: row.serviceName,
    date: row.approvedSlotDate ? new Date(row.approvedSlotDate).toISOString().slice(0, 10) : '',
    time: row.approvedSlotTime || '',
    price: row.servicePriceGhs,
    amountPaid: FEE_PESWAS / 100,
    balanceDue: Math.max(0, (row.servicePriceGhs || 0) - FEE_PESWAS / 100),
  };

  if (result.status === 'confirmed') {
    await sendSms(row.phone, templates.confirmedAfterPayment({
      service: row.serviceName, date: b.date, time: b.time, balance: b.balanceDue,
    }), { bookingId: row.id, event: 'confirmed_after_payment' });
  } else if (result.status === 'paid_needs_attention') {
    await sendSms(process.env.OWNER_PHONE || '', templates.paidNeedsAttentionOwner({ ref: row.ref }), { bookingId: row.id, event: 'paid_needs_attention_owner' });
  }

  return sendJson(res, 200, {
    ok: true,
    status: result.status,
    booking: {
      ref: row.ref,
      status: result.status,
      service: row.serviceName,
      date: b.date,
      time: b.time,
      price: row.servicePriceGhs,
      amountPaid: FEE_PESWAS / 100,
      balanceDue: b.balanceDue,
    },
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

