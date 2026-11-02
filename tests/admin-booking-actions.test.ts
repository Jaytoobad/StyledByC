import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canApproveAdminBooking,
  canRejectOrCancelAdminBooking,
} from '../src/lib/admin-booking-actions.js';

describe('admin booking actions', () => {
  it('only allows approval for pending bookings', () => {
    assert.equal(canApproveAdminBooking('pending_approval'), true);
    assert.equal(canApproveAdminBooking('approved_awaiting_payment'), false);
    assert.equal(canApproveAdminBooking('confirmed'), false);
  });

  it('allows rejection and cancellation only for statuses accepted by the API', () => {
    for (const status of [
      'pending_approval',
      'needs_info',
      'approved_awaiting_payment',
      'paid_needs_attention',
    ]) {
      assert.equal(canRejectOrCancelAdminBooking(status), true, status);
    }

    for (const status of ['confirmed', 'rejected', 'cancelled', 'expired']) {
      assert.equal(canRejectOrCancelAdminBooking(status), false, status);
    }
  });
});
