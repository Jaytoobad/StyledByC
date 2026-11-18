/**
 * StyledByC - confirmPayment test cases (DO NOT RUN unless ALLOW_TEST_DB=1).
 *
 * Refuses to run unless ALLOW_TEST_DB=1. Uses only booking refs starting
 * TEST- and removes them afterward. Prints only the database host.
 *
 * Cases:
 *   a) approved in time -> confirmed
 *   b) same reference again -> alreadyRecorded
 *   c) expired within grace -> confirmed
 *   d) beyond grace -> paid_needs_attention with NULL slot fields
 *   e) slot taken by another booking -> paid_needs_attention without crashing
 *   f) rejected booking -> paid_needs_attention
 *   g) amount below the fee -> paid_needs_attention
 *   h) second different reference on a paid booking -> duplicatePayment
 */
import { readFileSync } from 'node:fs';

function loadEnv() {
  try {
    const text = readFileSync('.env.local', 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].trim();
      }
    }
  } catch {
    /* ignore */
  }
}
loadEnv();

if (process.env.ALLOW_TEST_DB !== '1') {
  console.error('Refusing to run: set ALLOW_TEST_DB=1 to execute.');
  process.exit(2);
}

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';

const db = drizzle(neon(process.env.DATABASE_URL!));

async function q(query: string) {
  return (await db.execute(sql.raw(query))) as any;
}

async function _insertBooking(ref: string, status: string, opts: any = {}) {
  const now = new Date();
  const paymentDeadline = opts.paymentDeadline
    ? new Date(opts.paymentDeadline).toISOString()
    : new Date(now.getTime() + 30 * 60 * 1000).toISOString();
  await q(
    `insert into bookings (ref, status, name, email, phone, service_id, service_name,
      service_price_ghs, requested_date, requested_time, payment_status,
      payment_reference, amount_paid, balance_due, payment_deadline,
      approved_slot_date, approved_slot_time, pay_token, policy_accepted,
      policy_version, policy_accepted_at, created_at, updated_at)
     values ('${ref}', '${status}', 'Test User', 'test@example.com', '+233000000000',
      'svc-test', 'Test Service', ${opts.price ?? 100},
      '${opts.date ?? '2026-12-01'}', '${opts.time ?? '09:00'}',
      '${opts.paymentStatus ?? 'unpaid'}',
      ${opts.paymentReference ? "'" + opts.paymentReference + "'" : 'null'},
      ${opts.amountPaid ?? 0}, ${opts.balanceDue ?? opts.price ?? 100},
      '${paymentDeadline}',
      ${opts.approvedSlotDate ? "'" + opts.approvedSlotDate + "'" : 'null'},
      ${opts.approvedSlotTime ? "'" + opts.approvedSlotTime + "'" : 'null'},
      'paytoken-' + ref, true, 'v1', '${now.toISOString()}', '${now.toISOString()}')`,
  );
  const rows = await q(`select id from bookings where ref = '${ref}' limit 1`);
  return rows.rows[0].id;
}
