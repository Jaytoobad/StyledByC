/**
 * StyledByC - Validated environment variables.
 *
 * Reads required Production env vars once per cold start (fail-fast), logs
 * the missing NAMES (never values), and exposes them through a single `env`
 * object. Values are read lazily on each access so tests can override
 * process.env before invoking handlers. Remove scattered process.env access
 * with silent fallbacks in favour of importing this module.
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

function validate(): void {
  const missing: string[] = [];
  for (const name of REQUIRED) {
    const v = read(name);
    if (!v) missing.push(name);
  }

  if (missing.length) {
    const msg = '[env] Missing required variables: ' + missing.join(', ');
    if (process.env.VERCEL_ENV === 'production') {
      throw new Error(msg);
    }
    console.error(msg);
  }

  const smsMode = read('SMS_MODE').toLowerCase();
  if (!['live', 'stub', 'sandbox'].includes(smsMode)) {
    console.error('[env] SMS_MODE must be live, stub, or sandbox');
  }
}

validate();

// Lazy access via Proxy so tests can override process.env before invoking handlers.
export const env = new Proxy({} as Record<keyof Env, unknown>, {
  get(_target: Record<keyof Env, unknown>, name: keyof Env) {
    return read(name);
  },
}) as Env;
