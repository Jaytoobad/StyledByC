// StyledByC Booking Backend — Google Apps Script
// Receives booking requests from the public website and writes them to the
// "StyledByC-Booking Records" spreadsheet, tab "Bookings".
//
// Deploy as a Web App:
//   1. Open https://script.google.com and create a new project.
//   2. Paste this code into Code.gs.
//   3. Replace SPREADSHEET_ID below with the ID of the target spreadsheet.
//   4. Run testSpreadsheetConnection() once to authorize.
//   5. Deploy > New deployment > Web app > Execute as: Me > Access: Anyone
//   6. Copy the web app URL into the frontend (VITE_BOOKING_API_URL).

// ---------------------------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------------------------

// ID of the "StyledByC-Booking Records" spreadsheet.
const SPREADSHEET_ID = '1KKp2rrNxuU9uYl39kIB3pGR-N_7PIfc9NMlDoioYh9I';
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

// openingDays: 1=Mon ... 6=Sat, 0=Sun (closed).
const OPENING_DAYS = [1, 2, 3, 4, 5, 6];

// Email used for owner notifications and client confirmations.
const OWNER_EMAIL = 'freemancedil69@gmail.com';

// Admin API token from Script Properties
const ADMIN_TOKEN = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN') || '';


// ---------------------------------------------------------------------------
// ENTRY POINTS
// ---------------------------------------------------------------------------

/** Handle GET requests — health check / CORS preflight info. */
function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({ ok: true, service: 'StyledByC Booking Backend', version: '1.0.0' })
  ).setMimeType(ContentService.MimeType.JSON);
}

/** Handle POST requests — public booking or token-authenticated admin actions. */
function doPost(e) {
  try {
    let raw = '{}';
    if (e) {
      if (e.postData && typeof e.postData.contents === 'string') raw = e.postData.contents;
      else if (typeof e.postBody === 'string') raw = e.postBody;
      else if (e.parameter) {
        if (typeof e.parameter === 'string') raw = e.parameter;
        else if (typeof e.parameter.payload === 'string') raw = e.parameter.payload;
        else if (typeof e.parameter.data === 'string') raw = e.parameter.data;
      }
    }
  let body;
  try { body = JSON.parse(raw); } catch { body = {}; }
  const action = String((body && body.action) || '').trim().toLowerCase();
  if (action === 'list' || action === 'approve' || action === 'reject' || action === 'cancel' || action === 'inspect' || action === 'get') {
    const secret = String((body && (body.secret || body.token)) || '').trim();
    if (!ADMIN_TOKEN || secret !== ADMIN_TOKEN) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Unauthorized' })).setMimeType(ContentService.MimeType.JSON);
    }
      const lockA = LockService.getScriptLock();
      try { lockA.waitLock(25); } catch { return ContentService.createTextOutput(JSON.stringify({ok:false,error:'The service is busy. Please try again in a moment.'})).setMimeType(ContentService.MimeType.JSON); }
      try {
        return handleAdminAction(body);
      } finally {
        try { lockA.releaseLock(); } catch (e2) {}
      }
    }
    const lock = LockService.getScriptLock();
    try { lock.waitLock(25); } catch { return ContentService.createTextOutput(JSON.stringify({ok:false,error:'The service is busy. Please try again in a moment.'})).setMimeType(ContentService.MimeType.JSON); }
    try {
      return handleBooking(e);
    } finally {
      try { lock.releaseLock(); } catch (e2) {}
    }
  } catch (err) {
    try { Logger.log('doPost fatal: ' + String(err)); } catch (e3) {}
    return ContentService.createTextOutput(JSON.stringify({ok:false,error:'An unexpected error occurred. Please try again later.'})).setMimeType(ContentService.MimeType.JSON);
  }
}

// ---------------------------------------------------------------------------
// OWNER / ADMIN HELPERS
// ---------------------------------------------------------------------------

/**
 * Inspect the bookings sheet. Returns the header row plus every booking row.
 * Use this from the Apps Script editor (Run > inspectBookings) or wire it to
 * a small admin UI. Never expose this endpoint publicly without auth.
 */
function requireOwner() {
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (!email || email !== String(OWNER_EMAIL).trim().toLowerCase()) {
    throw new Error('Unauthorized: owner authentication required.');
  }
  return email;
}

function inspectBookings() {
  requireOwner();
  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) {
    return { ok: true, headers: [], rows: [] };
  }
  const headers = data[HEADER_ROW - 1];
  const rows = data.slice(HEADER_ROW).map((row) => toBooking(row, headers));
  return { ok: true, headers: headers, rows: rows };
}

