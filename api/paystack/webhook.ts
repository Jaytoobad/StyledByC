/**
 * StyledByC — POST /api/paystack/webhook
 *
 * Receives Paystack webhooks, verifies the signature, and routes the payment
 * through the shared confirmPayment helper. Idempotent: a repeated webhook for
 * an already-paid booking returns 200 and changes nothing. Always returns 200
 * quickly for valid signed events so Paystack stops retrying.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { bookings } from '../../src/db/schema.js';
import { sendSms } from '../_lib/sms.js';
import * as templates from '../../src/lib/sms-templates.js';
import { verifySignature } from '../_lib/verify-signature.js';
import { confirmPayment } from '../../src/lib/confirm-payment.js';
import { getMetadataBookingRef } from '../../src/lib/paystack-verify.js';

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
  const raw = await readBody(req).catch((error) => {
    console.error('[paystack/webhook] request body read failed:', error);
    return null;
  });
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
  } catch (error) {
    console.error('[paystack/webhook] invalid json:', error);
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
  const metadataBookingRef = getMetadataBookingRef(data?.metadata);

  let [row] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.paymentReference, reference))
    .limit(1);

  if (!row && metadataBookingRef) {
    [row] = await db.select().from(bookings).where(eq(bookings.ref, metadataBookingRef)).limit(1);
  }

  if (!row) {
    console.error('[paystack/webhook] signed successful payment has no matching booking');
    return sendJson(res, 200, { ok: true, status: 'unmatched_payment' });
  }

  const result = await confirmPayment({
    bookingId: row.id,
    paystackReference: reference,
    amountPesewas: amount,
    currency,
    customerEmail: data?.customer?.email,
    metadataBookingRef,
  });

  if (result.ok === false) {
    console.error('[paystack/webhook] confirmPayment failed:', result.error);
    return sendJson(res, 200, { ok: true, status: 'confirm_error', error: result.error });
  }

  const r: any = row;

  if (result.alreadyRecorded) {
    console.log('[paystack/webhook] payment already recorded; skipping notifications');
    return sendJson(res, 200, { ok: true, status: 'already_recorded' });
  }

  if (result.status === 'confirmed') {
    try {
      await sendSms(
        r.phone,
        templates.confirmedAfterPayment({
          service: r.serviceName,
          date: r.approvedSlotDate ? new Date(r.approvedSlotDate).toISOString().slice(0, 10) : '',
          time: r.approvedSlotTime || '',
          balance: Math.max(0, (r.servicePriceGhs || 0) - Math.round(amount / 100)),
        }),
        { bookingId: r.id, event: 'confirmed_after_payment' },
      );
    } catch (e: any) {
      console.error('[paystack/webhook] customer SMS failed (non-fatal):', e?.message || e);
    }
    console.log('[paystack/webhook] success - confirmed');
    return sendJson(res, 200, { ok: true, status: 'confirmed' });
  }

  if (result.status === 'paid_needs_attention') {
    try {
      await sendSms(
        process.env.OWNER_PHONE || '',
        templates.paidNeedsAttentionOwner({ ref: r.ref }),
        { bookingId: r.id, event: 'paid_needs_attention_owner' },
      );
    } catch (e: any) {
      console.error('[paystack/webhook] owner SMS failed (non-fatal):', e?.message || e);
    }
    console.log('[paystack/webhook] success - paid_needs_attention');
    return sendJson(res, 200, { ok: true, status: 'paid_needs_attention' });
  }

  console.log('[paystack/webhook] already recorded');
  return sendJson(res, 200, { ok: true, status: 'already_recorded' });
}
