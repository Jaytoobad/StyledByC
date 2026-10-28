/**
 * StyledByC — slot availability endpoint.
 *
 * GET /api/availability?date=YYYY-MM-DD
 *
 * Served from the Neon availability table (seeded for the next 30 days,
 * Mon-Sat 09:00-17:00 hourly). Confirmed booking times are excluded.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { and, eq, gte, lt, or } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { availability, bookings } from '../src/db/schema.js';

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function looksLikeDate(s: string | null): boolean {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !Number.isNaN(new Date(s + 'T00:00:00').getTime());
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
  }

  const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
  const date = url.searchParams.get('date');
  if (!looksLikeDate(date)) {
    return sendJson(res, 400, { ok: false, error: 'Please provide a valid date.' });
  }

  const startOfDay = new Date(`${date}T00:00:00`);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const slots = await db
    .select()
    .from(availability)
    .where(and(gte(availability.date, startOfDay), lt(availability.date, endOfDay), eq(availability.isOpen, true)))
    .orderBy(availability.startTime);

  const taken = await db
    .select({ requestedTime: bookings.requestedTime })
    .from(bookings)
    .where(
      and(
        gte(bookings.requestedDate, startOfDay),
        lt(bookings.requestedDate, endOfDay),
        or(
          eq(bookings.status, 'confirmed'),
          eq(bookings.status, 'approved_awaiting_payment'),
          eq(bookings.status, 'pending_approval'),
        ),
      ),
    );
  const takenTimes = new Set(taken.map((r) => r.requestedTime));

  return sendJson(res, 200, {
    ok: true,
    date,
    slots: slots.filter((s) => !takenTimes.has(s.startTime)).map((s) => ({ startTime: s.startTime, endTime: s.endTime })),
  });
}
