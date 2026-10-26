// StyledByC Booking Backend - Google Apps Script
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
  PAYMENT_OPTION: 10,
  AMOUNT_PAID: 11,
  BALANCE_DUE: 12,
  PAYMENT_REFERENCE: 13,
  PAYMENT_STATUS: 14,
  STATUS: 15,
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

// PAYMENT CONFIG (Paystack)
// Deposit amount: make it one easy-to-change setting at the top of a config file
// Default: 50% of the total, with an optional minimum amount (in GHS).
const DEPOSIT_PERCENTAGE = 50; // Change this to adjust deposit percentage (0-100)
const MINIMUM_DEPOSIT_AMOUNT = 0; // Set to 0 to disable minimum deposit amount
const CURRENCY = 'GHS';

const STATUS_PENDING = 'Pending Approval';
const STATUS_NEEDS_INFO = 'Needs More Info';
const STATUS_APPROVED_AWAITING = 'Approved - Awaiting Payment';
const STATUS_CONFIRMED = 'Confirmed';
const STATUS_APPROVED = 'Approved';
const STATUS_REJECTED = 'Rejected';
const STATUS_CANCELLED = 'Cancelled';
const STATUS_EXPIRED = 'Expired';

const SCRIPT_VERSION = '2026-10-photos';

// PHOTO UPLOAD CONFIG
const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;
const PHOTO_FOLDER_NAME = 'StyledByC Booking Photos';


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
const PAYSTACK_SECRET_KEY = PropertiesService.getScriptProperties().getProperty('PAYSTACK_SECRET_KEY') || '';


// ---------------------------------------------------------------------------
// ENTRY POINTS
// ---------------------------------------------------------------------------

/** Handle GET requests ? health check / CORS preflight info. */
function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({ ok: true, service: 'StyledByC Booking Backend', version: SCRIPT_VERSION })
  ).setMimeType(ContentService.MimeType.JSON);
}

function authorizeDrive() {
  DriveApp.getRootFolder();
  return 'Drive access granted';
}

/** Handle POST requests - public booking or token-authenticated admin actions. */
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
  if (action === 'verifypayment' || action === 'verify_payment' || action === 'verify') {
    const lockV = LockService.getScriptLock();
    try { lockV.waitLock(25); } catch { return ContentService.createTextOutput(JSON.stringify({ok:false,error:'The service is busy. Please try again in a moment.'})).setMimeType(ContentService.MimeType.JSON); }
    try {
      return handleVerifyPayment(body);
    } finally {
      try { lockV.releaseLock(); } catch (e2) {}
    }
  }
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
    if (action === 'verifypayment' || action === 'verify_payment' || action === 'verifypay') {
      const lockV = LockService.getScriptLock();
      try { lockV.waitLock(25); } catch { return ContentService.createTextOutput(JSON.stringify({ok:false,error:'The service is busy. Please try again in a moment.'})).setMimeType(ContentService.MimeType.JSON); }
      try {
        return handleVerifyPayment(body);
      } finally {
        try { lockV.releaseLock(); } catch (e2) {}
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
// PHOTO UPLOAD HELPERS
// ---------------------------------------------------------------------------

function getOrCreatePhotoFolder(parentFolder, name) {
  var folders = parentFolder.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(name);
}

function getPhotoFolder() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty('PHOTO_FOLDER_ID');
  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (e) {
      // fall through to create
    }
  }
  var root = DriveApp.getRootFolder();
  var folder = getOrCreatePhotoFolder(root, PHOTO_FOLDER_NAME);
  try {
    props.setProperty('PHOTO_FOLDER_ID', folder.getId());
  } catch (e) {}
  return folder;
}

