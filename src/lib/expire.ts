/**
 * StyledByC - Expiry helper.
 *
 * Marks approved_awaiting_payment bookings whose payment deadline has passed
 * as expired. Safe to call repeatedly.
 */

import { and, eq, lt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { bookings } from '../db/schema.js';
import { BOOKING_STATUS } from './status.js';

export const PAYMENT_GRACE_MS = 5 * 60 * 1000;

export async function expireOverdue(): Promise<number> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - PAYMENT_GRACE_MS);
  const result = await db
    .update(bookings)
    .set({ status: BOOKING_STATUS.expired, updatedAt: now })
    .where(
      and(
        eq(bookings.status, BOOKING_STATUS.approved_awaiting_payment),
        lt(bookings.paymentDeadline, cutoff),
      ),
    )
    .returning({ ref: bookings.ref });

  return result.length;
}

export function isExpired(row: any, now: Date = new Date()): boolean {
  if (!row) return false;
  if (row.status === BOOKING_STATUS.expired) return true;
  if (row.status === BOOKING_STATUS.approved_awaiting_payment && row.paymentDeadline) {
    const d = new Date(row.paymentDeadline);
    if (d.getTime() + PAYMENT_GRACE_MS < now.getTime()) return true;
  }
  return false;
}

export async function expireIfNeeded(bookingId: string): Promise<void> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - PAYMENT_GRACE_MS);
  try {
    await db
      .update(bookings)
      .set({ status: BOOKING_STATUS.expired, updatedAt: now })
      .where(
        and(
          eq(bookings.id, bookingId),
          eq(bookings.status, BOOKING_STATUS.approved_awaiting_payment),
          lt(bookings.paymentDeadline, cutoff),
        ),
      );
  } catch (e) {
    console.error('[expire] lazy expire failed:', e);
  }
}

export function isPastDeadlineWithGrace(row: any, now: Date = new Date()): boolean {
  if (!row || !row.paymentDeadline) return false;
  const d = new Date(row.paymentDeadline);
  return now.getTime() > d.getTime() + PAYMENT_GRACE_MS;
}
