/**
 * StyledByC � Admin pay-approve API
 * POST /api/admin/pay-approve
 * Body: { action: 'approve', ref? }
 *
 * Authorized solely by the HttpOnly admin_session cookie.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { bookings, adminAuditLogs } from '../../src/db/schema.js';
import { authorize, validateCsrf } from '../_lib/admin-auth.js';
import { sendSms } from '../_lib/sms.js';
import * as templates from '../../src/lib/sms-templates.js';

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

function mapRow(r: any) {
  return {
    ref: r.ref,
    createdAt: r.createdAt?.toISOString?.() || r.createdAt,
    name: r.name,
    email: r.email,
    phone: r.phone,
    service: r.serviceName,
    date: r.approvedSlotDate?.toISOString?.().slice(0, 10) || r.requestedDate?.toISOString?.().slice(0, 10) || '',
    time: r.approvedSlotTime || r.requestedTime || '',
    price: r.servicePriceGhs ?? null,
    paymentOption: r.paymentOption,
    amountPaid: r.amountPaid ?? null,
    balanceDue: r.balanceDue ?? null,
    paymentReference: r.paymentReference || undefined,
    paymentStatus: r.paymentStatus || undefined,
    paidAt: r.paidAt?.toISOString?.() || r.paidAt,
    status: r.status,
  };
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
  }

  const auth = await authorize(req);
  if (!auth.authorized) {
    return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
  }

  const csrf = validateCsrf(req);
  if (csrf.ok === false) {
    return sendJson(res, 403, { ok: false, error: csrf.error });
  }

  async function recordAudit(action: string, targetRef: string, details: any) {
    try {
      await db.insert(adminAuditLogs).values({
        actorId: auth.userId!,
        actorEmail: auth.email!,
        action,
        targetType: 'booking',
        targetRef,
        details: details ?? null,
      });
    } catch (e) {
      console.error('[admin/pay-approve] audit error:', e);
    }
  }

  const contentLength = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return sendJson(res, 413, { ok: false, error: 'Request is too large.' });
  }

  let input: any;
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

  const action = String(input.action || '').trim();
  const ref = String(input.ref || '').trim();

  if (!ref) {
    return sendJson(res, 400, { ok: false, error: 'Missing booking reference.' });
  }

  const [row] = await db.select().from(bookings).where(eq(bookings.ref, ref)).limit(1);
  if (!row) {
    return sendJson(res, 404, { ok: false, error: 'Booking not found.' });
  }

  if (action === 'approve') {
    try {
      if (row.status === 'approved_awaiting_payment') {
        const payLink = row.payToken ? `/pay/${encodeURIComponent(row.ref)}?t=${encodeURIComponent(row.payToken)}` : undefined;
        return sendJson(res, 200, { ok: true, booking: mapRow(row), payLink, deadline: row.paymentDeadline?.toISOString?.() });
      }
      if (row.status !== 'pending_approval') {
        const payLink = row.payToken ? `/pay/${encodeURIComponent(row.ref)}?t=${encodeURIComponent(row.payToken)}` : undefined;
        return sendJson(res, 200, { ok: true, booking: mapRow(row), payLink, deadline: row.paymentDeadline?.toISOString?.() });
      }
      const now = new Date();
      const [updated] = await db
        .update(bookings)
        .set({
          status: 'approved_awaiting_payment',
          approvedSlotDate: row.requestedDate,
          approvedSlotTime: row.requestedTime,
          paymentDeadline: new Date(now.getTime() + 30 * 60 * 1000),
          updatedAt: now,
        })
        .where(eq(bookings.id, row.id))
        .returning();
      const target = updated || row;
      const payLink = target.payToken ? `/pay/${encodeURIComponent(target.ref)}?t=${encodeURIComponent(target.payToken)}` : undefined;
      try {
        const studioPhone = (process.env.STUDIO_PHONE || '').trim();
        const msg = templates.approvedAwaitingPayment({
          service: target.serviceName,
          date: target.approvedSlotDate ? new Date(target.approvedSlotDate).toISOString().slice(0, 10) : '',
          time: target.approvedSlotTime || row.requestedTime || '',
          price: target.servicePriceGhs || row.servicePriceGhs || 0,
          fee: 100,
          payLink: payLink || '',
          deadline: target.paymentDeadline ? new Date(target.paymentDeadline).toISOString() : '',
          studioPhone,
        });
        await sendSms(target.phone, msg, { bookingId: target.id || row.id, event: 'approved_awaiting_payment' });
      } catch (e) {
        console.error('[admin/pay-approve] sms error:', e);
      }
        await recordAudit('approve', target.ref, { previousStatus: row.status, payLink });
      return sendJson(res, 200, { ok: true, booking: mapRow(target), payLink, deadline: target.paymentDeadline?.toISOString?.() });
    } catch (e) {
      console.error('[admin/pay-approve] error:', e);
      return sendJson(res, 500, { ok: false, error: 'Failed to approve booking.' });
    }
  }

  return sendJson(res, 400, { ok: false, error: 'Invalid action.' });
}


