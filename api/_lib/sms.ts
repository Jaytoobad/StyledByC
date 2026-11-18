/**
 * StyledByC — SasuSync SMS helper (server-only).
 */

import { db } from '../../src/db/index.js';
import { notifications } from '../../src/db/schema.js';
import { and, eq } from 'drizzle-orm';

type SendSmsOptions = {
  bookingId?: string | null;
  event?: string | null;
};

export type SmsResult = {
  status: 'sent' | 'stubbed' | 'failed' | 'unknown';
  error?: string;
};

function env(name: string): string {
  const v = process.env[name];
  return typeof v === 'string' ? v.trim() : '';
}

function maskPhone(to: string): string {
  if (!to) return '';
  if (to.length <= 4) return '****';
  return to.slice(0, 3) + '****' + to.slice(-2);
}

function normalizeGhanaNumber(to: string): string {
  const cleaned = to.replace(/[\s\-()]/g, '');
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
  if (mode === 'sandbox') {
    const sandboxUrl = env('SMS_SANDBOX_URL');
    if (!sandboxUrl) {
      throw new Error('[sms] SMS_SANDBOX_URL required for sandbox mode');
    }
    return sandboxUrl;
  }

  const apiUrl = env('SMS_API_URL');
  if (apiUrl) return apiUrl;
  if (mode === 'live') {
    return 'https://sms.sasusync.com/api/v1/send';
  }
  throw new Error('[sms] SMS_API_URL or SMS_SANDBOX_URL required');
}

function getAuthHeaderName(): string {
  const h = env('SMS_AUTH_HEADER');
  return h || 'X-API-Key';
}

function getApiKey(): string {
  const k = env('SMS_API_KEY') || env('SASUSYNC_API_KEY');
  return k;
}

let missingEnvLogged = false;
export function getMissingSmsEnvVars(): string[] {
  const missing: string[] = [];
  if (!(env('SMS_API_KEY') || env('SASUSYNC_API_KEY')))
    missing.push('SMS_API_KEY/SASUSYNC_API_KEY');
  if (!env('SMS_SENDER_ID')) missing.push('SMS_SENDER_ID');
  return missing;
}

async function logNotification(params: {
  bookingId: string;
  event: string;
  toNumber: string;
  status: 'sent' | 'failed' | 'unknown';
  jobId?: string | null;
  error?: string | null;
}) {
  try {
    const existing = await db
      .select()
      .from(notifications)
      .where(
        and(eq(notifications.bookingId, params.bookingId), eq(notifications.event, params.event)),
      )
      .limit(1);
    if (existing.length) {
      if (existing[0].status === 'sent') {
        return;
      }
      await db
        .update(notifications)
        .set({
          status: params.status,
          toNumber: params.toNumber,
          jobId: params.jobId ?? null,
          error: params.error ?? null,
        })
        .where(eq(notifications.id, existing[0].id));
      return;
    }
    await db.insert(notifications).values({
      bookingId: params.bookingId,
      event: params.event,
      toNumber: params.toNumber,
      status: params.status,
      jobId: params.jobId ?? null,
      error: params.error ?? null,
    });
  } catch (e) {
    console.error('[sms] failed to log notification:', e);
  }
}

async function claimNotification(
  bookingId: string,
  event: string,
  toNumber: string,
): Promise<boolean> {
  try {
    const [inserted] = await db
      .insert(notifications)
      .values({
        bookingId,
        event,
        toNumber,
        status: 'unknown',
        error: 'delivery_in_progress',
      })
      .onConflictDoNothing()
      .returning({ id: notifications.id });
    if (inserted) return true;

    const [existing] = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.bookingId, bookingId), eq(notifications.event, event)))
      .limit(1);
    if (!existing || existing.status !== 'failed') return false;

    const [retry] = await db
      .update(notifications)
      .set({ status: 'unknown', toNumber, error: 'delivery_in_progress' })
      .where(and(eq(notifications.id, existing.id), eq(notifications.status, 'failed')))
      .returning({ id: notifications.id });
    return !!retry;
  } catch (e) {
    console.error('[sms] notification claim failed; skipping send:', e);
    return false;
  }
}

