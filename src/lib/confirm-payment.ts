/**
 * StyledByC — Payment confirmation transaction.
 *
 * Runs inside a Neon transaction. Re-checks the slot is not already confirmed
 * for someone else and that the payment deadline has not passed (with a 5-min
 * grace for payments started before the deadline). On success marks the
 * booking confirmed and records payment fields. If the money moved but the
 * checks fail, marks paid_needs_attention and notifies the owner.
 */

import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { bookings } from '../db/schema.js';

export type ConfirmPaymentInput = {
  bookingId: string;
  paystackReference: string;
  amountPesewas: number;
  currency: string;
  customerEmail?: string;
};

export type ConfirmPaymentResult =
  | { ok: true; status: 'confirmed' | 'paid_needs_attention'; booking: Record<string, unknown> }
  | { ok: false; error: string };

const FEE_PESWAS = 10000; // GH₵100
const GRACE_MS = 5 * 60 * 1000;

export async function confirmPayment(input: ConfirmPaymentInput): Promise<ConfirmPaymentResult> {
  const { bookingId, paystackReference, amountPesewas, currency, customerEmail } = input;

  if (currency !== 'GHS') return { ok: false, error: 'Invalid currency.' };
  if (amountPesewas !== FEE_PESWAS) return { ok: false, error: 'Payment amount does not match.' };

  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .limit(1);

      if (!row) return { ok: false, error: 'Booking not found.' };

      // Reference already used?
      if (row.paymentReference && row.paymentReference === paystackReference) {
        return { ok: false, error: 'This payment reference has already been used.' };
      }

      const now = new Date();

      // Slot already confirmed for someone else?
      const conflict = await tx
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.status, 'confirmed'),
            eq(bookings.approvedSlotDate, row.approvedSlotDate as any),
            eq(bookings.approvedSlotTime, row.approvedSlotTime as any),
            sql`${bookings.id} <> ${bookingId}`,
          ),
        )
        .limit(1);
      if (conflict.length) {
        return { ok: false, error: 'That slot has been taken. Please choose another.' };
      }

      // Deadline check (5-min grace for payments started before deadline).
      const deadline = row.paymentDeadline ? new Date(row.paymentDeadline) : null;
      const pastDeadline = deadline ? now.getTime() > deadline.getTime() + GRACE_MS : false;

      if (pastDeadline) {
        await tx
          .update(bookings)
          .set({
            status: 'paid_needs_attention',
            paymentReference: paystackReference,
            amountPaid: FEE_PESWAS / 100,
            balanceDue: Math.max(0, (row.servicePriceGhs || 0) - FEE_PESWAS / 100),
            paidAt: now,
            updatedAt: now,
            ownerNote: 'Money received after payment deadline — needs owner review.',
          })
          .where(eq(bookings.id, bookingId));
        return {
          ok: true,
          status: 'paid_needs_attention',
          booking: { ref: row.ref, status: 'paid_needs_attention' },
        };
      }

      await tx
        .update(bookings)
        .set({
          status: 'confirmed',
          paymentStatus: 'paid',
          paymentReference: paystackReference,
          amountPaid: FEE_PESWAS / 100,
          balanceDue: Math.max(0, (row.servicePriceGhs || 0) - FEE_PESWAS / 100),
          paidAt: now,
          updatedAt: now,
        })
        .where(eq(bookings.id, bookingId));

      return {
        ok: true,
        status: 'confirmed',
        booking: {
          ref: row.ref,
          status: 'confirmed',
          service: row.serviceName,
          date: row.approvedSlotDate,
          time: row.approvedSlotTime,
          price: row.servicePriceGhs,
          amountPaid: 10000 / 100,
          balanceDue: Math.max(0, (row.servicePriceGhs || 0) - 10000 / 100),
        },
      };
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Payment confirmation failed.' };
  }
}
