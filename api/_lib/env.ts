/**
 * StyledByC - Validated environment variables.
 *
 * Reads required Production env vars once per cold start, logs the missing
 * NAMES (never values), and exposes them through a single `env` object.
 * Remove scattered process.env access with silent fallbacks in favour of
 * importing this module.
 */

type Env = {
  DATABASE_URL: string;
  PAYSTACK_SECRET_KEY: string;
  PAYSTACK_PUBLIC_KEY: string;
  CRON_SECRET: string;
  SESSION_TOKEN_SALT: string;
  SMS_MODE: 'live' | 'stub' | 'sandbox';
  SMS_API_URL: string;
  SMS_API_KEY: string;
  SMS_AUTH_HEADER: string;
  SMS_SANDBOX_URL: string;
  SMS_SENDER_ID: string;
  STUDIO_PHONE: string;
  OWNER_PHONE: string;
  OWNER_EMAIL: string;
};

const REQUIRED: Array<keyof Env> = [
  'DATABASE_URL',
  'PAYSTACK_SECRET_KEY',
  'PAYSTACK_PUBLIC_KEY',
  'CRON_SECRET',
  'SESSION_TOKEN_SALT',
  'SMS_MODE',
  'SMS_API_URL',
  'SMS_API_KEY',
  'SMS_SENDER_ID',
  'STUDIO_PHONE',
  'OWNER_PHONE',
  'OWNER_EMAIL',
];

const OPTIONAL: Array<keyof Env> = ['SMS_AUTH_HEADER', 'SMS_SANDBOX_URL'];

const ENV_ALIASES: Record<string, string[]> = {
  PAYSTACK_PUBLIC_KEY: ['VITE_PAYSTACK_PUBLIC_KEY'],
  SMS_API_KEY: ['SASUSYNC_API_KEY'],
  DATABASE_URL: ['NEON_DATABASE_URL'],
};

function read(name: string): string {
  const candidates = [name, ...(ENV_ALIASES[name] ?? [])];
  for (const key of candidates) {
    const v = process.env[key];
    if (typeof v === 'string') {
      const trimmed = v.trim();
      if (trimmed) return trimmed;
    }
  }
  return '';
}

function validate(): Env {
  const missing: string[] = [];
  const out = {} as Env;

  for (const name of REQUIRED) {
    const v = read(name);
    if (!v) missing.push(name);
    (out as any)[name] = v;
  }
  for (const name of OPTIONAL) {
    (out as any)[name] = read(name);
  }

  if (missing.length) {
    console.error('[env] Missing required variables: ' + missing.join(', '));
  }

  const smsMode = read('SMS_MODE').toLowerCase();
  if (!['live', 'stub', 'sandbox'].includes(smsMode)) {
    console.error('[env] SMS_MODE must be live, stub, or sandbox');
  }

  return out;
}

export const env = validate();
