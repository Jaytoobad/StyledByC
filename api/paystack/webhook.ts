/**
 * StyledByC — POST /api/paystack/webhook
 *
 * Receives Paystack webhooks, verifies the signature, and records a successful
 * payment even if the customer closed the pay page. Idempotent: a reference
 * already recorded is a no-op success.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHmac } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../../src/db/index';
import { bookings } from '../../src/db/schema';
import { sendSms } from '../_lib/sms';
import * as templates from '../../src/lib/sms-templates';

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

function verifySignature(rawBody: string, signature: string | undefined): boolean {
  const secret = (process.env.PAYSTACK_SECRET_KEY || '').trim();
  if (!secret || !signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex') === signature;
  } catch {
    return false;
  }
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
  if (!raw) return sendJson(res, 400, { ok: false, error: 'Could not read body.' });

  if (!verifySignature(raw, signature)) {
    return sendJson(res, 401, { ok: false, error: 'Invalid signature.' });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return sendJson(res, 400, { ok: false, error: 'Invalid JSON.' });
  }

  const event = String(payload?.event || '');
  if (event !== 'charge.success') {
    return sendJson(res, 200, { ok: true, received: event });
  }

  const data = payload?.data || {};
  const reference = String(data?.reference || '').trim();
  if (!reference) return sendJson(res, 400, { ok: false, error: 'Missing reference.' });

  const currency = String(data?.currency || '').toUpperCase();
  const amount = Number(data?.amount) || 0;
  if (currency !== 'GHS' || amount !== FEE_PESWAS) {
    return sendJson(res, 422, { ok: false, error: 'Currency/amount mismatch.' });
  }

  // Find the booking by payment reference.
  const [row] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.paymentReference, reference))
    .limit(1);

  if (!row) {
    // Reference not yet linked — cannot proceed safely.
    return sendJson(res, 404, { ok: false, error: 'Booking not found for reference.' });
  }

  // Idempotent.
  if (row.paymentStatus === 'paid' || row.status === 'confirmed') {
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
      balance: Math.max(0, (row.servicePriceGhs || 0) - FEE_PESWAS / 100),
    }));
    return sendJson(res, 200, { ok: true, status: 'confirmed' });
  }

  // Money received but cannot confirm.
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
  return sendJson(res, 200, { ok: true, status: 'paid_needs_attention' });
}