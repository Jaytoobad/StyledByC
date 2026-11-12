/**
 * StyledByC — admin session authorization.
 *
 * Server-side only. Access is granted solely through the HttpOnly
 * `admin_session` cookie issued by /api/admin/auth/login. CSRF protection
 * uses the double-submit cookie pattern: the `XSRF-TOKEN` cookie (readable by
 * JS) must be echoed as the `X-XSRF-TOKEN` header on state-changing requests.
 * The obsolete bearer-token paths (x-admin-token header, ADMIN_API_TOKEN
 * environment variable, body token) are intentionally not supported here.
 *
 * Session tokens are hashed with scrypt before storage so a database leak
 * does not expose valid session tokens.
 */
import type { IncomingMessage } from 'node:http';
import { eq } from 'drizzle-orm';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { db } from '../../src/db/index.js';
import { adminSessions, adminUsers } from '../../src/db/schema.js';
import { env } from './env.js';

export type AdminAuth = {
  authorized: boolean;
  userId?: string;
  email?: string;
}

const TOKEN_SALT = env.SESSION_TOKEN_SALT;

function hashToken(token: string): Buffer {
  return scryptSync(token, TOKEN_SALT, 64);
}

function tokensEqual(a: string, b: Buffer): boolean {
  const expected = Buffer.from(b);
  const derived = hashToken(a);
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export function getCookie(req: IncomingMessage, name: string): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [k, v] = part.trim().split('=');
    if (k === name) {
      try {
        return decodeURIComponent(v || '');
      } catch {
        return v || null;
      }
    }
  }
  return null;
}

export async function authorize(req: IncomingMessage): Promise<AdminAuth> {
  const sessionToken = getCookie(req, 'admin_session');
  if (sessionToken) {
    try {
      const hashed = hashToken(sessionToken);
      const [sess] = await db.select().from(adminSessions).where(eq(adminSessions.tokenHash, hashed.toString('hex'))).limit(1);
      if (sess && new Date(sess.expiresAt) > new Date()) {
        const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, sess.userId)).limit(1);
        if (user) {
          return { authorized: true, userId: user.id, email: user.email };
        }
      }
    } catch {
      // fail closed
    }
  }
  return { authorized: false };
}

export function validateCsrf(req: IncomingMessage): { ok: true } | { ok: false; error: string } {
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return { ok: true };
  }

  const cookieToken = getCookie(req, 'XSRF-TOKEN');
  const headerToken = (req.headers['x-xsrf-token'] as string | undefined)?.trim() || '';

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return { ok: false, error: 'CSRF token mismatch.' };
  }
  return { ok: true };
}
