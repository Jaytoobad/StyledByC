/**
 * StyledByC — POST /api/paystack/webhook
 *
 * Receives Paystack webhooks, verifies the signature, and records a successful
 * payment even if the customer closed the pay page. Idempotent: a repeated
 * webhook for an already-paid booking returns 200 and changes nothing.
 * Always returns 200 quickly for valid signed events so Paystack stops retrying.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { bookings } from '../../src/db/schema.js';
import { sendSms } from '../_lib/sms.js';
import * as templates from '../../src/lib/sms-templates.js';
import { verifySignature } from './verify-signature.js';
import { RESERVATION_FEE_GHS } from '../../src/config/booking.js';

const MAX_BODY_BYTES = 256 * 1024;
const DEFAULT_FEE_PESWAS = Math.round(RESERVATION_FEE_GHS * 100);

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

  const signature = req.headers['x-paystack-signature'] as string | undefined;
  const raw = await readBody(req).catch(() => null);
  if (!raw) {
    console.log('[paystack/webhook] could not read body');
    return sendJson(res, 400, { ok: false, error: 'Could not read body.' });
  }

  if (!verifySignature(raw, signature)) {
    return sendJson(res, 401, { ok: false, error: 'Invalid signature.' });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    console.log('[paystack/webhook] invalid json');
    return sendJson(res, 400, { ok: false, error: 'Invalid JSON.' });
  }

  const event = String(payload?.event || '');
  if (event !== 'charge.success') {
    console.log('[paystack/webhook] received non-charge.success event:', event);
    return sendJson(res, 200, { ok: true, received: event });
  }

  const data = payload?.data || {};
  const reference = String(data?.reference || '').trim();
  if (!reference) {
    console.log('[paystack/webhook] missing reference');
    return sendJson(res, 200, { ok: true, status: 'missing_reference' });
  }

  const currency = String(data?.currency || '').toUpperCase();
  const amount = Number(data?.amount) || 0;

  const [row] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.paymentReference, reference))
    .limit(1);

  if (!row) {
    console.log('[paystack/webhook] booking not found for reference');
    return sendJson(res, 404, { ok: false, error: 'Booking not found for reference.' });
  }

  const expectedFeePesewas = DEFAULT_FEE_PESWAS;

  if (currency !== 'GHS' || amount < expectedFeePesewas) {
    console.log('[paystack/webhook] amount/currency mismatch:', { currency, amount, expected: expectedFeePesewas });
    if ((row as any).paymentStatus !== 'paid' && row.status !== 'confirmed') {
      const now = new Date();
      await db
        .update(bookings)
        .set({
          status: 'paid_needs_attention',
          paymentStatus: 'paid',
          paidAt: now,
          updatedAt: now,
          ownerNote: 'Money received via webhook but amount/currency mismatch — needs owner review.',
        })
        .where(eq(bookings.id, row.id));
      await sendSms(process.env.OWNER_PHONE || '', templates.paidNeedsAttentionOwner({ ref: row.ref }));
    }
    return sendJson(res, 200, { ok: true, status: 'amount_mismatch' });
  }

  if ((row as any).paymentStatus === 'paid' || row.status === 'confirmed') {
    console.log('[paystack/webhook] duplicate - already paid/confirmed');
    return sendJson(res, 200, { ok: true, status: 'already_recorded' });
  }

  const now = new Date();
  const pastDeadline = row.paymentDeadline
    ? now.getTime() > new Date(row.paymentDeadline).getTime() + 5 * 60 * 1000
    : false;

  if (row.status === 'approved_awaiting_payment' && !pastDeadline) {
    await db
      .update(bookings)
      .set({
        status: 'confirmed',
        paymentStatus: 'paid',
        paidAt: now,
        updatedAt: now,
      })
      .where(eq(bookings.id, row.id));
    await sendSms(row.phone, templates.confirmedAfterPayment({
      service: row.serviceName,
      date: row.approvedSlotDate ? new Date(row.approvedSlotDate).toISOString().slice(0, 10) : '',
      time: row.approvedSlotTime || '',
      balance: Math.max(0, (row.servicePriceGhs || 0) - DEFAULT_FEE_PESWAS / 100),
    }));
    console.log('[paystack/webhook] success - confirmed');
    return sendJson(res, 200, { ok: true, status: 'confirmed' });
  }

  await db
    .update(bookings)
    .set({
      status: 'paid_needs_attention',
      paymentStatus: 'paid',
      paidAt: now,
      updatedAt: now,
      ownerNote: 'Money received via webhook but slot could not be confirmed.',
    })
    .where(eq(bookings.id, row.id));
  await sendSms(process.env.OWNER_PHONE || '', templates.paidNeedsAttentionOwner({ ref: row.ref }));
  console.log('[paystack/webhook] success - paid_needs_attention');
  return sendJson(res, 200, { ok: true, status: 'paid_needs_attention' });
}