function saveBookingPhotos(ref, photos) {
  if (!photos || !Array.isArray(photos) || photos.length === 0) {
    return { ok: true, folderUrl: '' };
  }
  if (photos.length > MAX_PHOTOS) {
    throw new Error('Too many photos. Maximum ' + MAX_PHOTOS + ' allowed.');
  }
  var parent = getPhotoFolder();
  var subfolder = getOrCreatePhotoFolder(parent, ref);
  var folderUrl = subfolder.getUrl();
  // Ensure private
  try {
    subfolder.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  } catch (e) {}
  for (var i = 0; i < photos.length; i++) {
    var p = photos[i];
    if (!p) continue;
    var mime = String(p.mimeType || '').toLowerCase();
    if (mime !== 'image/jpeg' && mime !== 'image/png') {
      throw new Error('Invalid photo type. Only JPEG and PNG are allowed.');
    }
    var data = String(p.dataBase64 || '');
    // Remove data URI prefix if present
    if (data.indexOf(',') !== -1) {
      data = data.split(',')[1];
    }
    // Rough size check
    var bytes = Utilities.base64Decode(data).length;
    if (bytes > MAX_PHOTO_BYTES) {
      throw new Error('Photo ' + (i + 1) + ' is too large. Must be under 1.5MB.');
    }
    var blob = Utilities.newBlob(Utilities.base64Decode(data), mime, ref + '-' + (i + 1) + (mime === 'image/png' ? '.png' : '.jpg'));
    var file = subfolder.createFile(blob);
    try {
      file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    } catch (e) {}
  }
  return { ok: true, folderUrl: folderUrl };
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

  // --- Calculate payment amounts (server authoritative) ---
  const totalPrice = Number(service.price) || 0;
  const paymentOption = String(input.paymentOption || 'deposit').toLowerCase() === 'full' ? 'Full' : 'Deposit';
  let amountPaid = 0;
  let balanceDue = 0;
  if (paymentOption === 'Full') {
    amountPaid = totalPrice;
    balanceDue = 0;
  } else {
    let deposit = Math.round((totalPrice * DEPOSIT_PERCENTAGE) / 100);
    if (MINIMUM_DEPOSIT_AMOUNT && deposit < MINIMUM_DEPOSIT_AMOUNT) {
      deposit = MINIMUM_DEPOSIT_AMOUNT;
    }
    if (deposit < 0) deposit = 0;
    if (deposit > totalPrice) deposit = totalPrice;
    amountPaid = deposit;
    balanceDue = Math.max(0, totalPrice - deposit);
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
    totalPrice,                             // PRICE
    paymentOption,                          // PAYMENT_OPTION
    amountPaid,                             // AMOUNT_PAID
    balanceDue,                             // BALANCE_DUE
    '',                                     // PAYMENT_REFERENCE
    'Unpaid',                               // PAYMENT_STATUS
    '',                                     // PAID_AT
    STATUS_PENDING,                         // STATUS
    '',                                     // PHOTO_FOLDER_URL
  ];

  sheet.appendRow(row);
  const lastRow = sheet.getLastRow();
  const h = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  const ix = indexByHeader(h);
  if (ix.DATE) sheet.getRange(lastRow, ix.DATE).setNumberFormat('@');
  if (ix.TIME) sheet.getRange(lastRow, ix.TIME).setNumberFormat('@');
  if (ix.CREATED_AT) sheet.getRange(lastRow, ix.CREATED_AT).setNumberFormat('@');

  // Handle photos if provided
  if (input.photos && Array.isArray(input.photos) && input.photos.length > 0) {
    try {
      var photoResult = saveBookingPhotos(ref, input.photos);
      if (ix.PHOTO_FOLDER_URL) {
        try { sheet.getRange(lastRow, ix.PHOTO_FOLDER_URL).setValue(photoResult.folderUrl || ''); } catch (e) {}
      }
    } catch (photoErr) {
      try { Logger.log('Photo save failed: ' + String(photoErr)); } catch (e2) {}
      if (ix.STATUS) {
        try { sheet.getRange(lastRow, ix.STATUS).setValue(STATUS_PENDING + ' (Photos failed)'); } catch (e3) {}
      }
    }
  }

  // Notify the studio owner that a new request needs review.
  try {
    notifyOwnerNewRequest({ ref, service: service.name, date: input.date, time: input.time, name: input.name, email: input.email, phone: input.phone });
  } catch (notifyErr) {
    // Non-fatal: the booking is still recorded.
    Logger.log('Owner notification failed: ' + String(notifyErr));
  }

  var statusOut = STATUS_PENDING;
  var photosMsg = null;
  try {
    var sheet2 = getOrCreateSheet();
    var data2 = sheet2.getDataRange().getValues();
    var h2 = data2[HEADER_ROW - 1];
    var ix2 = indexByHeader(h2);
    if (data2.length >= lastRow && ix2.STATUS) {
      var st = String(data2[lastRow - 1][ix2.STATUS - 1] || '').trim();
      if (st.indexOf('Photos failed') !== -1) {
        statusOut = STATUS_PENDING;
        photosMsg = 'Booking saved but photo upload failed. Please resend your photos to the studio.';
      }
    }
  } catch (e4) {}

  return ContentService.createTextOutput(
    JSON.stringify({
      ok: true,
      booking: {
        ref: ref,
        status: statusOut,
        service: service.name,
        price: totalPrice,
        date: input.date,
        time: input.time,
        paymentStatus: 'Unpaid',
        amountPaid: amountPaid,
        balanceDue: balanceDue,
        paymentOption: paymentOption,
      },
      message: photosMsg
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
  const unpaidHoldMs = 15 * 60 * 1000; // ~15 minutes

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
      const paymentStatus = String((idx.PAYMENT_STATUS ? row[idx.PAYMENT_STATUS - 1] : '') || '').trim().toLowerCase();
      const createdAt = row[idx.CREATED_AT] instanceof Date ? row[idx.CREATED_AT] : new Date(row[idx.CREATED_AT]);
      if (!isNaN(createdAt.getTime())) {
        const ageMs = now.getTime() - createdAt.getTime();
        if (paymentStatus === 'paid') {
          if (ageMs < holdMs) {
            return { ok: false, error: 'That time is currently held. Please choose another.' };
          }
        } else {
          // Unpaid attempts should not block the time slot for long (release after about 15 minutes)
          if (ageMs < unpaidHoldMs) {
            return { ok: false, error: 'That time is currently held. Please choose another.' };
          }
          continue; // expired unpaid hold, allow slot
        }
      } else {
        if (paymentStatus === 'paid') {
          return { ok: false, error: 'That time is currently held. Please choose another.' };
        }
        continue;
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
    'SERVICE', 'DATE', 'TIME', 'PRICE',
    'PAYMENT_OPTION', 'AMOUNT_PAID', 'BALANCE_DUE', 'PAYMENT_REFERENCE', 'PAYMENT_STATUS', 'PAID_AT', 'STATUS', 'PHOTO_FOLDER_URL',
    'QUESTIONNAIRE', 'POLICY_ACCEPTED', 'POLICY_VERSION', 'POLICY_ACCEPTED_AT', 'APPROVED_SLOT_DATE', 'APPROVED_SLOT_TIME', 'PAYMENT_DEADLINE',
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
}

function ensureHeaders(sheet) {
  const lastCol = sheet.getLastColumn();
  const headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  const upper = headers.map(h => String(h).toUpperCase().trim());
  const needed = ['REF','CREATED_AT','NAME','EMAIL','PHONE','SERVICE','DATE','TIME','PRICE','PAYMENT_STATUS','STATUS','PHOTO_FOLDER_URL','QUESTIONNAIRE','POLICY_ACCEPTED','POLICY_VERSION','POLICY_ACCEPTED_AT','APPROVED_SLOT_DATE','APPROVED_SLOT_TIME','PAYMENT_DEADLINE'];
  needed.forEach(h => {
    if (upper.indexOf(h) === -1) {
      const newCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, newCol).setValue(h);
    }
  });
}

/** Build a 1-based column index map from the header row.
 *
 * Matching is case-insensitive and trimmed so renamed or re-ordered headers
 * (e.g. "Customer Name", "Appt Date") still resolve to the right column.
 *
 * Some older versions of the script wrote friendly headers ("Booking
 * Reference", "Customer Name", "Appointment Date", "Price (GHS)") into the
 * first columns while ensureHeaders() then appended the canonical names
 * ("REF", "DATE", ...) as extra columns. Those canonical columns are empty,
 * so we must prefer the friendly names when both are present.
 *
 * When the header row is genuinely blank (no headers at all) we fall back to
 * the canonical column order. When a specific header is present but a *name*
 * is missing, we return 0 (absent) instead of silently borrowing a neighbouring
 * column ? that is what caused empty name/service/time/price on renamed sheets.
 */
function indexByHeader(headers) {
  // Friendly-name aliases for headers written by older script versions.
  // Order matters: friendly names come first so they win when both a friendly
  // and a canonical name exist in the sheet (older versions wrote friendly
  // headers into cols 1-10 and ensureHeaders() then appended REF/DATE/... as
  // empty extra columns).
  const ALIASES = {
    REF: ['BOOKING REFERENCE', 'REFERENCE', 'BOOKING REF', 'REF NO', 'REF'],
    CREATED_AT: ['CREATED AT', 'CREATED', 'SUBMITTED', 'SUBMITTED AT', 'TIMESTAMP', 'CREATED_AT'],
    NAME: ['CUSTOMER NAME', 'CUSTOMER', 'CLIENT', 'FULL NAME', 'NAME'],
    EMAIL: ['CUSTOMER EMAIL', 'E-MAIL', 'MAIL', 'EMAIL'],
    PHONE: ['CUSTOMER PHONE', 'MOBILE', 'TEL', 'TELEPHONE', 'PHONE'],
    SERVICE: ['SERVICE', 'TREATMENT', 'SERVICE NAME', 'APPOINTMENT SERVICE'],
    DATE: ['APPOINTMENT DATE', 'APT DATE', 'BOOKING DATE', 'APPT DATE', 'DATE'],
    TIME: ['APPOINTMENT TIME', 'APT TIME', 'BOOKING TIME', 'APPT TIME', 'TIME'],
    PRICE: ['PRICE (GHS)', 'PRICE GH', 'COST', 'TOTAL', 'PRICE GHS', 'PRICE'],
    PAYMENT_OPTION: ['PAYMENT OPTION', 'PAYMENT_OPTION', 'PAYMENT TYPE', 'PAYMENT_METHOD'],
    AMOUNT_PAID: ['AMOUNT PAID', 'AMOUNT_PAID', 'PAID AMOUNT', 'AMOUNT'],
    BALANCE_DUE: ['BALANCE DUE', 'BALANCE_DUE', 'BALANCE'],
    PAYMENT_REFERENCE: ['PAYMENT REFERENCE', 'PAYMENT_REFERENCE', 'REFERENCE NO', 'TX REF', 'TRANSACTION REFERENCE'],
    PAYMENT_STATUS: ['PAYMENT STATUS', 'PAYMENT', 'PAYMENT_STATE', 'PAYMENT_STATUS'],
    PAID_AT: ['PAID AT', 'PAID_AT', 'PAID DATE', 'DATE PAID'],
    STATUS: ['BOOKING STATUS', 'STATE', 'STATUS'],
  };
  // Keep the FIRST column that matches each name.
  const map = {};
  headers.forEach((h, i) => {
    const k = String(h || '').toUpperCase().trim();
    if (k && !map[k]) map[k] = i + 1;
  });
  const hasAny = headers.some(h => String(h || '').trim() !== '');

  const resolve = (names) => {
    for (let n = 0; n < names.length; n++) {
      const key = names[n].toUpperCase().trim();
      if (map[key]) return map[key];
    }
    return 0;
  };

  if (!hasAny) {
    // No headers at all ? use the canonical order.
    return {
      REF: 1, CREATED_AT: 2, NAME: 3, EMAIL: 4, PHONE: 5,
      SERVICE: 6, DATE: 7, TIME: 8, PRICE: 9, PAYMENT_OPTION: 10, AMOUNT_PAID: 11, BALANCE_DUE: 12, PAYMENT_REFERENCE: 13, PAYMENT_STATUS: 14, PAID_AT: 15, STATUS: 16,
    };
  }

  return {
    REF: resolve(ALIASES.REF),
    CREATED_AT: resolve(ALIASES.CREATED_AT),
    NAME: resolve(ALIASES.NAME),
    EMAIL: resolve(ALIASES.EMAIL),
    PHONE: resolve(ALIASES.PHONE),
    SERVICE: resolve(ALIASES.SERVICE),
    DATE: resolve(ALIASES.DATE),
    TIME: resolve(ALIASES.TIME),
    PRICE: resolve(ALIASES.PRICE),
    PAYMENT_OPTION: resolve(ALIASES.PAYMENT_OPTION),
    AMOUNT_PAID: resolve(ALIASES.AMOUNT_PAID),
    BALANCE_DUE: resolve(ALIASES.BALANCE_DUE),
    PAYMENT_REFERENCE: resolve(ALIASES.PAYMENT_REFERENCE),
    PAYMENT_STATUS: resolve(ALIASES.PAYMENT_STATUS),
    PAID_AT: resolve(ALIASES.PAID_AT),
    STATUS: resolve(ALIASES.STATUS),
  };
}

const TZ = 'Africa/Accra';

/**
 * Format a Date cell as a display date string.
 * - Real calendar dates -> "Thu 5 Nov 2026"
 * - Time-of-day values stored by Sheets as 1899-12-30 -> '' (handled by fmtTime)
 * - Already-text values are returned unchanged.
 */
function fmtDate(v) {
  if (v instanceof Date) {
    if (v.getFullYear() === 1899) return '';
    return Utilities.formatDate(v, TZ, 'EEE d MMM yyyy');
  }
  return String(v || '').trim();
}

/**
 * Format a time-of-day value.
 * - Sheets sometimes stores a pure time as 1899-12-30. If we just call
 *   Utilities.formatDate on that with Africa/Accra, Apps Script applies the
 *   historical LMT offset (+00:16) and the screen shows "GMT-0016". To avoid
 *   that we derive the time from the *spreadsheet's own timezone* by reading
 *   the hour/minute directly off the Date object (UTC fields), then format a
 *   throwaway Date with a fixed UTC offset of +00:00 so the wall-clock time is
 *   preserved exactly as entered.
 * - "HH:MM" text -> "h:mm a" in Africa/Accra.
 * - Anything else is returned as-is.
 */
function fmtTime(v) {
  if (v instanceof Date) {
    if (v.getFullYear() === 1899) {
      const hh = v.getUTCHours();
      const mm = v.getUTCMinutes();
      const anchor = new Date(Date.UTC(2000, 0, 1, hh, mm));
      return Utilities.formatDate(anchor, 'Etc/GMT+00', 'h:mm a');
    }
    // A full date+time cell: show just the wall-clock time.
    const anchor = new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate(), v.getHours(), v.getMinutes()));
    return Utilities.formatDate(anchor, 'Etc/GMT+00', 'h:mm a');
  }
  const s = String(v || '').trim();
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const [h, m] = s.split(':');
    const d = new Date(Date.UTC(2000, 0, 1, Number(h), Number(m)));
    return Utilities.formatDate(d, 'Etc/GMT+00', 'h:mm a');
  }
  return s;
}

