/**
 * StyledByC — Resend email helper.
 *
 * All outbound email is sent via the Resend HTTP API using the server-side
 * RESEND_API_KEY. Emails are plain-text, mobile-friendly, and never block a
 * booking flow: failures are logged and swallowed.
 */

type SendParams = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type SendResult = { ok: boolean; error?: string };

function env(name: string): string {
  const v = process.env[name];
  return typeof v === 'string' ? v.trim() : '';
}

function config() {
  return {
    apiKey: env('RESEND_API_KEY'),
    from: env('EMAIL_FROM'),
    ownerEmail: env('OWNER_EMAIL'),
  };
}

export function isEmailConfigured(): boolean {
  return Boolean(config().apiKey);
}

export function getOwnerEmail(): string {
  return config().ownerEmail;
}

function buildText(body: string): string {
  return body.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export async function sendEmail(params: SendParams): Promise<SendResult> {
  const { apiKey, from, ownerEmail } = config();
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY is not set.' };

  let to = params.to.trim();
  if (!to) return { ok: false, error: 'No recipient address.' };

  // If EMAIL_FROM is not verified with Resend, send only to the owner.
  if (!from) {
    console.warn('[email] EMAIL_FROM not set — falling back to OWNER_EMAIL only.');
    if (ownerEmail && to.toLowerCase() !== ownerEmail.toLowerCase()) {
      return { ok: false, error: 'EMAIL_FROM not verified; customer email skipped.' };
    }
    to = ownerEmail;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: from || ownerEmail,
      to,
      subject: params.subject,
      text: buildText(params.text),
      html: params.html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, error: `Resend ${res.status}: ${text.slice(0, 200)}` };
  }
  return { ok: true };
}

/** Fire-and-forget wrapper that never throws. */
export function notify(params: SendParams): void {
  sendEmail(params).then((r) => {
    if (!r.ok) console.warn('[email] failed:', r.error);
  });
}