import { BOOKING_SLOT_DURATION_MINUTES, BOOKING_START_TIMES } from '../config/booking.js';

type AvailabilityInterval = {
  startTime: string;
  endTime: string;
};

function timeToMinutes(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(time);
  if (!match || (match[3] && match[3] !== '00')) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function isAllowedBookingTime(time: string): boolean {
  return BOOKING_START_TIMES.some((startTime) => startTime === time);
}

export function availabilityCoversBooking(
  time: string,
  intervals: AvailabilityInterval[],
): boolean {
  const start = timeToMinutes(time);
  if (start === null || !isAllowedBookingTime(time)) return false;

  const requiredEnd = start + BOOKING_SLOT_DURATION_MINUTES;
  const sortedIntervals = intervals
    .map((interval) => ({
      start: timeToMinutes(interval.startTime),
      end: timeToMinutes(interval.endTime),
    }))
    .filter((interval): interval is { start: number; end: number } =>
      interval.start !== null && interval.end !== null && interval.end > interval.start,
    )
    .sort((a, b) => a.start - b.start);

  let coveredUntil = start;
  for (const interval of sortedIntervals) {
    if (interval.end <= coveredUntil) continue;
    if (interval.start > coveredUntil) return false;
    coveredUntil = interval.end;
    if (coveredUntil >= requiredEnd) return true;
  }

  return false;
}

export function bookingSlotEndTime(time: string): string {
  const start = timeToMinutes(time);
  if (start === null || !isAllowedBookingTime(time)) {
    throw new Error('Cannot calculate an end time for an unsupported booking slot.');
  }
  const end = start + BOOKING_SLOT_DURATION_MINUTES;
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}
