import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

const databaseUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || 'postgresql://localhost:5432/postgres';
if (!process.env.DATABASE_URL && !process.env.NEON_DATABASE_URL) {
  console.warn('[db] DATABASE_URL is not configured. Set it before running database-backed code.');
}

const sql = neon(databaseUrl);
export const db = drizzle(sql, { schema });
