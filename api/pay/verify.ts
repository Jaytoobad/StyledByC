/**
 * StyledByC — POST /api/pay/verify
 *
 * Server-side payment verification. Calls Paystack, checks status/currency/
 * amount, ensures the reference is never used, then runs a Neon transaction
 * to re-check the slot and deadline before confirming.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../src/db/index';
import { bookings } from '../../src/db/schema';
import { verifyPaystack } from '../../src/lib/paystack-verify';
import { confirmPayment } from '../../src/lib/confirm-payment';
import { notify, sendEmail } from '../../src/lib/email';
import * as templates from '../../src/lib/email-templates';

const MAX_BODY_BYTES = 256 * 1024;
const FEE_PESWAS = 10000;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
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

async function loadBooking(ref: string) {
  const [row] = await db.select().from(bookings).where(eq(bookings.ref, ref)).limit(1);
  return row ?? null;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
  }

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

  // 1. Verify with Paystack.
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

  // 2. Load the booking.
  const row = await loadBooking(bookingRef);
  if (!row) return sendJson(res, 404, { ok: false, error: 'Booking not found.' });

  // 3. Reference must never have been used.
  if (row.paymentReference && row.paymentReference === reference) {
    return sendJson(res, 409, { ok: false, error: 'This payment reference has already been used.' });
  }

  // 4. Confirm inside a transaction.
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

  // 5. Emails — never block the booking.
  if (result.status === 'confirmed') {
    notify(templates.confirmedCustomer(b));
    notify(templates.receiptCustomer(b));
  } else if (result.status === 'paid_needs_attention') {
    notify(templates.paidNeedsAttentionOwner(b));
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