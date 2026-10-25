/**
 * StyledByC booking API client.
 *
 * The browser submits bookings to the same-origin /api/bookings route (Vercel
 * serverless function). That route proxies to the Google Apps Script web app
 * using the server-side APPS_SCRIPT_URL environment variable. No frontend
 * configuration is required.
 */

export type BookingResponse = {
  ok: boolean;
  booking?: {
    ref: string;
    status: string;
    service: string;
    price: number;
    date: string;
    time: string;
  };
  error?: string;
};

export type BookingPayload = {
  serviceId: string;
  date: string;
  time: string;
  name: string;
  email: string;
  phone: string;
  note?: string;
};

export async function submitBooking(payload: BookingPayload): Promise<BookingResponse> {
  const url = '/api/bookings';

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, error: 'Network error. Please check your connection and try again.' };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: 'The server returned an unexpected response.' };
  }

  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'The server returned an unexpected response.' };
  }

  const body = data as { ok?: unknown; booking?: unknown; error?: unknown };
  if (body.ok === true && body.booking && typeof body.booking === 'object') {
    return { ok: true, booking: body.booking as BookingResponse['booking'] };
  }

  return {
    ok: false,
    error: typeof body.error === 'string' ? body.error : 'Your request could not be submitted.',
  };
}

export type AdminBooking = {
  ref: string;
  createdAt?: string;
  name: string;
  email: string;
  phone: string;
  service: string;
  date: string;
  time: string;
  price: number | null;
  paymentStatus?: string;
  status: string;
};

export type AdminListResponse = {
  ok: boolean;
  headers?: string[];
  rows?: AdminBooking[];
  error?: string;
};

export type AdminActionResponse = {
  ok: boolean;
  booking?: AdminBooking;
  status?: string;
  notificationSent?: boolean;
  duplicate?: boolean;
  notificationError?: string;
  error?: string;
};

export async function adminListBookings(token: string): Promise<AdminListResponse> {
  const url = '/api/admin/bookings';
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list', token }),
    });
  } catch {
    return { ok: false, error: 'Network error.' };
  }
   try {
     const text = await res.text();
     let data: any;
     try { data = JSON.parse(text); } catch {
       return { ok: false, error: 'Server returned an unexpected response ' + text.slice(0,150) };
     }
     if (data && typeof data === 'object') {
       return data as AdminListResponse;
     }
     return { ok: false, error: 'Server returned an unexpected response ' + text.slice(0,150) };
   } catch {}
  return { ok: false, error: 'Unexpected response.' };
}

export async function adminApproveBooking(token: string, ref: string): Promise<AdminActionResponse> {
  const url = '/api/admin/bookings';
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', token, ref }),
    });
  } catch {
    return { ok: false, error: 'Network error.' };
  }
  try {
    const data = await res.json();
    if (data && typeof data === 'object') {
      return data as AdminActionResponse;
    }
  } catch {}
  return { ok: false, error: 'Unexpected response.' };
}

export async function adminRejectBooking(token: string, ref: string): Promise<AdminActionResponse> {
  const url = '/api/admin/bookings';
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', token, ref }),
    });
  } catch {
    return { ok: false, error: 'Network error.' };
  }
  try {
    const data = await res.json();
    if (data && typeof data === 'object') {
      return data as AdminActionResponse;
    }
  } catch {}
  return { ok: false, error: 'Unexpected response.' };
}

export async function adminCancelBooking(token: string, ref: string): Promise<AdminActionResponse> {
  const url = '/api/admin/bookings';
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel', token, ref }),
    });
  } catch {
    return { ok: false, error: 'Network error.' };
  }
  try {
    const data = await res.json();
    if (data && typeof data === 'object') {
      return data as AdminActionResponse;
    }
  } catch {}
  return { ok: false, error: 'Unexpected response.' };
}

export function getDemoBookings(): Array<Record<string, unknown>> {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem('styledbyc-demo-availability-cache');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Array<Record<string, unknown>>;
  } catch {
    return [];
  }
}
