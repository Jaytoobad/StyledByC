export const RESERVATION_FEE_GHS = 100;
export const PAYMENT_WINDOW_MINUTES = 30;
export const BOOKING_START_TIMES = ['13:30', '15:30'] as const;
export const BOOKING_SLOT_DURATION_MINUTES = 60;
export const BROW_QUESTIONNAIRE_ITEMS = [
  'Using acne medication (e.g., Accutane, prescription creams)',
  'Using Retinol, AHA, or BHA products',
  'Started new medications recently',
  'Sensitive skin',
  'Eczema, dermatitis, or skin conditions',
  'Pregnant or breastfeeding',
  'Recent facial, peel, or skin treatment (last 7 days)',
  'Recent skin changes (breakouts, dryness, irritation)',
] as const;
export const BROW_QUESTIONNAIRE_MAX_LENGTH = 2000;
export const MIN_PHOTOS = 2;
export const MAX_PHOTOS = 2;
export const POLICY_VERSION = '2026-10';

export const OPEN_DAYS_CLIENT = [1, 2, 3, 4, 5, 6]; // Mon-Sat

// Months (0-indexed, UTC) during which bookings are temporarily unavailable.
// Currently December only. Existing bookings are never touched.
export const BLOCKED_MONTHS = [11];

export function isBlockedMonth(dateStr: string): boolean {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && BLOCKED_MONTHS.includes(d.getUTCMonth());
}

// Temporary availability fallback used until the Availability screen is built.
// Data source: src/config/booking.ts (weekly opening hours), not Apps Script.
export const AVAILABILITY_FALLBACK = {
  openDays: [1, 2, 3, 4, 5, 6],
  openingTime: '09:00',
  closingTime: '17:00',
  stepMinutes: 60,
  daysAhead: 30,
  blockedDates: ['2026-11-26', '2026-11-27'],
};
