import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { adminAuditLogs, adminSessions } from '../../src/db/schema.js';
import { shouldBlockLogin } from './login-rate-limit-core.js';

function getClientIp(req: any): string {
  const fwd = req.headers && req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') {
    const first = fwd.split(',')[0];
    if (first) return first.trim();
  }
  if (req.socket && req.socket.remoteAddress) return req.socket.remoteAddress;
  return 'unknown';
}

export async function checkLoginRateLimit(req: any, email: string): Promise<{ ok: boolean; retryAfter?: number }> {
  try {
    const ip = getClientIp(req);
    const emailNorm = (email || '').toLowerCase().trim();
    const since = new Date(Date.now() - 15 * 60 * 1000);

    const ipCountRes = await db
      .select({ c: sql<number>`count(*)` })
      .from(adminAuditLogs)
      .where(
        and(
          eq(adminAuditLogs.action, 'login_failed'),
          sql`${adminAuditLogs.details}->>'ip' = ${ip}`,
          gte(adminAuditLogs.createdAt, since),
        ),
      );

    const emailCountRes = await db
      .select({ c: sql<number>`count(*)` })
      .from(adminAuditLogs)
      .where(
        and(
          eq(adminAuditLogs.action, 'login_failed'),
          eq(adminAuditLogs.targetRef, emailNorm),
          gte(adminAuditLogs.createdAt, since),
        ),
      );

    const ipCount = Number((ipCountRes[0] as any)?.c ?? 0);
    const emailCount = Number((emailCountRes[0] as any)?.c ?? 0);

    if (shouldBlockLogin(ipCount, emailCount)) {
      return { ok: false, retryAfter: 900 };
    }
    return { ok: true };
  } catch (e) {
    console.error('[login-rate-limit] check failed:', e);
    return { ok: true };
  }
}

export async function recordLoginAttempt(req: any, email: string, success: boolean) {
  try {
    const ip = getClientIp(req);
    const emailNorm = (email || '').toLowerCase().trim();
    await db.insert(adminAuditLogs).values({
      actorId: null,
      actorEmail: success ? emailNorm : null,
      action: success ? 'login_success' : 'login_failed',
      targetType: 'admin',
      targetRef: emailNorm || null,
      details: { ip, email: emailNorm } as any,
    });
  } catch (e) {
    console.error('[login-rate-limit] record failed:', e);
  }
}

export async function cleanupExpiredSessions() {
  try {
    const now = new Date();
    await db.delete(adminSessions).where(sql`${adminSessions.expiresAt} <= ${now}`);
  } catch (e) {
    console.error('[login-rate-limit] cleanup failed:', e);
  }
}
