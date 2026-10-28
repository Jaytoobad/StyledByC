/**
 * StyledByC � GET /api/cron/expire
 *
 * Daily Vercel cron: marks approved_awaiting_payment bookings past their
 * payment deadline as expired. Protected by CRON_SECRET.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { expireOverdue } from '../../src/lib/expire.js';

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
  }

  const secret = (process.env.CRON_SECRET || '').trim();
  if (!secret) {
    return sendJson(res, 503, { ok: false, error: 'Cron not configured.' });
  }

  const authHeader = (req.headers.authorization || '').trim();
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (bearerToken !== secret) {
    return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
  }

  try {
    const count = await expireOverdue();
    return sendJson(res, 200, { ok: true, expired: count });
  } catch (e) {
    console.error('[cron/expire] error:', e);
    return sendJson(res, 500, { ok: false, error: 'Internal error' });
  }
}
