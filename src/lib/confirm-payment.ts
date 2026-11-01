/**
 * StyledByC - Payment confirmation (race-safe, no interactive transaction).
 */

import { and, eq, ne, or, sql, gt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { bookings } from '../db/schema.js';
import { PAYMENT_GRACE_MS } from './expire.js';
import { RESERVATION_FEE_GHS } from '../config/booking.js';
import { BOOKING_STATUS } from './status.js';

export type ConfirmPaymentInput = {
  bookingId: string;
  paystackReference: string;
  amountPesewas: number;
  currency: string;
  customerEmail?: string;
};

export type ConfirmPaymentResult =
  | { ok: true; status: 'confirmed' | 'paid_needs_attention'; booking: Record<string, unknown>; alreadyRecorded?: boolean; duplicatePayment?: boolean }
  | { ok: false; error: string };

const FEE_PESWAS = Math.round((RESERVATION_FEE_GHS || 100) * 100);

function getPgErrorCode(err: any): string | undefined {
  if (!err) return undefined;
  if (typeof err.code === 'string') return err.code;
  if (err.cause && typeof err.cause.code === 'string') return err.cause.code;
  return undefined;
}

function isHeldSlotUniqueViolation(err: any): boolean {
  const code = getPgErrorCode(err);
  if (code === '23505') {
    return true;
  }
  const msg = (err?.message || err?.cause?.message || '').toString().toLowerCase();
  return msg.includes('duplicate key value') || msg.includes('held_slot');
}

export async function confirmPayment(input: ConfirmPaymentInput): Promise<ConfirmPaymentResult> {
  const { bookingId, paystackReference, amountPesewas, currency } = input;

  if (currency !== 'GHS') {
    // Money was taken; record for owner review instead of returning an error.
    return recordNeedsAttention(bookingId, paystackReference, amountPesewas, 'Invalid currency - expected GHS.');
  }
  if (amountPesewas < FEE_PESWAS) {
    // Money was taken but below the configured fee; record for owner review.
    return recordNeedsAttention(bookingId, paystackReference, amountPesewas, 'Payment amount is below the reservation fee.');
  }

  const now = new Date();
  const amountPaidInt = Math.round(amountPesewas / 100);
  const graceCutoff = new Date(now.getTime() - PAYMENT_GRACE_MS);

  try {
    try {
      const updated = await db
        .update(bookings)
        .set({
          status: BOOKING_STATUS.confirmed,
          paymentStatus: 'paid',
          paymentReference: paystackReference,
          amountPaid: amountPaidInt,
          balanceDue: sql`GREATEST(0, ${bookings.servicePriceGhs} - ${amountPaidInt})`,
          paidAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(bookings.id, bookingId),
            ne(bookings.paymentStatus, 'paid'),
            or(
              and(
                eq(bookings.status, BOOKING_STATUS.approved_awaiting_payment),
                sql`${bookings.paymentDeadline} IS NOT NULL`,
                gt(bookings.paymentDeadline, graceCutoff),
              ),
              and(
                eq(bookings.status, BOOKING_STATUS.expired),
                sql`${bookings.paymentDeadline} IS NOT NULL`,
                gt(bookings.paymentDeadline, graceCutoff),
              ),
            ),
          ),
        )
        .returning();

      if (updated.length > 0) {
        const row: any = updated[0];
        return {
          ok: true,
          status: 'confirmed',
          booking: {
            ref: row.ref,
            status: BOOKING_STATUS.confirmed,
            service: row.serviceName,
            date: row.approvedSlotDate,
            time: row.approvedSlotTime,
            price: row.servicePriceGhs,
            amountPaid: amountPaidInt,
            balanceDue: Math.max(0, (row.servicePriceGhs || 0) - amountPaidInt),
          },
        };
      }
    } catch (e: any) {
      if (isHeldSlotUniqueViolation(e)) {
        // fall through to needs-attention path
      } else {
        console.error('[confirm-payment] update error:', getPgErrorCode(e) || e?.message);
        return { ok: false, error: 'Payment confirmation failed.' };
      }
    }

    const [row] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    if (!row) return { ok: false, error: 'Booking not found.' };

    const r: any = row;

    if (r.paymentStatus === 'paid') {
      if (r.paymentReference && r.paymentReference === paystackReference) {
        return {
          ok: true,
          status: r.status,
          booking: { ref: r.ref, status: r.status },
          alreadyRecorded: true,
        };
      }
      // Already paid with a DIFFERENT reference.
      console.error('[confirm-payment] duplicate payment: existing=%s new=%s', r.paymentReference, paystackReference);
      const extra = `Duplicate payment reference ${paystackReference} (existing ${r.paymentReference}).`;
      try {
        await db
          .update(bookings)
          .set({
            ownerNote: sql`COALESCE(${bookings.ownerNote}, '') || E'${extra.replace(/'/g, "''")}'`,
            updatedAt: now,
          })
          .where(eq(bookings.id, bookingId));
      } catch (e: any) {
        console.error('[confirm-payment] duplicate note append failed:', getPgErrorCode(e) || e?.message);
      }
      return {
        ok: true,
        status: r.status,
        booking: { ref: r.ref, status: r.status },
        duplicatePayment: true,
      };
    }

    let reason = 'Payment received but could not be confirmed.';
    const status = r.status;
    if (status === BOOKING_STATUS.rejected || status === BOOKING_STATUS.cancelled) {
      reason = 'Payment received for a rejected or cancelled booking.';
    } else if (status === BOOKING_STATUS.approved_awaiting_payment || status === BOOKING_STATUS.expired) {
      const dl = r.paymentDeadline ? new Date(r.paymentDeadline) : null;
      if (dl && now.getTime() > dl.getTime() + PAYMENT_GRACE_MS) {
        reason = 'Money received after the payment deadline.';
      } else {
        reason = 'Money received but the slot was taken or unavailable.';
      }
    } else {
      reason = 'Money received but the booking is not in a confirmable state.';
    }

    return recordNeedsAttention(bookingId, paystackReference, amountPaidInt, reason, r);
  } catch (err: any) {
    console.error('[confirm-payment] unexpected error:', getPgErrorCode(err) || err?.message);
    return { ok: false, error: 'Payment confirmation failed.' };
  }
}

async function recordNeedsAttention(
  bookingId: string,
  paystackReference: string,
  amountPaidInt: number,
  reason: string,
  row: any = null,
): Promise<ConfirmPaymentResult> {
  const now = new Date();
  try {
    if (!row) {
      const [r] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
      row = r;
    }
    if (!row) return { ok: false, error: 'Booking not found.' };
    const r: any = row;

    const slotDate = r.approvedSlotDate ? new Date(r.approvedSlotDate).toISOString().slice(0, 10) : '';
    const slotTime = r.approvedSlotTime || '';
    const slotPart = slotDate ? ` Original approved slot: ${slotDate} ${slotTime}`.trim() : '';
    const ownerNote = `${reason}${slotPart}`.trim();

    await db
      .update(bookings)
      .set({
        status: BOOKING_STATUS.paid_needs_attention,
        paymentStatus: 'paid',
        paymentReference: paystackReference,
        amountPaid: amountPaidInt,
        balanceDue: sql`GREATEST(0, ${bookings.servicePriceGhs} - ${amountPaidInt})`,
        paidAt: now,
        updatedAt: now,
        approvedSlotDate: null,
        approvedSlotTime: null,
        ownerNote: ownerNote.slice(0, 2000),
      })
      .where(and(eq(bookings.id, bookingId), ne(bookings.paymentStatus, 'paid')));

    return {
      ok: true,
      status: 'paid_needs_attention',
      booking: { ref: r.ref, status: BOOKING_STATUS.paid_needs_attention },
    };
  } catch (e: any) {
    console.error('[confirm-payment] paid_needs_attention update error:', getPgErrorCode(e) || e?.message);
    return { ok: false, error: 'Payment confirmation failed.' };
  }
}
