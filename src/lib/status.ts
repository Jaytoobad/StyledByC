/**
 * StyledByC - Shared booking / payment status constants.
 *
 * Derived from the schema enums in src/db/schema.ts. Never use string
 * literals for statuses outside this file; import the constant instead so a
 * rename in the DB enum cannot silently desynchronise the code.
 */

export const BOOKING_STATUS = {
  pending_approval: 'pending_approval',
  needs_info: 'needs_info',
  approved_awaiting_payment: 'approved_awaiting_payment',
  confirmed: 'confirmed',
  rejected: 'rejected',
  cancelled: 'cancelled',
  expired: 'expired',
  paid_needs_attention: 'paid_needs_attention',
} as const;

export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

export const PAYMENT_STATUS = {
  unpaid: 'unpaid',
  paid: 'paid',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const NOTIFICATION_STATUS = {
  sent: 'sent',
  failed: 'failed',
  unknown: 'unknown',
} as const;

export type NotificationStatus = (typeof NOTIFICATION_STATUS)[keyof typeof NOTIFICATION_STATUS];

export const IRRELEVANT_FOR_RESEND = [
  BOOKING_STATUS.expired,
  BOOKING_STATUS.cancelled,
  BOOKING_STATUS.rejected,
] as const;

export const CONFIRMABLE_STATUSES = [
  BOOKING_STATUS.approved_awaiting_payment,
  BOOKING_STATUS.expired,
] as const;

export const TAKEN_STATUSES = [
  BOOKING_STATUS.confirmed,
  BOOKING_STATUS.approved_awaiting_payment,
  BOOKING_STATUS.paid_needs_attention,
] as const;
