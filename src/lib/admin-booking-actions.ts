const REJECTABLE_BOOKING_STATUSES = new Set([
  'pending_approval',
  'needs_info',
  'approved_awaiting_payment',
  'paid_needs_attention',
]);

export function canApproveAdminBooking(status: string): boolean {
  return status === 'pending_approval';
}

export function canRejectOrCancelAdminBooking(status: string): boolean {
  return REJECTABLE_BOOKING_STATUSES.has(status);
}
