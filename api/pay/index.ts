/**
 * StyledByC — GET /api/pay/:ref
 *
 * Returns the booking details needed to render the /pay page, authenticated by
 * the one-time pay token. Without a valid token returns 403 with a flag so the
 * page can show "Link not valid".
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db/index';
import { bookings } from '../../src/db/schema';

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function readPath(req: IncomingMessage): string {
  const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
  return url.pathname;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
  }

  const parts = readPath(req).split('/').filter(Boolean);
  // parts: ['api', 'pay', ':ref']
  const ref = parts[2] ? decodeURIComponent(parts[2]) : '';
  const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
  const token = (url.searchParams.get('t') || '').trim();

  if (!ref || !token) {
    return sendJson(res, 403, { ok: false, valid: false, error: 'Link not valid.' });
  }

  const [row] = await db.select().from(bookings).where(eq(bookings.ref, ref)).limit(1);
  if (!row) {
    return sendJson(res, 403, { ok: false, valid: false, error: 'Link not valid.' });
  }

  if (row.payToken !== token) {
    return sendJson(res, 403, { ok: false, valid: false, error: 'Link not valid.' });
  }

  // Only approved bookings awaiting payment have a valid pay link.
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
}