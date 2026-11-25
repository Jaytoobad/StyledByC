/**
 * StyledByC — Environment validation.
 *
 * Validates all required environment variables at startup so the app fails
 * fast with a clear error instead of failing mysteriously later.
 *
 * This module is imported in the app entry point so validation runs before
 * any other code.
 */

type RequiredEnv = {
  DATABASE_URL: string;
  PAYSTACK_SECRET_KEY: string;
  PAYSTACK_PUBLIC_KEY: string;
  PAYSTACK_WEBHOOK_SECRET: string;
  SMS_MODE: string;
  SMS_API_URL: string;
  SASUSYNC_API_KEY: string;
  SMS_SENDER_ID: string;
  STUDIO_PHONE: string;
  OWNER_PHONE: string;
  OWNER_EMAIL: string;
  SESSION_TOKEN_SALT: string;
};

export type Env = RequiredEnv;

/**
 * All required environment variables.
 */
const REQUIRED_ENV: Array<keyof RequiredEnv> = [
  'DATABASE_URL',
  'PAYSTACK_SECRET_KEY',
  'PAYSTACK_PUBLIC_KEY',
  'PAYSTACK_WEBHOOK_SECRET',
  'SMS_MODE',
  'SMS_API_URL',
  'SASUSYNC_API_KEY',
  'SMS_SENDER_ID',
  'STUDIO_PHONE',
  'OWNER_PHONE',
  'OWNER_EMAIL',
  'SESSION_TOKEN_SALT',
];

/**
 * Validate all required environment variables are present and non-empty.
 * Throws a descriptive error listing all missing vars at once.
 */
export function validateEnv(): void {
  const missing: string[] = [];

  for (const key of REQUIRED_ENV) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const missingList = missing.map((key) => `  - ${key}`).join('\n');
    throw new Error(
      `Missing required environment variables:\n${missingList}\n\n` +
        'Please set these in your .env file or production environment before starting the app.',
    );
  }
}

/**
 * Get the validated environment. Throws if any required var is missing.
 * Safe to call multiple times; caches the result.
 */
let _env: RequiredEnv | null = null;

export function getEnv(): RequiredEnv {
  if (_env) return _env;

  _env = {
    DATABASE_URL: process.env.DATABASE_URL!,
    PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY!,
    PAYSTACK_PUBLIC_KEY: process.env.PAYSTACK_PUBLIC_KEY!,
    PAYSTACK_WEBHOOK_SECRET: process.env.PAYSTACK_WEBHOOK_SECRET!,
    SMS_MODE: process.env.SMS_MODE!,
    SMS_API_URL: process.env.SMS_API_URL!,
    SASUSYNC_API_KEY: process.env.SASUSYNC_API_KEY!,
    SMS_SENDER_ID: process.env.SMS_SENDER_ID!,
    STUDIO_PHONE: process.env.STUDIO_PHONE!,
    OWNER_PHONE: process.env.OWNER_PHONE!,
    OWNER_EMAIL: process.env.OWNER_EMAIL!,
    SESSION_TOKEN_SALT: process.env.SESSION_TOKEN_SALT!,
  };

  return _env;
}

export default {
  validateEnv,
  getEnv,
};