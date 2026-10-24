/**
 * StyledByC — Booking API client.
 *
 * This module talks to the Google Apps Script web app backend that owns the
 * "StyledByC-Booking Records" spreadsheet. It sends only what the customer
 * typed. The backend validates the service, price, availability and status.
 *
 * When `API_URL` is empty (no backend deployed yet), `submitBooking` falls
 * back to a local demo submission so the form still works during development.
 * The returned status is always "Pending Approval" — never "Confirmed".
 */

export type SubmitBookingInput = {
  serviceId: string;
  date: string;
  time: string;
  name: string;
  email: string;
  phone: string;
  note: string;
};

export type SubmitBookingResult = {
  ok: boolean;
  error?: string;
  booking?: {
    ref: string;
    status: string;
    service: string;
    price: number;
    date: string;
    time: string;
  };
};

type BackendResponse = {
  ok?: boolean;
  error?: string;
  booking?: {
    ref?: string;
    status?: string;
    service?: string;
    price?: number;
    date?: string;
    time?: string;
  };
};

const DEMO_KEY = 'styledbyc-demo-bookings';

/** Generate a collision-resistant reference without relying on Date.now alone. */
function generateRef(): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `STC-${stamp.toUpperCase()}-${rand}`;
}

/** Minimal client-side check. The backend re-validates everything. */
function looksLikeDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function looksLikeTime(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

/** Fallback used only when no backend is configured. */
function submitDemo(input: SubmitBookingInput): SubmitBookingResult {
  const services = [
    { id: 'brow-shaping-blade', name: 'Brow Shaping (Blade)', price: 60 },
    { id: 'brow-wax', name: 'Brow Wax', price: 100 },
    {
      id: 'brow-lamination-hybrid-tint',
      name: 'Brow Lamination & Hybrid Tint',
      price: 290,
    },
    { id: 'lamination-only', name: 'Lamination Only', price: 250 },
    { id: 'hybrid-tint-alone', name: 'Hybrid Tint Alone', price: 150 },
  ];

  const service = services.find((s) => s.id === input.serviceId);
  if (!service) return { ok: false, error: 'Unknown service. Please try again.' };
  if (!looksLikeDate(input.date))
    return { ok: false, error: 'Please choose a valid appointment date.' };
  if (!looksLikeTime(input.time))
    return { ok: false, error: 'Please choose a valid appointment time.' };
  if (!input.name.trim())
    return { ok: false, error: 'Please enter your full name.' };
  if (!/^\S+@\S+\.\S+$/.test(input.email))
    return { ok: false, error: 'Please enter a valid email address.' };
  if (input.phone.trim().length < 7)
    return { ok: false, error: 'Please enter a valid phone number.' };

  const booking = {
    ref: generateRef(),
    status: 'Pending Approval',
    service: service.name,
    price: service.price,
    date: input.date,
    time: input.time,
  };

  // Persist locally so the demo "manage" page can show it.
  try {
    const existing = JSON.parse(localStorage.getItem(DEMO_KEY) || '[]');
    localStorage.setItem(DEMO_KEY, JSON.stringify([booking, ...existing]));
  } catch {
    // ignore
  }

  return { ok: true, booking };
}

export async function submitBooking(
  input: SubmitBookingInput
): Promise<SubmitBookingResult> {
  // VITE injects import.meta.env at build time. The fallback keeps the demo
  // path working when no backend is configured.
  const url =
    (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: Record<string, string> }).env?.VITE_BOOKING_API_URL) ||
    '';

  if (!url) {
    // No backend configured — use the local demo path.
    return submitDemo(input);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch (err) {
    return {
      ok: false,
      error: 'Could not reach the booking service. Please try again later.',
    };
  }

  let data: BackendResponse;
  try {
    data = (await response.json()) as BackendResponse;
  } catch {
    return { ok: false, error: 'The booking service returned an unexpected response.' };
  }

  if (!data || !data.ok || !data.booking) {
    return { ok: false, error: data?.error || 'Your request could not be submitted.' };
  }

  return {
    ok: true,
    booking: {
      ref: String(data.booking.ref || ''),
      status: String(data.booking.status || 'Pending Approval'),
      service: String(data.booking.service || ''),
      price: Number(data.booking.price) || 0,
      date: String(data.booking.date || ''),
      time: String(data.booking.time || ''),
    },
  };
}

/** Read-only helper used by the demo management page. */
export function getDemoBookings(): Array<Record<string, unknown>> {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEY) || '[]');
  } catch {
    return [];
  }
}