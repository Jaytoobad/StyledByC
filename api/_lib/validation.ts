/**
 * StyledByC - Shared input validation helpers.
 *
 * One place for max lengths, types, phone and email normalization. Used by
 * every public endpoint so the rules cannot drift between handlers.
 */

const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_PHONE = 20;
const MAX_NOTE = 2000;
const MAX_REF = 20;
const MAX_SERVICE_ID = 64;

export function normalizePhone(raw: string): string {
  return (raw || '').replace(/[\s\-()+]/g, '');
}

export function normalizeEmail(raw: string): string {
  return (raw || '').trim().toLowerCase();
}

export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || '');
}

export function isPhone(v: string): boolean {
  const n = normalizePhone(v || '');
  return n.length >= 7 && n.length <= MAX_PHONE && /^[0-9]+$/.test(n);
}

export function isTime(v: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v || '');
}

export function isDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) return false;
  return !Number.isNaN(new Date(v + 'T00:00:00Z').getTime());
}

export function isNotPastDate(v: string): boolean {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const d = new Date(v + 'T00:00:00Z');
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime() >= today.getTime();
}

export function validateBookingInput(
  input: unknown,
): { ok: true; data: Record<string, unknown> } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['The request body is invalid.'] };
  }
  const b = input as Record<string, unknown>;

  const serviceId = String(b.serviceId || '').trim();
  if (!serviceId || serviceId.length > MAX_SERVICE_ID)
    errors.push('Please choose a valid service.');

  const date = String(b.date || '');
  if (!isDate(date) || !isNotPastDate(date)) errors.push('Please choose a valid appointment date.');

  const time = String(b.time || '');
  if (!isTime(time)) errors.push('Please choose a valid appointment time.');

  const name = String(b.name || '').trim();
  if (!name || name.length > MAX_NAME) errors.push('Please enter your full name.');

  const email = normalizeEmail(String(b.email || ''));
  if (!email || email.length > MAX_EMAIL || !isEmail(email))
    errors.push('Please enter a valid email address.');

  const phone = normalizePhone(String(b.phone || ''));
  if (!phone || !isPhone(phone)) errors.push('Please enter a valid phone number.');

  const note = b.note !== undefined ? String(b.note || '').trim() : '';
  if (note && note.length > MAX_NOTE) errors.push('Your note is too long.');

  const ref = b.ref !== undefined ? String(b.ref || '').trim() : '';
  if (ref && ref.length > MAX_REF) errors.push('Invalid reference.');

  if (b.policyAccepted !== true) errors.push('Please accept the policies to continue.');

  if (errors.length) return { ok: false, errors };
  return { ok: true, data: { ...b, name, email, phone, note, ref } };
}
