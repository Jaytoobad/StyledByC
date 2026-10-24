const fs = require('fs');
const code = `/**
 * StyledByC Booking Backend — Google Apps Script
 *
 * Receives booking requests from the public website and writes them to the
 * "StyledByC-Booking Records" spreadsheet, tab "Bookings".
 *
 * Deploy as a Web App:
 *   1. Open https://script.google.com and create a new project.
 *   2. Paste this code into Code.gs.
 *   3. Replace SPREADSHEET_ID below with the ID of the target spreadsheet.
 *   4. Run testSpreadsheetConnection() once to authorize.
 *   5. Deploy > New deployment > Web app > Execute as: Me > Access: Anyone
 *   6. Copy the web app URL into the frontend (VITE_BOOKING_API_URL).
 */

const SPREADSHEET_ID = 'PASTE_SPREADSHEET_ID_HERE';
const SHEET_NAME = 'Bookings';
const HEADER_ROW = 1;

// Column indices (1-based) matching the existing spreadsheet headings.
const COL = {
  REF: 1,
  CREATED_AT: 2,
  NAME: 3,
  EMAIL: 4,
  PHONE: 5,
  SERVICE: 6,
  DATE: 7,
  TIME: 8,
  PRICE: 9,
  STATUS: 10,
};

// Authoritative service catalogue. The backend derives the name and price
// from this table so a client cannot submit a fake price or unknown service.
const SERVICES = {
  'brow-shaping-blade': { name: 'Brow Shaping (Blade)', price: 60 },
  'brow-wax': { name: 'Brow Wax', price: 100 },
  'brow-lamination-hybrid-tint': { name: 'Brow Lamination & Hybrid Tint', price: 290 },
  'lamination-only': { name: 'Lamination Only', price: 250 },
  'hybrid-tint-alone': { name: 'Hybrid Tint Alone', price: 150 },
};

const STATUS_PENDING = 'Pending Approval';
const STATUS_APPROVED = 'Approved';
const STATUS_REJECTED = 'Rejected';
const STATUS_CANCELLED = 'Cancelled';

// Business hours. Ghana time (GMT/UTC+0, no DST).
const OPENING_TIME = '09:00';
const CLOSING_TIME = '17:00';
const SLOT_INTERVAL_MINUTES = 30;

// How long a pending request holds its slot before it can be taken by others.
// Set to a confirmed business value before launch. Default: 24 hours.
const PENDING_HOLD_HOURS = 24;
`;

fs.writeFileSync('C:\\Users\\jason\\Downloads\\StyledByC\\apps-script\\Code.gs', code);
console.log('written part 1');