/**
 * Approve a booking by reference. The owner runs this after reviewing the
 * request (e.g. from the spreadsheet or an admin panel). Triggers a
 * confirmation email to the client.
 */
function approveBooking(ref) {
  requireOwner();
  return updateStatus(ref, STATUS_APPROVED, 'Booking approved by studio.');
}

/** Reject a booking by reference. */
function rejectBooking(ref) {
  requireOwner();
  return updateStatus(ref, STATUS_REJECTED, 'Booking rejected by studio.');
}

/** Cancel a booking by reference. */
function cancelBooking(ref) {
  requireOwner();
  return updateStatus(ref, STATUS_CANCELLED, 'Booking cancelled by studio.');
}

// ---------------------------------------------------------------------------
// CORE BOOKING HANDLER
// ---------------------------------------------------------------------------

/**
 * Validate the incoming request, check availability, and write a new
 * "Pending Approval" booking to the sheet. The backend is authoritative:
 * it derives the service name and price from its own catalogue so a client
 * cannot submit a fake price or unknown service.
 */
function handleBooking(e) {
  let input;
  try {
    let raw = '{}';
    if (e) {
      if (e.postData && typeof e.postData.contents === 'string') raw = e.postData.contents;
      else if (typeof e.postBody === 'string') raw = e.postBody;
      else if (e.parameter) {
        if (typeof e.parameter === 'string') raw = e.parameter;
        else if (typeof e.parameter.payload === 'string') raw = e.parameter.payload;
        else if (typeof e.parameter.data === 'string') raw = e.parameter.data;
      }
    }
    input = JSON.parse(raw);
  } catch {
    return jsonError('The request body could not be read. Please try again.');
  }

  // --- Required fields ---
  const errors = validateInput(input);
  if (errors.length) {
    return jsonError(errors.join(' '));
  }

  const service = SERVICES[input.serviceId];
  if (!service) {
    return jsonError('Unknown service. Please try again.');
  }

  // --- Date / time validation ---
  if (!isBusinessDay(input.date)) {
    return jsonError('The studio is closed on that day. Please choose another date.');
  }
  if (!isBusinessTime(input.time)) {
    return jsonError('Please choose a time within our opening hours.');
  }

  // --- Availability check (authoritative) ---
  const availability = checkAvailability(input.date, input.time);
  if (!availability.ok) {
    return jsonError(availability.error || 'That time is no longer available. Please choose another.');
  }

  // --- Write the booking ---
  const sheet = getOrCreateSheet();
  const ref = generateRef();
  const now = new Date();
  const row = [
    ref,                                    // REF
    now,                                    // CREATED_AT
    String(input.name).trim(),              // NAME
    String(input.email).trim(),             // EMAIL
    String(input.phone).trim(),             // PHONE
    service.name,                           // SERVICE
    String(input.date).trim(),              // DATE
    String(input.time).trim(),              // TIME
    service.price,                          // PRICE
    STATUS_PENDING,                         // STATUS
  ];

  sheet.appendRow(row);
  const lastRow = sheet.getLastRow();
  const h = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  const ix = indexByHeader(h);
  if (ix.DATE) sheet.getRange(lastRow, ix.DATE).setNumberFormat('@');
  if (ix.TIME) sheet.getRange(lastRow, ix.TIME).setNumberFormat('@');
  if (ix.CREATED_AT) sheet.getRange(lastRow, ix.CREATED_AT).setNumberFormat('@');

  // Notify the studio owner that a new request needs review.
  try {
    notifyOwnerNewRequest({ ref, service: service.name, date: input.date, time: input.time, name: input.name, email: input.email, phone: input.phone });
  } catch (notifyErr) {
    // Non-fatal: the booking is still recorded.
    Logger.log('Owner notification failed: ' + String(notifyErr));
  }

  return ContentService.createTextOutput(
    JSON.stringify({
      ok: true,
      booking: {
        ref: ref,
        status: STATUS_PENDING,
        service: service.name,
        price: service.price,
        date: input.date,
        time: input.time,
      },
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// VALIDATION
// ---------------------------------------------------------------------------

function validateInput(input) {
  const errors = [];
  if (!input || typeof input !== 'object') errors.push('The request body is invalid.');
  if (!input.serviceId || !SERVICES[input.serviceId]) errors.push('Please choose a valid service.');
  if (!looksLikeDate(input.date)) errors.push('Please choose a valid appointment date.');
  if (!looksLikeTime(input.time)) errors.push('Please choose a valid appointment time.');
  if (!input.name || !String(input.name).trim()) errors.push('Please enter your full name.');
  if (!input.email || !/^\S+@\S+\.\S+$/.test(String(input.email)))
    errors.push('Please enter a valid email address.');
  if (!input.phone || String(input.phone).trim().length < 7)
    errors.push('Please enter a valid phone number.');
  return errors;
}

function looksLikeDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
}

function looksLikeTime(s) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));
}

