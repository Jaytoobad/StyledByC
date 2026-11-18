/**
 * StyledByC - Timezone rule (Ghana, UTC+0, no DST).
 *
 * ALL date comparisons in this codebase MUST treat calendar dates as UTC.
 * The pattern is:
 *   - A calendar date string "YYYY-MM-DD" is parsed as `new Date(`${s}T00:00:00Z`)`
 *     (UTC midnight), never `new Date(`${s}T00:00:00`)` (local).
 *   - "Start of day" / "end of day" ranges are built with `setUTCHours(0,0,0,0)`
 *     and `setUTCHours(23,59,59,999)` or `+1 day` on the UTC date, never the
 *     local `setHours`.
 *   - `paymentDeadline` is stored as a `timestamp with timezone` (Postgres
 *     TIMESTAMPTZ). Comparisons use `getTime()` (epoch ms, timezone-safe).
 *   - Display labels (money.ts) may use `toLocale*` for the customer only;
 *     they must never feed back into a WHERE clause or a status decision.
 *
 * Never use `Date.now()`-based local midnight (`today.setHours(0,0,0,0)`) for
 * a booking-window comparison — it silently breaks in non-UTC timezones.
 */

export function startOfDayUTC(d: Date = new Date()): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export function endOfDayUTC(d: Date = new Date()): Date {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

export function addDaysUTC(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

export function parseDateUTC(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}
