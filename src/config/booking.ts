export const RESERVATION_FEE_GHS = 100;
export const PAYMENT_WINDOW_MINUTES = 30;
export const CHECKLIST_SERVICES = ["Brow Lamination", "Brow Lamination & Hybrid Tint", "Brow Wax"];
export const MIN_PHOTOS = 2;
export const MAX_PHOTOS = 3;
export const POLICY_VERSION = "2026-10";

// Temporary availability fallback used until the Availability screen is built.
// Data source: src/config/booking.ts (weekly opening hours), not Apps Script.
export const AVAILABILITY_FALLBACK = {
  openDays: [1, 2, 3, 4, 5, 6],
  openingTime: '09:00',
  closingTime: '17:00',
  stepMinutes: 60,
  daysAhead: 30,
};