/** 1=Mon ... 6=Sat, 0=Sun. Returns true if the studio is open on that day. */
function isBusinessDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return false;
  // JS getDay: 0=Sun, 1=Mon, ..., 6=Sat. Our config uses the same mapping.
  return OPENING_DAYS.indexOf(d.getDay()) !== -1;
}

function isBusinessTime(timeStr) {
  return timeStr >= OPENING_TIME && timeStr < CLOSING_TIME;
}

// ---------------------------------------------------------------------------
// AVAILABILITY (AUTHORITATIVE)
// ---------------------------------------------------------------------------

/**
 * Check whether a slot is available. A slot is unavailable when:
 *  - it is already Approved, or
 *  - it is Pending Approval and the hold has not yet expired.
 * The client only shows hints; this is the source of truth.
 */
function checkAvailability(dateStr, timeStr) {
  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { ok: true };

  const headers = data[HEADER_ROW - 1];
  const idx = indexByHeader(headers);
  const now = new Date();
  const holdMs = PENDING_HOLD_HOURS * 60 * 60 * 1000;

  for (let i = HEADER_ROW; i < data.length; i++) {
    const row = data[i];
    const rowDate = String(row[idx.DATE] || '').trim();
    const rowTime = String(row[idx.TIME] || '').trim();
    if (rowDate !== dateStr || rowTime !== timeStr) continue;

    const status = String(row[idx.STATUS] || '').trim();
    if (status === STATUS_APPROVED) {
      return { ok: false, error: 'That time is already confirmed. Please choose another.' };
    }
    if (status === STATUS_PENDING) {
      const createdAt = row[idx.CREATED_AT] instanceof Date ? row[idx.CREATED_AT] : new Date(row[idx.CREATED_AT]);
      if (isNaN(createdAt.getTime()) || (now.getTime() - createdAt.getTime()) < holdMs) {
        return { ok: false, error: 'That time is currently held. Please choose another.' };
      }
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// SPREADSHEET HELPERS
// ---------------------------------------------------------------------------

/** Get the bookings sheet, creating it (and its header row) if missing. */
function getOrCreateSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    writeHeaders(sheet);
  } else {
    const existing = sheet.getRange(1, 1).getValue();
    if (!existing) writeHeaders(sheet);
    ensureHeaders(sheet);
  }
  return sheet;
}

function writeHeaders(sheet) {
  const headers = [
    'REF', 'CREATED_AT', 'NAME', 'EMAIL', 'PHONE',
    'SERVICE', 'DATE', 'TIME', 'PRICE', 'PAYMENT_STATUS', 'STATUS',
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
}

function ensureHeaders(sheet) {
  const lastCol = sheet.getLastColumn();
  const headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  const upper = headers.map(h => String(h).toUpperCase().trim());
  const needed = ['REF','CREATED_AT','NAME','EMAIL','PHONE','SERVICE','DATE','TIME','PRICE','PAYMENT_STATUS','STATUS'];
  needed.forEach(h => {
    if (upper.indexOf(h) === -1) {
      const newCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, newCol).setValue(h);
    }
  });
}

/** Build a 1-based column index map from the header row. */
function indexByHeader(headers) {
  const map = {};
  headers.forEach((h, i) => { map[String(h).toUpperCase().trim()] = i + 1; });
  return {
    REF: map.REF || 1,
    CREATED_AT: map.CREATED_AT || 2,
    NAME: map.NAME || 3,
    EMAIL: map.EMAIL || 4,
    PHONE: map.PHONE || 5,
    SERVICE: map.SERVICE || 6,
    DATE: map.DATE || 7,
    TIME: map.TIME || 8,
    PRICE: map.PRICE || 9,
    PAYMENT_STATUS: map.PAYMENT_STATUS || map.PAYMENT || 0,
    STATUS: map.STATUS || 10,
  };
}

const TZ = 'Africa/Accra';

function fmtDate(v) {
  if (v instanceof Date) {
    // Sheets 1899 time-of-day quirk: if year 1899, treat as time only -> return ''
    if (v.getFullYear() === 1899) return '';
    return Utilities.formatDate(v, TZ, 'EEE d MMM yyyy');
  }
  return String(v || '').trim();
}
function fmtTime(v) {
  if (v instanceof Date) {
    // 1899 quirk: time-of-day stored as 1899-12-30; format time portion
    return Utilities.formatDate(v, TZ, 'h:mm a');
  }
  const s = String(v || '').trim();
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const [h,m] = s.split(':');
    const d = new Date(2000,0,1,Number(h),Number(m));
    return Utilities.formatDate(d, TZ, 'h:mm a');
  }
  return s;
}
function fmtCreatedAt(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, TZ, 'd MMM yyyy, h:mm a');
  }
  return String(v || '').trim();
}

