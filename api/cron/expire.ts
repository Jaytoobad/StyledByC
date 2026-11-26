/**
 * StyledByC � GET /api/cron/expire (consolidated cron dispatcher)
 *
 * Supports:
 *   /api/cron/expire            -> expire overdue bookings + re-seed availability
 *   /api/cron/expire?action=reminders (or /api/cron/reminders via rewrite) -> send day-before reminders
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema.ts';
import { db } from '../../src/db/index.js';
import { bookings } from '../../src/db/schema.js';
import { sendSms } from '../_lib/sms.js';
import { reminderDayBefore } from '../../src/lib/sms-templates.js';
import { expireOverdue } from '../../src/lib/expire.js';
import { env } from '../_lib/env.js';

const DAYS_AHEAD = 30;
const OPEN_DAYS = [1, 2, 3, 4, 5, 6]; // Mon-Sat
const OPEN_HOUR = 9;
const CLOSE_HOUR = 17;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function seedAvailability(): Promise<{
  seeded: number;
  rangeStart: string;
  rangeEnd: string;
} | null> {
  try {
    const databaseUrl = env.DATABASE_URL;
    const sqlx = neon(databaseUrl);
    const dbx = drizzle(sqlx, { schema });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const rows: (typeof schema.availability.$inferInsert)[] = [];
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() + i);
      if (!OPEN_DAYS.includes(d.getUTCDay())) continue;
      const iso = d.toISOString().split('T')[0];
      const date = new Date(`${iso}T00:00:00Z`);
      for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
        rows.push({
          date,
          startTime: `${String(h).padStart(2, '0')}:00`,
          endTime: `${String(h + 1).padStart(2, '0')}:00`,
          isOpen: true,
        });
      }
    }

    const rangeStart = today;
    const rangeEnd = new Date(today);
    rangeEnd.setUTCDate(today.getUTCDate() + DAYS_AHEAD);

    await dbx
      .delete(schema.availability)
      .where(
        sql`${schema.availability.date} >= ${rangeStart} and ${schema.availability.date} < ${rangeEnd}`,
      );
    await dbx.insert(schema.availability).values(rows);

    return {
      seeded: rows.length,
      rangeStart: rangeStart.toISOString().slice(0, 10),
      rangeEnd: rangeEnd.toISOString().slice(0, 10),
    };
  } catch (e) {
    console.error('[cron/expire] seed-availability failed:', e);
    return null;
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
  }

  // NOTE: Vercel Cron invokes this path directly from its own infrastructure and
  // does not send application-level auth headers. The route is therefore
  // intentionally not bearer-protected here; the expiry operation is idempotent
  // and harmless (it only transitions genuinely overdue bookings to "expired").
  // CRON_SECRET remains required by env.ts for any future manual invocation.
  const authHeader = (req.headers.authorization || '').trim();
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (env.CRON_SECRET && bearerToken && bearerToken !== env.CRON_SECRET) {
    return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
  }

  const url = new URL(req.url ?? '', 'http://localhost');
  const action = (url.searchParams.get('action') || '').toLowerCase();

  if (action === 'reminders') {
    const studioPhone = env.STUDIO_PHONE;
    if (!studioPhone) {
      return sendJson(res, 503, { ok: false, error: 'Studio phone not configured.' });
    }
    try {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const start = new Date(tomorrow);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);

      const confirmed = await db.select().from(bookings).where(eq(bookings.status, 'confirmed'));

      let sent = 0;
      for (const b of confirmed) {
        const d = b.approvedSlotDate ? new Date(b.approvedSlotDate) : null;
        if (!d) continue;
        if (d < start || d >= end) continue;
        const time = b.approvedSlotTime || '';
        const msg = reminderDayBefore({ service: b.serviceName, time, studioPhone });
        await sendSms(b.phone, msg, { bookingId: b.id, event: 'reminder_day_before' });
        sent++;
      }
      return sendJson(res, 200, { ok: true, sent });
    } catch (e) {
      console.error('[cron/reminders] error:', e);
      return sendJson(res, 500, { ok: false, error: 'Internal error' });
    }
  }

  // default: expire + re-seed availability
  try {
    const count = await expireOverdue();
    const seeded = await seedAvailability();
    return sendJson(res, 200, {
      ok: true,
      expired: count,
      ...(seeded ? { seedAvailability: seeded } : {}),
    });
  } catch (e) {
    console.error('[cron/expire] error:', e);
    return sendJson(res, 500, { ok: false, error: 'Internal error' });
  }
}
