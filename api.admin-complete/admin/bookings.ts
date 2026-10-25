/**
 * StyledByC — Vercel serverless proxy for booking submissions.
 *
 * The browser cannot POST directly to the Google Apps Script web app because
 * the Apps Script response lacks the CORS headers the browser requires. This
 * function accepts POSTs to the same-origin /api/admin/bookings route, validates the
 * payload, and forwards it server-side to the configured Apps Script endpoint.
 *
 * The upstream destination is read ONLY from the server-side environment
 * variable APPS_SCRIPT_URL. It is never exposed to browser code and callers
 * cannot choose an arbitrary destination.
 *
 * Apps Script remains the single source of truth: it re-validates the service
 * and price, checks availability, locks slots, sets the booking status and sends
 * emails. This function does not create a second booking record.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

// Maximum accepted request body size. ~256 KB is far more than a booking form
// needs and limits abuse without affecting legitimate submissions.
const MAX_BODY_BYTES = 256 * 1024;

// Read once at runtime from the server-side environment. Never from the client.
type BookingInput = {
  serviceId?: unknown;
  date?: unknown;
  time?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  note?: unknown;
};

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function looksLikeDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function looksLikeTime(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

// Minimal pre-check for a better UX. Apps Script re-validates authoritatively.
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return ['The request body is invalid.'];
  }
  const b = input as BookingInput;
  if (!isString(b.serviceId) || !b.serviceId.trim())
    errors.push('Please choose a valid service.');
  if (!isString(b.date) || !looksLikeDate(b.date))
    errors.push('Please choose a valid appointment date.');
  if (!isString(b.time) || !looksLikeTime(b.time))
    errors.push('Please choose a valid appointment time.');
  if (!isString(b.name) || !b.name.trim())
    errors.push('Please enter your full name.');
  if (!isString(b.email) || !/^\S+@\S+\.\S+$/.test(b.email))
    errors.push('Please enter a valid email address.');
  if (!isString(b.phone) || b.phone.trim().length < 7)
    errors.push('Please enter a valid phone number.');
  return errors;
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

  // --- Forward to Apps Script ----------------------------------------------
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  let upstream: Response;
  try {
    upstream = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(input),
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
