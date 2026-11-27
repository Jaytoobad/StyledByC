import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  availabilityCoversBooking,
  bookingSlotEndTime,
  isAllowedBookingTime,
} from '../src/lib/booking-slots.js';
import { isBlockedMonth } from '../src/config/booking.js';

describe('restricted booking slots', () => {
  it('allows only the two owner-approved start times', () => {
    assert.strictEqual(isAllowedBookingTime('13:30'), true);
    assert.strictEqual(isAllowedBookingTime('15:30'), true);
    assert.strictEqual(isAllowedBookingTime('13:00'), false);
    assert.strictEqual(isAllowedBookingTime('14:30'), false);
  });

  it('covers the 1:30 PM appointment with contiguous open hourly intervals', () => {
    assert.strictEqual(
      availabilityCoversBooking('13:30', [
        { startTime: '13:00', endTime: '14:00' },
        { startTime: '14:00', endTime: '15:00' },
      ]),
      true,
    );
  });

  it('covers the 3:30 PM appointment with contiguous open hourly intervals', () => {
    assert.strictEqual(
      availabilityCoversBooking('15:30', [
        { startTime: '15:00', endTime: '16:00' },
        { startTime: '16:00', endTime: '17:00' },
      ]),
      true,
    );
  });

  it('rejects closed gaps and unsupported times', () => {
    assert.strictEqual(
      availabilityCoversBooking('13:30', [
        { startTime: '13:00', endTime: '14:00' },
        { startTime: '14:30', endTime: '15:00' },
      ]),
      false,
    );
    assert.strictEqual(
      availabilityCoversBooking('14:00', [{ startTime: '14:00', endTime: '16:00' }]),
      false,
    );
  });

  it('returns the one-hour end time for each allowed start', () => {
    assert.strictEqual(bookingSlotEndTime('13:30'), '14:30');
    assert.strictEqual(bookingSlotEndTime('15:30'), '16:30');
    assert.throws(() => bookingSlotEndTime('14:00'));
  });
});

describe('blocked months (December unavailability)', () => {
  it('blocks December dates', () => {
    assert.strictEqual(isBlockedMonth('2026-12-01'), true);
    assert.strictEqual(isBlockedMonth('2026-12-25'), true);
    assert.strictEqual(isBlockedMonth('2026-12-31'), true);
  });

  it('does not block November or January dates', () => {
    assert.strictEqual(isBlockedMonth('2026-11-27'), false);
    assert.strictEqual(isBlockedMonth('2026-11-30'), false);
    assert.strictEqual(isBlockedMonth('2027-01-01'), false);
    assert.strictEqual(isBlockedMonth('2027-01-15'), false);
  });

  it('rejects invalid date strings', () => {
    assert.strictEqual(isBlockedMonth('not-a-date'), false);
    assert.strictEqual(isBlockedMonth(''), false);
  });
});