/** Format a created-at Date as "5 Nov 2026, 3:00 PM" in Africa/Accra. */
function fmtCreatedAt(v) {
  if (v instanceof Date) {
    if (v.getFullYear() === 1899) return '';
    return Utilities.formatDate(v, TZ, 'd MMM yyyy, h:mm a');
  }
  return String(v || '').trim();
}

function toBooking(row, headers) {
  const idx = indexByHeader(headers);
  const pick = (i) => (i && i > 0 && row && i - 1 < row.length) ? row[i - 1] : '';
  const priceRaw = pick(idx.PRICE);
  const price = (priceRaw === '' || priceRaw === null || priceRaw === undefined) ? null : Number(priceRaw);
  const amountPaidRaw = idx.AMOUNT_PAID ? pick(idx.AMOUNT_PAID) : '';
  const balanceDueRaw = idx.BALANCE_DUE ? pick(idx.BALANCE_DUE) : '';
  const amountPaid = (amountPaidRaw === '' || amountPaidRaw === null || amountPaidRaw === undefined) ? null : Number(amountPaidRaw);
  const balanceDue = (balanceDueRaw === '' || balanceDueRaw === null || balanceDueRaw === undefined) ? null : Number(balanceDueRaw);
  return {
    ref: String(pick(idx.REF) || '').trim(),
    createdAt: fmtCreatedAt(pick(idx.CREATED_AT)),
    name: String(pick(idx.NAME) || '').trim(),
    email: String(pick(idx.EMAIL) || '').trim(),
    phone: String(pick(idx.PHONE) || '').trim(),
    service: String(pick(idx.SERVICE) || '').trim(),
    date: fmtDate(pick(idx.DATE)),
    time: fmtTime(pick(idx.TIME)),
    price: price,
    paymentOption: String((idx.PAYMENT_OPTION ? pick(idx.PAYMENT_OPTION) : '') || '').trim(),
    amountPaid: amountPaid,
    balanceDue: balanceDue,
    paymentReference: String((idx.PAYMENT_REFERENCE ? pick(idx.PAYMENT_REFERENCE) : '') || '').trim(),
    paymentStatus: String((idx.PAYMENT_STATUS ? pick(idx.PAYMENT_STATUS) : '') || '').trim() || 'Unpaid',
    paidAt: idx.PAID_AT ? pick(idx.PAID_AT) : '',
    status: String(pick(idx.STATUS) || '').trim(),
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
  const subject = `New booking request ${b.ref} ? ${b.service}`;
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
  const subject = `Your appointment is confirmed ? ${b.ref}`;
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
    `? StyledByC`,
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
    `? StyledByC`,
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
  if(action === 'raw'){
    var s = getOrCreateSheet();
    var d = s.getDataRange().getValues();
    var out = { ok:true, version: SCRIPT_VERSION, headers: d.length ? d[0] : [], rows: [] };
    for(var i=1; i<d.length; i++){
      var r = [];
      for(var c=0; c<d[i].length; c++){
        var v = d[i][c];
        r.push({ col: c+1, header: out.headers[c]||'', value: v, type: Object.prototype.toString.call(v) });
      }
      out.rows.push(r);
      if(out.rows.length >= 3) break;
    }
    return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
  }
  if(action === 'list' || action === 'inspect' || action === 'get'){
    var sheet = getOrCreateSheet();
    var data = sheet.getDataRange().getValues();
    if(!data || data.length < 2){
      return ContentService.createTextOutput(JSON.stringify({ok:true,version:SCRIPT_VERSION,headers:[],rows:[]})).setMimeType(ContentService.MimeType.JSON);
    }
    var headers = data[HEADER_ROW-1];
    var rows = [];
    for(var i=HEADER_ROW; i<data.length; i++){
      rows.push(toBooking(data[i], headers));
    }
    return ContentService.createTextOutput(JSON.stringify({ok:true,version:SCRIPT_VERSION,headers:headers,rows:rows})).setMimeType(ContentService.MimeType.JSON);
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












// ---------------------------------------------------------------------------
// PAYMENT VERIFICATION (Paystack)
// ---------------------------------------------------------------------------

function handleVerifyPayment(body) {
  if (!PAYSTACK_SECRET_KEY) {
    return jsonError('Payment service not configured.');
  }
  var reference = String(body.reference || '').trim();
  if (!reference) {
    return jsonError('Missing payment reference.');
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(25);
  } catch (e) {
    return jsonError('The service is busy. Please try again in a moment.');
  }

  try {
    var sheet = getOrCreateSheet();
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return jsonError('Booking not found.');
    }

    var headers = data[HEADER_ROW - 1];
    var idx = indexByHeader(headers);

    // Check if reference already used
    for (var i = HEADER_ROW; i < data.length; i++) {
      var existingRef = String((idx.PAYMENT_REFERENCE ? data[i][idx.PAYMENT_REFERENCE - 1] : '') || '').trim();
      if (existingRef && existingRef === reference) {
        return jsonError('This payment reference has already been used.');
      }
    }

    var bookingRow = -1;
    var bookingRef = String(body.bookingRef || '').trim();
    if (bookingRef) {
      for (var j = HEADER_ROW; j < data.length; j++) {
        if (String(data[j][idx.REF - 1] || '').trim() === bookingRef) {
          bookingRow = j;
          break;
        }
      }
    }

    if (bookingRow === -1) {
      return jsonError('Booking not found.');
    }

    var url = 'https://api.paystack.co/transaction/verify/' + encodeURIComponent(reference);
    var options = {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + PAYSTACK_SECRET_KEY,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    };
    var resp = UrlFetchApp.fetch(url, options);
    var respCode = resp.getResponseCode();
    var respText = resp.getContentText();
    var paystackData;
    try {
      paystackData = JSON.parse(respText);
    } catch (ex) {
      return jsonError('Payment verification failed.');
    }

    if (respCode !== 200 || !paystackData || paystackData.status !== true) {
      return jsonError('Payment verification failed.');
    }

    var tx = paystackData.data || {};
    if (tx.status !== 'success') {
      return jsonError('Payment was not successful.');
    }
    if (tx.currency !== CURRENCY) {
      return jsonError('Invalid currency.');
    }

    var expectedAmount = Number(data[bookingRow][idx.PRICE - 1]) || 0;
    var paymentOption = String(data[bookingRow][idx.PAYMENT_OPTION - 1] || 'Deposit');
    var expectedPaid = expectedAmount;
    if (paymentOption.toString().toLowerCase() === 'deposit') {
      var dep = Math.round((expectedAmount * DEPOSIT_PERCENTAGE) / 100);
      if (MINIMUM_DEPOSIT_AMOUNT && dep < MINIMUM_DEPOSIT_AMOUNT) dep = MINIMUM_DEPOSIT_AMOUNT;
      if (dep < 0) dep = 0;
      if (dep > expectedAmount) dep = expectedAmount;
      expectedPaid = dep;
    }

    var paidAmount = Number(tx.amount) / 100;
    if (Math.abs(paidAmount - expectedPaid) > 0.01) {
      return jsonError('Payment amount does not match.');
    }

    var rowNum = bookingRow + 1;
    if (idx.PAYMENT_REFERENCE) sheet.getRange(rowNum, idx.PAYMENT_REFERENCE).setValue(reference);
    if (idx.PAYMENT_STATUS) sheet.getRange(rowNum, idx.PAYMENT_STATUS).setValue('Paid');
    if (idx.AMOUNT_PAID) sheet.getRange(rowNum, idx.AMOUNT_PAID).setValue(paidAmount);
    if (idx.BALANCE_DUE) sheet.getRange(rowNum, idx.BALANCE_DUE).setValue(Math.max(0, expectedAmount - paidAmount));
    if (idx.PAID_AT) sheet.getRange(rowNum, idx.PAID_AT).setValue(new Date());

    var booking = toBooking(sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0], headers);
    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      booking: {
        ref: booking.ref,
        status: booking.status,
        paymentStatus: 'Paid',
        amountPaid: paidAmount,
        balanceDue: Math.max(0, expectedAmount - paidAmount),
        service: booking.service,
        date: booking.date,
        time: booking.time,
        price: expectedAmount
      }
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}






// ---------------------------------------------------------------------------
// TRIGGERS
// ---------------------------------------------------------------------------

function expireUnpaidBookings() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30);
  } catch (e) {
    return;
  }
  try {
    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return;
    const headers = data[HEADER_ROW - 1];
    const idx = indexByHeader(headers);
    const now = new Date();
    for (let i = HEADER_ROW; i < data.length; i++) {
      const status = String(data[i][idx.STATUS - 1] || '').trim();
      if (status === STATUS_PENDING || status === 'Pending' || status === STATUS_APPROVED_AWAITING || status === 'Pending Approval') {
        const deadlineVal = idx.PAYMENT_DEADLINE ? data[i][idx.PAYMENT_DEADLINE - 1] : null;
        if (deadlineVal instanceof Date) {
          if (now > deadlineVal) {
            if (idx.STATUS) sheet.getRange(i + 1, idx.STATUS).setValue(STATUS_EXPIRED);
          }
        } else if (deadlineVal) {
          const d = new Date(deadlineVal);
          if (!isNaN(d.getTime()) && now > d) {
            if (idx.STATUS) sheet.getRange(i + 1, idx.STATUS).setValue(STATUS_EXPIRED);
          }
        }
      }
    }
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}
