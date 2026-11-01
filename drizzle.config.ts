import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || 'postgresql://localhost:5432/postgres';

if (!process.env.DATABASE_URL && !process.env.NEON_DATABASE_URL) {
  console.warn('[db] DATABASE_URL is not configured. Drizzle migrations will fail until it is set.');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrl },
});
