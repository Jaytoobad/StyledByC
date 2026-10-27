/**
 * StyledByC — SasuSync SMS helper (server-only).
 */

import { db } from '../../src/db/index';
import { notifications } from '../../src/db/schema';
import { and, eq } from 'drizzle-orm';

type SendSmsOptions = {
  bookingId?: string | null;
  event?: string | null;
};

function env(name: string): string {
  const v = process.env[name];
  return typeof v === 'string' ? v.trim() : '';
}

function normalizeGhanaNumber(to: string): string {
  const cleaned = to.replace(/[\s\-\(\)]/g, '');
  if (/^\+233[2-9][0-9]{8}$/.test(cleaned)) {
    return cleaned.replace('+', '');
  }
  if (/^233[2-9][0-9]{8}$/.test(cleaned)) {
    return cleaned;
  }
  if (/^0[2-9][0-9]{8}$/.test(cleaned)) {
    return '233' + cleaned.slice(1);
  }
  throw new Error('Invalid Ghana phone number');
}

function getBaseUrl(): string {
  const mode = env('SMS_MODE');
  if (mode === 'live') {
    return 'https://sms.sasulabs.me/api/v1/send';
  }
  return 'https://sms.sasulabs.me/smssandbox/v1/send';
}

export async function sendSms(to: string, message: string, opts: SendSmsOptions = {}): Promise<void> {
  try {
    if (message.length > 650) {
      message = message.slice(0, 650);
    }
    let normalized: string;
    try {
      normalized = normalizeGhanaNumber(to);
    } catch (e: any) {
      console.error('[sms] normalization error:', e?.message || e);
      return;
    }

    const apiKey = env('SASUSYNC_API_KEY');
    const sender = env('SMS_SENDER_ID');
    if (!apiKey || !sender) {
      console.error('[sms] missing SASUSYNC_API_KEY or SMS_SENDER_ID');
      return;
    }

    const bookingId = opts.bookingId || null;
    const event = opts.event || null;
    if (bookingId && event) {
      try {
        const existing = await db
          .select()
          .from(notifications)
          .where(and(eq(notifications.bookingId, bookingId), eq(notifications.event, event)))
          .limit(1);
        if (existing.length) {
          return;
        }
      } catch (e) {
        console.error('[sms] notification dedup check failed:', e);
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let res: Response;
    try {
      res = await fetch(getBaseUrl(), {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender,
          recipients: [normalized],
          message,
          metadata: {
            booking_ref: bookingId || '',
            event: event || '',
          },
        }),
        signal: controller.signal,
      });
    } catch (e: any) {
      clearTimeout(timeout);
      console.error('[sms] timeout/network error:', e?.name || e);
      if (bookingId && event) {
        try {
          await db.insert(notifications).values({
            bookingId,
            event,
            toNumber: normalized,
            status: 'unknown',
            jobId: null,
            error: e?.name || 'network_error',
          });
        } catch (err) {
          console.error('[sms] failed to log notification:', err);
        }
      }
      return;
    }
    clearTimeout(timeout);

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (res.status === 402) {
      console.error('[sms] out of credit (402) - alert owner');
      if (bookingId && event) {
        try {
          await db.insert(notifications).values({
            bookingId,
            event,
            toNumber: normalized,
            status: 'failed',
            jobId: null,
            error: '402_out_of_credit',
          });
        } catch (err) {
          console.error('[sms] failed to log notification:', err);
        }
      }
      return;
    }
    if (res.status === 400 || res.status === 403 || res.status === 422) {
      console.error('[sms] do not retry:', res.status);
      if (bookingId && event) {
        try {
          await db.insert(notifications).values({
            bookingId,
            event,
            toNumber: normalized,
            status: 'failed',
            jobId: null,
            error: String(res.status),
          });
        } catch (err) {
          console.error('[sms] failed to log notification:', err);
        }
      }
      return;
    }
    if (res.status === 429 || res.status === 500 || res.status === 503) {
      // retry up to 2 times with backoff
      for (let attempt = 1; attempt <= 2; attempt++) {
        await new Promise((r) => setTimeout(r, attempt * 500));
        try {
          const r2 = await fetch(getBaseUrl(), {
            method: 'POST',
            headers: {
              'X-API-Key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sender,
              recipients: [normalized],
              message,
              metadata: {
                booking_ref: bookingId || '',
                event: event || '',
              },
            }),
            signal: AbortSignal.timeout(10000),
          });
          let d2: any = null;
          try {
            d2 = await r2.json();
          } catch {}
          if (r2.ok && (d2?.success === true || d2?.queued === true || d2?.data)) {
            if (bookingId && event) {
              try {
                await db.insert(notifications).values({
                  bookingId,
                  event,
                  toNumber: normalized,
                  status: 'sent',
                  jobId: d2?.data?.job_id || d2?.job_id || null,
                  error: null,
                });
              } catch (err) {
                console.error('[sms] failed to log notification:', err);
              }
            }
            return;
          }
          if (r2.status === 402 || r2.status === 400 || r2.status === 403 || r2.status === 422) {
            break;
          }
        } catch {}
      }
      if (bookingId && event) {
        try {
          await db.insert(notifications).values({
            bookingId,
            event,
            toNumber: normalized,
            status: 'failed',
            jobId: null,
            error: 'retry_exhausted',
          });
        } catch (err) {
          console.error('[sms] failed to log notification:', err);
        }
      }
      return;
    }

    if (res.ok && (data?.success === true || data?.queued === true || data?.data)) {
      if (bookingId && event) {
        try {
          await db.insert(notifications).values({
            bookingId,
            event,
            toNumber: normalized,
            status: 'sent',
            jobId: data?.data?.job_id || data?.job_id || null,
            error: null,
          });
        } catch (err) {
          console.error('[sms] failed to log notification:', err);
        }
      }
      return;
    }

    if (bookingId && event) {
      try {
        await db.insert(notifications).values({
          bookingId,
          event,
          toNumber: normalized,
          status: 'failed',
          jobId: null,
          error: 'unknown_response',
        });
      } catch (err) {
        console.error('[sms] failed to log notification:', err);
      }
    }
    return;
  } catch (e) {
    console.error('[sms] unexpected error:', e);
    return;
  }
}