function toBooking(row, headers) {
  const idx = indexByHeader(headers);
  const priceRaw = row[idx.PRICE];
  const price = (priceRaw === '' || priceRaw === null || priceRaw === undefined) ? null : Number(priceRaw);
  return {
    ref: String(row[idx.REF] || '').trim(),
    createdAt: fmtCreatedAt(row[idx.CREATED_AT]),
    name: String(row[idx.NAME] || '').trim(),
    email: String(row[idx.EMAIL] || '').trim(),
    phone: String(row[idx.PHONE] || '').trim(),
    service: String(row[idx.SERVICE] || '').trim(),
    date: fmtDate(row[idx.DATE]),
    time: fmtTime(row[idx.TIME]),
    price: price,
    paymentStatus: String((idx.PAYMENT_STATUS ? row[idx.PAYMENT_STATUS] : '') || '').trim() || 'Pending',
    status: String(row[idx.STATUS] || '').trim(),
  };
}

// ---------------------------------------------------------------------------
// STATUS TRANSITIONS (OWNER ACTION)
// ---------------------------------------------------------------------------

/** Find a booking by reference and update its status. */
function updateStatus(ref, newStatus, note) {
  if (!ref) return jsonError('A reference is required.');
  const allowed = [STATUS_APPROVED, STATUS_REJECTED, STATUS_CANCELLED];
  if (allowed.indexOf(newStatus) === -1) return jsonError('Invalid status.');

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25);
  } catch {
    return jsonError('The service is busy. Please try again in a moment.');
  }

  try {
    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return jsonError('Booking not found.');

    const headers = data[HEADER_ROW - 1];
    const idx = indexByHeader(headers);

    for (let i = HEADER_ROW; i < data.length; i++) {
      if (String(data[i][idx.REF] || '').trim() !== String(ref).trim()) continue;

      const currentStatus = String(data[i][idx.STATUS] || '').trim();
      if (currentStatus === newStatus) {
        const booking = toBooking(data[i], headers);
        return { ok: true, booking: booking, status: newStatus, notificationSent: false, duplicate: true };
      }

      // Permitted transitions: Pending -> final; Approved/Rejected can be cancelled.
      const permitted =
        (currentStatus === STATUS_PENDING && (newStatus === STATUS_APPROVED || newStatus === STATUS_REJECTED || newStatus === STATUS_CANCELLED)) ||
        ((currentStatus === STATUS_APPROVED || currentStatus === STATUS_REJECTED) && newStatus === STATUS_CANCELLED);
      if (!permitted) {
        return jsonError('Status transition not permitted.');
      }

      sheet.getRange(i + 1, idx.STATUS).setValue(newStatus);

      const booking = toBooking(data[i], headers);
      booking.status = newStatus;

      let notificationSent = false;
      let notificationError = null;
      if (newStatus === STATUS_APPROVED) {
        try { sendApprovalEmail(booking); notificationSent = true; }
        catch (e) { notificationError = String(e); Logger.log('Approval email failed: ' + notificationError); }
      }
      if (newStatus === STATUS_REJECTED) {
        try { sendRejectionEmail(booking); notificationSent = true; }
        catch (e) { notificationError = String(e); Logger.log('Rejection email failed: ' + notificationError); }
      }

      const result = { ok: true, booking: booking, status: newStatus, notificationSent: notificationSent };
      if (notificationError) result.notificationError = notificationError;
      return result;
    }
    return jsonError('Booking not found.');
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// REFERENCES & RESPONSES
// ---------------------------------------------------------------------------

/** Collision-resistant reference: STC-<base36-time>-<random>. */
function generateRef() {
  const stamp = new Date().getTime().toString(36);
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `STC-${stamp.toUpperCase()}-${rand}`;
}

function jsonError(message) {
  return ContentService.createTextOutput(
    JSON.stringify({ ok: false, error: message })
  ).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// NOTIFICATIONS
// ---------------------------------------------------------------------------

/** Notify the studio owner that a new request is awaiting review. */
function notifyOwnerNewRequest(b) {
  const subject = `New booking request ${b.ref} — ${b.service}`;
  const body = [
    `A new booking request has been submitted and is awaiting review.`,
    ``,
    `Reference: ${b.ref}`,
    `Service: ${b.service}`,
    `Date: ${b.date}`,
    `Time: ${b.time}`,
    `Name: ${b.name}`,
    `Email: ${b.email}`,
    `Phone: ${b.phone}`,
    ``,
    `Log in to the studio dashboard to approve or reject this request.`,
  ].join('\n');
  GmailApp.sendEmail(OWNER_EMAIL, subject, body);
}

/** Notify the client that their request was approved. */
function sendApprovalEmail(b) {
  const subject = `Your appointment is confirmed — ${b.ref}`;
  const body = [
    `Hi ${b.name},`,
    ``,
    `Your appointment has been confirmed by the studio.`,
    ``,
    `Reference: ${b.ref}`,
    `Service: ${b.service}`,
    `Date: ${b.date}`,
    `Time: ${b.time}`,
    ``,
    `We look forward to seeing you.`,
    ``,
    `— StyledByC`,
  ].join('\n');
  GmailApp.sendEmail(b.email, subject, body);
}

/** Notify the client that their request was rejected. */
function sendRejectionEmail(b) {
  const subject = `Update on your booking request ${b.ref}`;
  const body = [
    `Hi ${b.name},`,
    ``,
    `Unfortunately your booking request could not be accommodated at this time.`,
    ``,
    `Reference: ${b.ref}`,
    `Service: ${b.service}`,
    `Date: ${b.date}`,
    `Time: ${b.time}`,
    ``,
    `Please contact the studio to discuss alternative options.`,
    ``,
    `— StyledByC`,
  ].join('\n');
  GmailApp.sendEmail(b.email, subject, body);
}

// ---------------------------------------------------------------------------
// TESTS (run manually from the Apps Script editor)
// ---------------------------------------------------------------------------

/**
 * Smoke test: simulate a booking request end-to-end.
 * Run this from the Apps Script editor (Run > testBookingFlow) after
 * replacing SPREADSHEET_ID with a real test spreadsheet ID.
 *
 * NOTE: This writes a test row. Run it against a throwaway spreadsheet,
 * never the production "StyledByC-Booking Records" sheet.
 */
function testBookingFlow() {
  const fakeEvent = {
    postBody: JSON.stringify({
      serviceId: 'brow-shaping-blade',
      date: '2026-10-28',
      time: '10:00',
      name: 'Test Client',
      email: 'test@example.com',
      phone: '+233 20 000 0000',
    }),
  };
  const res = handleBooking(fakeEvent);
  Logger.log('SUBMIT RESULT: ' + res.getContent());
  return JSON.parse(res.getContent());
}

/**
 * Smoke test: inspect the sheet after a test submission.
 */
function testInspect() {
  const result = inspectBookings();
  Logger.log('INSPECT RESULT: ' + JSON.stringify(result));
  return result;
}


// ---------------------------------------------------------------------------
// ADMIN API (token-authenticated)
// ---------------------------------------------------------------------------

function handleAdminAction(body){
  var action = String(body.action||'').trim().toLowerCase();
  if(action === 'list' || action === 'inspect' || action === 'get'){
    var sheet = getOrCreateSheet();
    var data = sheet.getDataRange().getValues();
    if(!data || data.length < 2){
      return ContentService.createTextOutput(JSON.stringify({ok:true,headers:[],rows:[]})).setMimeType(ContentService.MimeType.JSON);
    }
    var headers = data[HEADER_ROW-1];
    var rows = [];
    for(var i=HEADER_ROW; i<data.length; i++){
      rows.push(toBooking(data[i], headers));
    }
    return ContentService.createTextOutput(JSON.stringify({ok:true,headers:headers,rows:rows})).setMimeType(ContentService.MimeType.JSON);
  }
  if(action === 'approve'){
    return updateStatus(String(body.ref||''), STATUS_APPROVED, 'Booking approved by studio.');
  }
  if(action === 'reject'){
    return updateStatus(String(body.ref||''), STATUS_REJECTED, 'Booking rejected by studio.');
  }
  if(action === 'cancel'){
    return updateStatus(String(body.ref||''), STATUS_CANCELLED, 'Booking cancelled by studio.');
  }
  return ContentService.createTextOutput(JSON.stringify({ok:false,error:'Unknown action'})).setMimeType(ContentService.MimeType.JSON);
}
