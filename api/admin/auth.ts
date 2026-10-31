/**
 * StyledByC — Admin authentication dispatcher.
 *
 * Single entry point for /api/admin/auth/:action (login, logout, me).
 * Replaces the separate login.ts, logout.ts, and me.ts serverless functions.
 *
 * All endpoints use HttpOnly cookie-based authentication. Login creates a
 * session; logout invalidates it; me validates it. CSRF double-submit
 * protection applies to state-changing actions (logout). Login is exempt
 * because it establishes the session (no prior token exists).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { adminUsers, adminSessions } from '../../src/db/schema.js';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { getCookie, validateCsrf } from '../_lib/admin-auth.js';

const MAX_BODY_BYTES = 64 * 1024;
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string,string> = {}): void {
  res.statusCode = status;
  for (const [k,v] of Object.entries(headers)) res.setHeader(k,v);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
    const salt = parts[1];
    const expected = Buffer.from(parts[2], 'hex');
    const derived = scryptSync(password, salt, 64);
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch { return false; }
}

export { verifyPassword };

function isProd(req: IncomingMessage): boolean {
  const host = req.headers.host ?? '';
  return !host.includes('localhost') && !host.includes('127.0.0.1');
}

function getAction(req: IncomingMessage): string | null {
  const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
  const action = url.searchParams.get('action');
  if (action) return action.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);
  // pathname: ['api','admin','auth'] or ['api','admin','auth',':action']
  if (parts.length >= 4) return (parts[3] || '').toLowerCase() || null;
  return null;
}

function setAuthCookies(res: ServerResponse, sessionToken: string | null, csrfToken: string | null, maxAge: number, secure: boolean): void {
  const secureFlag = secure ? '; Secure' : '';
  const sessionCookie = sessionToken
    ? `admin_session=${sessionToken}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secureFlag}`
    : `admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureFlag}`;
  const csrfCookie = csrfToken
    ? `XSRF-TOKEN=${csrfToken}; SameSite=Strict; Path=/; Max-Age=${maxAge}${secureFlag}`
    : `XSRF-TOKEN=; SameSite=Strict; Path=/; Max-Age=0${secureFlag}`;
  res.setHeader('Set-Cookie', [sessionCookie, csrfCookie]);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const method = (req.method || 'GET').toUpperCase();
  const action = getAction(req);

  if (action === 'login') {
    if (method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
    }
    let input: any;
    try {
      const raw = await readBody(req);
      if (!raw) return sendJson(res, 400, { ok: false, error: 'The request body is empty.' });
      input = JSON.parse(raw);
    } catch {
      return sendJson(res, 400, { ok: false, error: 'The request body could not be read.' });
    }
    const email = String(input.email || '').trim().toLowerCase();
    const password = String(input.password || '');
    if (!email || !password) {
      return sendJson(res, 400, { ok: false, error: 'Email and password required.' });
    }
    try {
      const [user] = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
      if (!user) return sendJson(res, 401, { ok: false, error: 'Invalid credentials.' });
      if (!verifyPassword(password, user.passwordHash)) {
        return sendJson(res, 401, { ok: false, error: 'Invalid credentials.' });
      }
      const token = randomBytes(32).toString('hex');
      const csrfToken = randomBytes(16).toString('hex');
      const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
      await db.insert(adminSessions).values({ userId: user.id, tokenHash: token, expiresAt });
      const secure = isProd(req);
      setAuthCookies(res, token, csrfToken, SESSION_MAX_AGE, secure);
      return sendJson(res, 200, { ok: true });
    } catch (e) {
      console.error('[admin/auth/login] error:', e);
      return sendJson(res, 500, { ok: false, error: 'Login failed.' });
    }
  }

  if (action === 'logout') {
    if (method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
    }
    const csrf = validateCsrf(req);
    if (csrf.ok === false) {
      return sendJson(res, 403, { ok: false, error: csrf.error });
    }
    const token = getCookie(req, 'admin_session');
    if (token) {
      try { await db.delete(adminSessions).where(eq(adminSessions.tokenHash, token)); } catch {}
    }
    const secure = isProd(req);
    setAuthCookies(res, null, null, 0, secure);
    return sendJson(res, 200, { ok: true });
  }

  if (action === 'me') {
    if (method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
    }
    const token = getCookie(req, 'admin_session');
    if (!token) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    try {
      const [sess] = await db.select().from(adminSessions).where(eq(adminSessions.tokenHash, token)).limit(1);
      if (!sess || new Date(sess.expiresAt) <= new Date()) {
        return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
      }
      const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, sess.userId)).limit(1);
      if (!user) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
      return sendJson(res, 200, { ok: true, user: { id: user.id, email: user.email } });
    } catch { return sendJson(res, 401, { ok: false, error: 'Unauthorized' }); }
  }

  return sendJson(res, 404, { ok: false, error: 'Not found.' });
}


