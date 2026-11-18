/**
 * StyledByC â€” Admin authentication dispatcher.
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
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { db } from '../../src/db/index.js';
import { adminUsers, adminSessions } from '../../src/db/schema.js';
import { getCookie, validateCsrf } from '../_lib/admin-auth.js';
import {
  checkLoginRateLimit,
  recordLoginAttempt,
  cleanupExpiredSessions,
} from '../_lib/login-rate-limit.js';
import { env } from '../_lib/env.js';

const MAX_BODY_BYTES = 64 * 1024;
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  res.statusCode = status;
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
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

function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
    const salt = parts[1];
    const expected = Buffer.from(parts[2], 'hex');
    const derived = scryptSync(password, salt, 64);
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export { verifyPassword };

function isProd(req: IncomingMessage): boolean {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === 'production') return true;
  if (vercelEnv === 'preview' || vercelEnv === 'development') return false;
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

function setAuthCookies(
  res: ServerResponse,
  sessionToken: string | null,
  csrfToken: string | null,
  maxAge: number,
  secure: boolean,
): void {
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
    const email = String(input.email || '')
      .trim()
      .toLowerCase();
    const password = String(input.password || '');
    if (!email || !password) {
      return sendJson(res, 400, { ok: false, error: 'Email and password required.' });
    }
    try {
      await cleanupExpiredSessions();
      const rl = await checkLoginRateLimit(req, email);
      if (!rl.ok) {
        res.setHeader('Retry-After', String(rl.retryAfter || 900));
        return sendJson(res, 429, {
          ok: false,
          error: 'Too many login attempts. Try again later.',
        });
      }
      const [user] = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
      if (!user) {
        await recordLoginAttempt(req, email, false);
        return sendJson(res, 401, { ok: false, error: 'Invalid credentials.' });
      }
      if (!verifyPassword(password, user.passwordHash)) {
        await recordLoginAttempt(req, email, false);
        return sendJson(res, 401, { ok: false, error: 'Invalid credentials.' });
      }
      await recordLoginAttempt(req, email, true, user.id);
      const token = randomBytes(32).toString('hex');
      const csrfToken = randomBytes(16).toString('hex');
      const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
      const tokenHash = scryptSync(token, env.SESSION_TOKEN_SALT, 64).toString('hex');
      await db.insert(adminSessions).values({ userId: user.id, tokenHash, expiresAt });
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
      try {
        const tokenHash = scryptSync(token, env.SESSION_TOKEN_SALT, 64).toString('hex');
        await db.delete(adminSessions).where(eq(adminSessions.tokenHash, tokenHash));
      } catch (error) {
        console.error('[admin/auth] session cleanup failed during logout:', error);
      }
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
      const tokenHash = scryptSync(token, env.SESSION_TOKEN_SALT, 64).toString('hex');
      const [sess] = await db
        .select()
        .from(adminSessions)
        .where(eq(adminSessions.tokenHash, tokenHash))
        .limit(1);
      if (!sess || new Date(sess.expiresAt) <= new Date()) {
        return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
      }
      const [user] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, sess.userId))
        .limit(1);
      if (!user) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
      return sendJson(res, 200, { ok: true, user: { id: user.id, email: user.email } });
    } catch (error) {
      console.error('[admin/auth] session lookup failed:', error);
      return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    }
  }

  return sendJson(res, 404, { ok: false, error: 'Not found.' });
}
