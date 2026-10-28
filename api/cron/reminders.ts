/**
 * StyledByC � GET /api/cron/reminders
 * Daily cron: texts confirmed customers the day before their appointment.
 * Protected by CRON_SECRET.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { bookings } from '../../src/db/schema.js';
import { sendSms } from '../_lib/sms.js';
import { reminderDayBefore } from '../../src/lib/sms-templates.js';

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function env(name: string): string {
  const v = process.env[name];
  return typeof v === 'string' ? v.trim() : '';
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
  }

  const secret = env('CRON_SECRET');
  if (!secret) {
    return sendJson(res, 503, { ok: false, error: 'Cron not configured.' });
  }

  const authHeader = (req.headers.authorization || '').trim();
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (bearerToken !== secret) {
    return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
  }

  const studioPhone = env('STUDIO_PHONE');
  if (!studioPhone) {
    return sendJson(res, 503, { ok: false, error: 'Studio phone not configured.' });
  }

  try {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const start = new Date(tomorrow);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

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
