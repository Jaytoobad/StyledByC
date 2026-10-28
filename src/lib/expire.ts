/**
 * StyledByC — Expiry helper.
 *
 * Marks approved_awaiting_payment bookings whose payment deadline has passed
 * as expired. Safe to call repeatedly.
 */

import { and, eq, lt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { bookings } from '../db/schema.js';

export async function expireOverdue(): Promise<number> {
  const now = new Date();
  const result = await db
    .update(bookings)
    .set({ status: 'expired', updatedAt: now })
    .where(
      and(
        eq(bookings.status, 'approved_awaiting_payment'),
        lt(bookings.paymentDeadline, now),
      ),
    )
    .returning({ ref: bookings.ref });

  return result.length;
}
