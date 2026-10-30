/**
 * StyledByC booking API client.
 *
 * The browser submits bookings to the same-origin /api/bookings route (Vercel
 * serverless function). That route validates and records the booking itself
 * (Neon + Vercel Blob); no upstream URL is needed from the frontend.
 *
 * Admin endpoints use HttpOnly cookie-based authentication. fetch calls use
 * `credentials: 'include'` so the `admin_session` cookie is sent automatically.
 * State-changing requests also include the `X-XSRF-TOKEN` header (double-submit
 * CSRF pattern) read from the `XSRF-TOKEN` cookie.
 */

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*=\\s*([^;]*)'));
  return match ? match[1] : null;
}

function jsonHeaders(): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const xsrf = getCookie('XSRF-TOKEN');
  if (xsrf) headers['X-XSRF-TOKEN'] = xsrf;
  return headers;
}

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
  paymentOption?: string;
  amountPaid?: number;
  balanceDue?: number;
  paymentStatus?: string;
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
  paymentOption?: string;
  amountPaid?: number | null;
  balanceDue?: number | null;
  paymentReference?: string;
  paymentStatus?: string;
  paidAt?: string;
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

export async function adminListBookings(): Promise<AdminListResponse> {
  const url = '/api/admin/bookings';
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: jsonHeaders(),
      body: JSON.stringify({ action: 'list' }),
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

export async function adminApproveBooking(ref: string): Promise<AdminActionResponse> {
  const url = '/api/admin/bookings';
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: jsonHeaders(),
      body: JSON.stringify({ action: 'approve', ref }),
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

export async function adminRejectBooking(ref: string): Promise<AdminActionResponse> {
  const url = '/api/admin/bookings';
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: jsonHeaders(),
      body: JSON.stringify({ action: 'reject', ref }),
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

export async function adminCancelBooking(ref: string): Promise<AdminActionResponse> {
  const url = '/api/admin/bookings';
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: jsonHeaders(),
      body: JSON.stringify({ action: 'cancel', ref }),
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

export async function adminLogin(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  let res: Response;
  try {
    res = await fetch('/api/admin/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { ok: false, error: 'Network error.' };
  }
  try {
    const data = await res.json();
    if (res.ok && data && typeof data === 'object' && (data as any).ok === true) {
      return { ok: true };
    }
    return { ok: false, error: (data && typeof data === 'object' && typeof (data as any).error === 'string') ? (data as any).error : 'Login failed.' };
  } catch {
    return { ok: false, error: 'Unexpected response.' };
  }
}

export async function adminLogout(): Promise<{ ok: boolean; error?: string }> {
  let res: Response;
  try {
    res = await fetch('/api/admin/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: jsonHeaders(),
    });
  } catch {
    return { ok: false, error: 'Network error.' };
  }
  try {
    const data = await res.json();
    if (res.ok && data && typeof data === 'object' && (data as any).ok === true) {
      return { ok: true };
    }
    return { ok: false, error: 'Logout failed.' };
  } catch {
    return { ok: false, error: 'Unexpected response.' };
  }
}

export async function adminMe(): Promise<{ ok: boolean; user?: { id: string; email: string }; error?: string }> {
  let res: Response;
  try {
    res = await fetch('/api/admin/auth/me', {
      method: 'GET',
      credentials: 'include',
    });
  } catch {
    return { ok: false, error: 'Network error.' };
  }
  try {
    const data = await res.json();
    if (res.ok && data && typeof data === 'object' && (data as any).ok === true) {
      return { ok: true, user: data.user };
    }
    return { ok: false, error: (data && typeof data === 'object' && typeof (data as any).error === 'string') ? (data as any).error : 'Session check failed.' };
  } catch {
    return { ok: false, error: 'Unexpected response.' };
  }
}

export type AdminApproveResponse = { ok: boolean; booking?: AdminBooking; payLink?: string; deadline?: string; error?: string };

export type PaymentVerifyPayload = { reference: string; bookingRef?: string };

export type PaymentVerifyResponse = { ok: boolean; booking?: { ref: string; status: string; paymentStatus: string; amountPaid: number; balanceDue: number; service: string; date: string; time: string; price: number }; error?: string };

export async function verifyPayment(payload: PaymentVerifyPayload): Promise<PaymentVerifyResponse> {
  const url = '/api/pay/verify';
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
    return { ok: true, booking: body.booking as PaymentVerifyResponse['booking'] };
  }
  return { ok: false, error: typeof body.error === 'string' ? body.error : 'Payment verification failed.' };
}

export type PayPageBooking = { ok: boolean; valid?: boolean; booking?: { ref: string; status: string; service: string; approvedSlotDate: string; approvedSlotTime: string; price: number; fee: number; amountPaid: number; balanceDue: number; paymentDeadline: string; paymentReference?: string; paymentStatus: string; paidAt?: string; email: string; name: string }; error?: string };

export async function getPayPage(ref: string, token: string): Promise<PayPageBooking> {
  const url = `/api/pay/${encodeURIComponent(ref)}?t=${encodeURIComponent(token)}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    return { ok: false, error: 'Network error.' };
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: 'The server returned an unexpected response.' };
  }
  if (!data || typeof data !== 'object') return { ok: false, error: 'The server returned an unexpected response.' };
  return data as PayPageBooking;
}

export async function adminApproveBookingPay(ref: string): Promise<AdminApproveResponse> { const url = '/api/admin/pay-approve'; let res: Response; try { res = await fetch(url, { method: 'POST', credentials: 'include', headers: jsonHeaders(), body: JSON.stringify({ action: 'approve', ref }) }); } catch { return { ok: false, error: 'Network error.' }; } let data: unknown; try { data = await res.json(); } catch { return { ok: false, error: 'The server returned an unexpected response.' }; } if (!data || typeof data !== 'object') return { ok: false, error: 'The server returned an unexpected response.' }; return data as AdminApproveResponse; }

export type ServiceRow = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  duration: number;
  photoRequired: boolean;
  tintGuideRequired: boolean;
  image: string;
  gallery: string[];
  active: boolean;
  sortOrder: number;
  updatedAt?: string;
};

export type ServiceUpsertInput = {
  action?: 'upsert' | 'delete';
  id?: string;
  name?: string;
  category?: string;
  description?: string;
  price?: number;
  duration?: number;
  photoRequired?: boolean;
  tintGuideRequired?: boolean;
  image?: string;
  gallery?: string[];
  active?: boolean;
  sortOrder?: number;
};

export type ServiceListResponse = { ok: boolean; services?: ServiceRow[]; error?: string };
export type ServiceUpsertResponse = { ok: boolean; service?: ServiceRow; error?: string };

export async function adminListServices(): Promise<ServiceListResponse> {
  let res: Response;
  try {
    res = await fetch('/api/services', { method: 'GET', credentials: 'include', headers: jsonHeaders() });
  } catch { return { ok: false, error: 'Network error.' }; }
  try {
    const data = await res.json();
    if (data && typeof data === 'object') return data as ServiceListResponse;
  } catch {}
  return { ok: false, error: 'Unexpected response.' };
}

export async function adminUpsertService(input: ServiceUpsertInput): Promise<ServiceUpsertResponse> {
  let res: Response;
  try {
    res = await fetch('/api/admin/services', {
      method: 'POST',
      credentials: 'include',
      headers: jsonHeaders(),
      body: JSON.stringify(input),
    });
  } catch { return { ok: false, error: 'Network error.' }; }
  try {
    const data = await res.json();
    if (data && typeof data === 'object') return data as ServiceUpsertResponse;
  } catch {}
  return { ok: false, error: 'Unexpected response.' };
}

export async function adminDeleteService(id: string): Promise<ServiceUpsertResponse> {
  return adminUpsertService({ action: 'delete', id });
}



