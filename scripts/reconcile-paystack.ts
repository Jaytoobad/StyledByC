#!/usr/bin/env ts-node
/**
 * StyledByC - Paystack reconcile (READ-ONLY).
 *
 * For every booking that has a payment_reference but is NOT paid/confirmed,
 * calls Paystack's verify endpoint for that reference and prints:
 *   booking_ref | paystack_status | amount | should_mark_paid
 *
 * It NEVER updates anything. Run it manually when the webhook path looks stuck.
 * Requires PAYSTACK_SECRET_KEY in the environment.
 */

import { db } from '../src/db/index.js';
import { bookings } from '../src/db/schema.js';
import { eq, or } from 'drizzle-orm';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';
const BASE = 'https://api.paystack.co';

if (!PAYSTACK_SECRET) {
  console.error('PAYSTACK_SECRET_KEY is required.');
  process.exit(1);
}

async function verify(reference: string): Promise<any> {
  const res = await fetch(`${BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
  });
  if (!res.ok) return { ok: false, status: res.status };
  const json = await res.json();
  return json;
}

async function main() {
  const rows = await db
    .select()
    .from(bookings)
    .where(
      or(eq(bookings.paymentStatus, 'unpaid'), eq(bookings.status, 'approved_awaiting_payment')),
    );

  for (const row of rows) {
    const ref = (row as any).paymentReference;
    if (!ref) continue;
    const data = await verify(ref);
    const tx = data?.data || {};
    const paystackStatus = String(tx.status || '');
    const amount = Number(tx.amount || 0);
    const currency = String(tx.currency || '');
    const shouldMarkPaid = paystackStatus === 'success' && currency === 'GHS';
    console.log({
      booking_ref: row.ref,
      paystack_status: paystackStatus,
      amount,
      currency,
      should_mark_paid: shouldMarkPaid,
    });
    // Small delay between calls to avoid rate limits.
    await new Promise((r) => setTimeout(r, 300));
  }
}

main().catch((e) => {
  console.error('reconcile failed:', e);
  process.exit(1);
});
