/**
 * StyledByC — Postgres-backed fixed-window rate limiter.
 *
 * Serverless functions are stateless across instances, so an in-memory map
 * does not enforce limits in production. This stores one counter row per
 * (identifier, time window) in Neon, so limits hold globally regardless of
 * how many Vite/Vercel instances are running. The table self-provisions with
 * `CREATE TABLE IF NOT EXISTS` on first use so no separate migration step is
 * required; the companion `drizzle/0009_rate_limits.sql` migration records
 * the intended schema for versioned deploys.
 *
 * Fails open: if the database is unavailable the request is allowed through
 * rather than blocking legitimate users.
 */
import { sql } from 'drizzle-orm';
import { db } from '../../src/db/index.js';

const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  limit: number;
  retryAfter?: number;
};

function windowStartAt(now: number, windowMs: number): Date {
  return new Date(Math.floor(now / windowMs) * windowMs);
}

async function ensureTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS rate_limits (
      id text PRIMARY KEY,
      count integer NOT NULL DEFAULT 0,
      window_start timestamp with time zone NOT NULL,
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    )
  `);
}

let ensured = false;

/**
 * Increment the counter for `identifier` within the current fixed window and
 * report whether the `limit` is still respected.
 */
export async function checkRateLimit(
  identifier: string,
  limit: number,
  options: { windowMs?: number } = {},
): Promise<RateLimitResult> {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const now = Date.now();
  const start = windowStartAt(now, windowMs);

  if (!ensured) {
    try {
      await ensureTable();
      ensured = true;
    } catch (e) {
      console.error('[rate-limit] table ensure failed, failing open:', e);
      return { allowed: true, count: 0, limit };
    }
  }

  try {
    const updated = await db.execute(sql`
      UPDATE rate_limits
      SET count = count + 1, updated_at = now()
      WHERE id = ${identifier} AND window_start = ${start}
      RETURNING count
    `);
    const rows = (updated as { rows?: unknown[] }).rows ?? [];
    let count: number;
    if (rows.length > 0) {
      count = Number((rows[0] as { count?: unknown }).count ?? 1);
    } else {
      const inserted = await db.execute(sql`
        INSERT INTO rate_limits (id, count, window_start)
        VALUES (${identifier}, 1, ${start})
        ON CONFLICT (id) DO UPDATE
        SET count = 1, window_start = ${start}, updated_at = now()
        WHERE rate_limits.window_start <> ${start}
        RETURNING count
      `);
      const insRows = (inserted as { rows?: unknown[] }).rows ?? [];
      count = insRows.length > 0 ? Number((insRows[0] as { count?: unknown }).count ?? 1) : 1;
    }

    const allowed = count <= limit;
    const retryAfter = allowed ? undefined : windowMs - (now % windowMs);
    return { allowed, count, limit, retryAfter };
  } catch (e) {
    console.error('[rate-limit] check failed, failing open:', e);
    return { allowed: true, count: 0, limit };
  }
}
