/**
 * StyledByC — seed availability table.
 *
 * Seeds the next 30 days (Mon-Sat, 09:00-17:00 hourly) into the Neon
 * availability table. Idempotent: clears the seeded range first.
 *
 * Run: DATABASE_URL="..." npx tsx scripts/seed-availability.ts
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import * as schema from '../src/db/schema.ts';

const DAYS_AHEAD = 30;
const OPEN_DAYS = [1, 2, 3, 4, 5, 6]; // Mon-Sat
const OPEN_HOUR = 9;
const CLOSE_HOUR = 17;

const sqlx = neon(process.env.DATABASE_URL!);
const dbx = drizzle(sqlx, { schema });

const today = new Date();
today.setHours(0, 0, 0, 0);

const rows: typeof schema.availability.$inferInsert[] = [];
for (let i = 0; i < DAYS_AHEAD; i++) {
  const d = new Date(today);
  d.setDate(today.getDate() + i);
  if (!OPEN_DAYS.includes(d.getDay())) continue;
  const iso = d.toISOString().split('T')[0];
  const date = new Date(`${iso}T00:00:00`);
  for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
    rows.push({ date, startTime: `${String(h).padStart(2, '0')}:00`, endTime: `${String(h + 1).padStart(2, '0')}:00`, isOpen: true });
  }
}

const rangeStart = today;
const rangeEnd = new Date(today);
rangeEnd.setDate(today.getDate() + DAYS_AHEAD);

await dbx.delete(schema.availability).where(sql`${schema.availability.date} >= ${rangeStart} and ${schema.availability.date} < ${rangeEnd}`);
await dbx.insert(schema.availability).values(rows);
console.log(`Seeded ${rows.length} availability slots (${rangeStart.toISOString().slice(0, 10)} to ${rangeEnd.toISOString().slice(0, 10)}).`);
process.exit(0);
