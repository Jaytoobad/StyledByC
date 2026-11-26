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
import { BOOKING_START_TIMES } from '../src/config/booking.js';
import { availabilityCoversBooking, bookingSlotEndTime } from '../src/lib/booking-slots.js';
import { OPEN_DAYS_CLIENT, AVAILABILITY_FALLBACK } from '../src/config/booking.js';

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function looksLikeDate(s: string | null): boolean {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !Number.isNaN(new Date(s + 'T00:00:00Z').getTime());
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
  const validatedDate: string = date;

  const startOfDay = new Date(`${validatedDate}T00:00:00Z`);
  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

  const slots = await db
    .select()
    .from(availability)
    .where(
      and(
        gte(availability.date, startOfDay),
        lt(availability.date, endOfDay),
        eq(availability.isOpen, true),
      ),
    )
    .orderBy(availability.startTime);

  if (slots.length === 0) {
    const requested = new Date(`${validatedDate}T00:00:00Z`);
    const dayOfWeek = requested.getUTCDay();
    const isOpenDay =
      OPEN_DAYS_CLIENT.includes(dayOfWeek) &&
      !AVAILABILITY_FALLBACK.blockedDates?.includes(validatedDate);
    if (isOpenDay) {
      console.error(
        `[availability] No availability rows found for ${validatedDate} (open day). Seed the availability table: run scripts/seed-availability.ts or the /api/cron/seed-availability cron.`,
      );
    }
  }

  const { expireIfNeeded } = await import('../src/lib/expire.js');
  const takenCandidates = await db
    .select({ id: bookings.id, status: bookings.status, paymentDeadline: bookings.paymentDeadline })
    .from(bookings)
    .where(
      and(
        eq(bookings.approvedSlotDate, startOfDay),
        or(
          eq(bookings.status, 'confirmed'),
          eq(bookings.status, 'approved_awaiting_payment'),
          eq(bookings.status, 'paid_needs_attention'),
          eq(bookings.status, 'pending_approval'),
        ),
      ),
    );
  for (const t of takenCandidates) {
    if ((t as any).status === 'approved_awaiting_payment') {
      try {
        await expireIfNeeded((t as any).id);
      } catch (e) {
        console.error('[availability] expireIfNeeded failed:', e);
      }
    }
  }
  const taken = await db
    .select({ approvedSlotTime: bookings.approvedSlotTime })
    .from(bookings)
    .where(
      and(
        eq(bookings.approvedSlotDate, startOfDay),
        or(
          eq(bookings.status, 'confirmed'),
          eq(bookings.status, 'approved_awaiting_payment'),
          eq(bookings.status, 'paid_needs_attention'),
        ),
      ),
    );
  const takenTimes = new Set(taken.map((r: any) => r.approvedSlotTime).filter(Boolean));

  const openIntervals = slots.map((slot) => ({
    startTime: slot.startTime,
    endTime: slot.endTime,
  }));
  const availableTimes = BOOKING_START_TIMES.filter(
    (time) => availabilityCoversBooking(time, openIntervals) && !takenTimes.has(time),
  );

  return sendJson(res, 200, {
    ok: true,
    validatedDate,
    slots: availableTimes.map((startTime) => ({
      startTime,
      endTime: bookingSlotEndTime(startTime),
    })),
  });
}