export async function sendSms(
  to: string,
  message: string,
  opts: SendSmsOptions = {},
): Promise<SmsResult> {
  const smsMode = env('SMS_MODE');
  const isProd = process.env.VERCEL_ENV === 'production';
  if (isProd && !missingEnvLogged) {
    const missing = getMissingSmsEnvVars();
    if (missing.length) {
      console.error('[sms] missing env vars:', missing.join(', '));
    }
    missingEnvLogged = true;
  }
  if (smsMode === 'stub') {
    console.log('[sms:stub]', maskPhone(to), '| event:', opts.event || 'unknown');
    return { status: 'stubbed' };
  }
  if (smsMode !== 'live' && smsMode !== 'sandbox') {
    if (isProd) {
      console.error('[sms] SMS_MODE not set in production - failing loudly (not stubbing)');
      const bookingId = opts.bookingId || null;
      const event = opts.event || null;
      if (bookingId && event) {
        await logNotification({
          bookingId,
          event,
          toNumber: to,
          status: 'failed',
          jobId: null,
          error: 'sms_mode_unset_prod',
        });
      }
      return { status: 'failed', error: 'sms_mode_unset_prod' };
    } else {
      console.log('[sms:stub:dev]', maskPhone(to), '| event:', opts.event || 'unknown');
      return { status: 'stubbed' };
    }
  }

  try {
    if (message.length > 650) {
      message = message.slice(0, 650);
    }
    let normalized: string;
    try {
      normalized = normalizeGhanaNumber(to);
    } catch (e: any) {
      console.error('[sms] normalization error:', maskPhone(to), e?.message || e);
      const bookingId = opts.bookingId || null;
      const event = opts.event || null;
      if (bookingId && event) {
        await logNotification({
          bookingId,
          event,
          toNumber: to,
          status: 'failed',
          jobId: null,
          error: 'invalid_number',
        });
      }
      return { status: 'failed', error: 'invalid_number' };
    }

    const apiKey = getApiKey();
    const sender = env('SMS_SENDER_ID');
    if (!apiKey || !sender) {
      console.error('[sms] missing SMS_API_KEY/SASUSYNC_API_KEY or SMS_SENDER_ID');
      const bookingId = opts.bookingId || null;
      const event = opts.event || null;
      if (bookingId && event) {
        await logNotification({
          bookingId,
          event,
          toNumber: normalized,
          status: 'failed',
          jobId: null,
          error: 'missing_credentials',
        });
      }
      return { status: 'failed', error: 'missing_credentials' };
    }

    const bookingId = opts.bookingId || null;
    const event = opts.event || null;
    if (bookingId && event && !(await claimNotification(bookingId, event, normalized))) {
      return { status: 'unknown', error: 'notification_not_claimed' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let res: Response;
    try {
      res = await fetch(getBaseUrl(), {
        method: 'POST',
        headers: {
          [getAuthHeaderName()]: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: sender,
          recipients: [normalized],
          message: message,
        }),
        signal: controller.signal,
      });
    } catch (e: any) {
      clearTimeout(timeout);
      console.error(
        '[sms] timeout/network error:',
        e?.name || e,
        '| to:',
        maskPhone(normalized),
        '| event:',
        event || 'unknown',
      );
      if (bookingId && event) {
        await logNotification({
          bookingId,
          event,
          toNumber: normalized,
          status: 'unknown',
          jobId: null,
          error: e?.name || 'network_error',
        });
      }
      return { status: 'unknown', error: e?.name || 'network_error' };
    }
    clearTimeout(timeout);

    let data: any = null;
    try {
      data = await res.json();
    } catch (e) {
      console.error('[sms] provider response was not valid JSON:', e);
      data = null;
    }

    const providerMsg =
      data?.message || data?.error || data?.msg || (typeof data === 'string' ? data : null);

    if (res.status === 402) {
      console.error(
        '[sms] out of credit (402)',
        '| to:',
        maskPhone(normalized),
        '| event:',
        event || 'unknown',
        '| provider:',
        providerMsg || 'n/a',
      );
      if (bookingId && event) {
        await logNotification({
          bookingId,
          event,
          toNumber: normalized,
          status: 'failed',
          jobId: data?.data?.job_id || data?.job_id || null,
          error: providerMsg || '402_out_of_credit',
        });
      }
      return { status: 'failed', error: providerMsg || '402_out_of_credit' };
    }
    if (res.status === 400 || res.status === 403 || res.status === 422) {
      console.error(
        '[sms] do not retry:',
        res.status,
        '| to:',
        maskPhone(normalized),
        '| event:',
        event || 'unknown',
        '| provider:',
        providerMsg || 'n/a',
      );
      if (bookingId && event) {
        await logNotification({
          bookingId,
          event,
          toNumber: normalized,
          status: 'failed',
          jobId: data?.data?.job_id || data?.job_id || null,
          error: providerMsg || String(res.status),
        });
      }
      return { status: 'failed', error: providerMsg || String(res.status) };
    }
    if (res.status === 429 || res.status === 500 || res.status === 503) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        await new Promise((r) => setTimeout(r, attempt * 500));
        try {
          const r2 = await fetch(getBaseUrl(), {
            method: 'POST',
            headers: {
              [getAuthHeaderName()]: apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sender: sender,
              recipients: [normalized],
              message: message,
            }),
            signal: AbortSignal.timeout(10000),
          });
          let d2: any = null;
          try {
            d2 = await r2.json();
          } catch (e) {
            console.error('[sms] retry response was not valid JSON:', e);
          }
          const p2 = d2?.message || d2?.error || d2?.msg || null;
          if (r2.ok && (d2?.success === true || d2?.queued === true || d2?.data)) {
            console.log(
              '[sms] sent after retry',
              '| status:',
              r2.status,
              '| to:',
              maskPhone(normalized),
              '| event:',
              event || 'unknown',
              '| provider:',
              p2 || 'ok',
            );
            if (bookingId && event) {
              await logNotification({
                bookingId,
                event,
                toNumber: normalized,
                status: 'sent',
                jobId: d2?.data?.job_id || d2?.job_id || null,
                error: null,
              });
            }
            return { status: 'sent' };
          }
          console.log(
            '[sms] retry failed',
            attempt,
            '| status:',
            r2.status,
            '| to:',
            maskPhone(normalized),
            '| event:',
            event || 'unknown',
            '| provider:',
            p2 || 'n/a',
          );
          if (r2.status === 402 || r2.status === 400 || r2.status === 403 || r2.status === 422) {
            break;
          }
        } catch (e: any) {
          console.error(
            '[sms] retry error',
            attempt,
            '| to:',
            maskPhone(normalized),
            '| event:',
            event || 'unknown',
            e?.name || e,
          );
        }
      }
      if (bookingId && event) {
        await logNotification({
          bookingId,
          event,
          toNumber: normalized,
          status: 'failed',
          jobId: null,
          error: providerMsg || 'retry_exhausted',
        });
      }
      console.error(
        '[sms] failed after retries',
        '| to:',
        maskPhone(normalized),
        '| event:',
        event || 'unknown',
        '| provider:',
        providerMsg || 'n/a',
      );
      return { status: 'failed', error: providerMsg || 'retry_exhausted' };
    }

    if (res.ok && (data?.success === true || data?.queued === true || data?.data)) {
      console.log(
        '[sms] sent',
        '| status:',
        res.status,
        '| to:',
        maskPhone(normalized),
        '| event:',
        event || 'unknown',
        '| provider:',
        providerMsg || 'ok',
      );
      if (bookingId && event) {
        await logNotification({
          bookingId,
          event,
          toNumber: normalized,
          status: 'sent',
          jobId: data?.data?.job_id || data?.job_id || null,
          error: null,
        });
      }
      return { status: 'sent' };
    }

    console.error(
      '[sms] unknown response',
      '| status:',
      res.status,
      '| to:',
      maskPhone(normalized),
      '| event:',
      event || 'unknown',
      '| provider:',
      providerMsg || 'n/a',
    );
    if (bookingId && event) {
      await logNotification({
        bookingId,
        event,
        toNumber: normalized,
        status: 'failed',
        jobId: data?.data?.job_id || data?.job_id || null,
        error: providerMsg || 'unknown_response',
      });
    }
    return { status: 'failed', error: providerMsg || 'unknown_response' };
  } catch (e) {
    console.error('[sms] unexpected error:', e);
    return { status: 'failed', error: 'unexpected_error' };
  }
}
