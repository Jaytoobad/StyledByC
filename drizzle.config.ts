import { defineConfig } from 'drizzle-kit';
import { loadEnv } from 'vite';

const localEnv = loadEnv('development', process.cwd(), '');
const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.NEON_DATABASE_URL ||
  localEnv.DATABASE_URL ||
  localEnv.NEON_DATABASE_URL;

if (!databaseUrl) {
  throw new Error('[db] DATABASE_URL or NEON_DATABASE_URL must be set before using Drizzle.');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrl },
});
