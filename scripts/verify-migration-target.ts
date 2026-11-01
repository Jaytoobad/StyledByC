import { loadEnv } from 'vite';

const localEnv = loadEnv('development', process.cwd(), '');
const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.NEON_DATABASE_URL ||
  localEnv.DATABASE_URL ||
  localEnv.NEON_DATABASE_URL;

if (!databaseUrl) {
  throw new Error('[db:migrate] DATABASE_URL or NEON_DATABASE_URL is required.');
}

let targetHost: string;
try {
  targetHost = new URL(databaseUrl).hostname;
} catch {
  throw new Error('[db:migrate] The configured database URL is invalid.');
}

const confirmedHost = process.env.DRIZZLE_CONFIRM_DATABASE_HOST?.trim();
if (!confirmedHost) {
  throw new Error(
    `[db:migrate] No database changes were made. Review the target in Neon, then set DRIZZLE_CONFIRM_DATABASE_HOST=${targetHost} in this terminal and retry.`,
  );
}

if (confirmedHost !== targetHost) {
  throw new Error(
    `[db:migrate] No database changes were made. Confirmed host does not match configured database host ${targetHost}.`,
  );
}

console.log(`[db:migrate] Target host confirmed: ${targetHost}`);
