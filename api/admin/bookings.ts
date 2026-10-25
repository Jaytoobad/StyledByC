/**
 * StyledByC — Vercel serverless proxy for the admin booking panel.
 *
 * Accepts POSTs to the same-origin /api/admin/bookings route and forwards
 * them server-side to the configured Apps Script endpoint. The upstream
 * destination is read ONLY from the server-side environment variable
 * APPS_SCRIPT_URL. It is never exposed to browser code and callers cannot
 * choose an arbitrary destination.
 *
 * Apps Script remains the single source of truth: it re-validates the
 * service and price, checks availability, locks slots, sets the booking
 * status and sends emails. This function does not create a second booking
 * record.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

// Maximum accepted request body size. ~256 KB is far more than an admin
// request needs and limits abuse without affecting legitimate submissions.
const MAX_BODY_BYTES = 256 * 1024;

const ADMIN_ACTIONS = ['list', 'approve', 'reject', 'cancel'] as const;

type AdminAction = (typeof ADMIN_ACTIONS)[number];

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

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
  // --- Method check -------------------------------------------------------
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
  }

  // --- Request-size guard -------------------------------------------------
  const contentLength = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return sendJson(res, 413, { ok: false, error: 'Request is too large. Please try again.' });
  }

  // --- Server-side configuration check ------------------------------------
  // Never reveal the upstream URL or configuration details to the client.
  const APPS_SCRIPT_URL = (process.env.APPS_SCRIPT_URL || '').trim();
  const ADMIN_API_TOKEN = (process.env.ADMIN_API_TOKEN || '').trim();

  if (!APPS_SCRIPT_URL) {
    return sendJson(res, 503, {
      ok: false,
      error: 'Booking service is not configured. Please contact the studio.',
    });
  }
  if (!ADMIN_API_TOKEN) {
    return sendJson(res, 503, { ok: false, error: 'Admin not configured.' });
  }

  // --- Read and parse the body --------------------------------------------
  let input: unknown;
  try {
    const raw = await readBody(req);
    if (!raw) {
      return sendJson(res, 400, { ok: false, error: 'The request body is empty. Please try again.' });
    }
    input = JSON.parse(raw);
  } catch {
    return sendJson(res, 400, { ok: false, error: 'The request body could not be read. Please try again.' });
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return sendJson(res, 400, { ok: false, error: 'The request body is invalid.' });
  }

  const body = input as Record<string, unknown>;

  // --- Validate the requested action --------------------------------------
  const action = String(body.action || '').trim() as AdminAction;
  if (!ADMIN_ACTIONS.includes(action)) {
    return sendJson(res, 400, { ok: false, error: 'Unknown action.' });
  }

  // Approve / reject / cancel need a booking reference.
  if (action !== 'list' && (!isString(body.ref) || !String(body.ref || '').trim())) {
    return sendJson(res, 400, { ok: false, error: 'Missing booking reference.' });
  }

  // --- Admin token check --------------------------------------------------
  // The token is supplied by the browser in the request body (or the
  // x-admin-token header) and must match the server-side ADMIN_API_TOKEN.
  const token = String(body.token || req.headers['x-admin-token'] || '').trim();
  if (!token || token !== ADMIN_API_TOKEN) {
    return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
  }

  // --- Forward to Apps Script ----------------------------------------------
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  let upstream: Response;
  try {
    upstream = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, token: ADMIN_API_TOKEN }),
      redirect: 'follow',
      signal: controller.signal,
    });
  } catch {
    return sendJson(res, 502, {
      ok: false,
      error: 'Could not reach the booking service. Please try again later.',
    });
  } finally {
    clearTimeout(timer);
  }

  // --- Parse the upstream response ------------------------------------------
  let data: unknown;
  try {
    data = await upstream.json();
  } catch {
    return sendJson(res, 502, {
      ok: false,
      error: 'The booking service returned an unexpected response.',
    });
  }

  if (!data || typeof data !== 'object') {
    return sendJson(res, 502, {
      ok: false,
      error: 'The booking service returned an unexpected response.',
    });
  }

  const payload = data as { ok?: unknown; error?: unknown; booking?: unknown; rows?: unknown; headers?: unknown };
  const upstreamOk = upstream.ok;
  const confirmed = payload.ok === true;

  // Only report success when the backend confirms it.
  if (!upstreamOk) {
    return sendJson(res, 502, {
      ok: false,
      error: 'Could not reach the booking service. Please try again later.',
    });
  }

  if (confirmed) {
    return sendJson(res, 200, {
      ok: true,
      booking: payload.booking,
      rows: payload.rows,
      headers: payload.headers,
    });
  }

  return sendJson(res, 422, {
    ok: false,
    error: typeof payload.error === 'string' ? payload.error : 'Your request could not be submitted.',
  });
}