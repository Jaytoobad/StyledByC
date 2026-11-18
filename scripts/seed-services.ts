import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { count, eq } from 'drizzle-orm';
import { loadEnv } from 'vite';
import { services as catalogue } from '../src/config.js';
import { services } from '../src/db/schema.js';

const localEnv = loadEnv('development', process.cwd(), '');
const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.NEON_DATABASE_URL ||
  localEnv.DATABASE_URL ||
  localEnv.NEON_DATABASE_URL;

if (!databaseUrl) {
  throw new Error('[db:seed-services] DATABASE_URL or NEON_DATABASE_URL is required.');
}

let targetHost: string;
try {
  targetHost = new URL(databaseUrl).hostname;
} catch {
  throw new Error('[db:seed-services] The configured database URL is invalid.');
}

if (targetHost.includes('-pooler')) {
  throw new Error(
    '[db:seed-services] Use the direct, unpooled database URL for this seed operation.',
  );
}

if (process.env.DRIZZLE_CONFIRM_DATABASE_HOST?.trim() !== targetHost) {
  throw new Error(
    `[db:seed-services] No database changes were made. Confirm the Neon target, then set DRIZZLE_CONFIRM_DATABASE_HOST=${targetHost} in this terminal and retry.`,
  );
}

const sql = neon(databaseUrl);
const db = drizzle(sql);

const [existing] = await db.select({ total: count() }).from(services);
if (Number(existing.total) > 0) {
  throw new Error(
    `[db:seed-services] Refusing to overwrite an existing catalogue (${existing.total} rows). No changes were made.`,
  );
}

await db.insert(services).values(
  catalogue.map((service, sortOrder) => ({
    id: service.id,
    name: service.name,
    category: service.category,
    description: service.description,
    price: service.price,
    duration: service.duration,
    photoRequired: service.photoRequired ?? false,
    tintGuideRequired: service.tintGuideRequired ?? false,
    image: service.image,
    gallery: service.gallery,
    active: true,
    sortOrder,
  })),
);

const seeded = await db
  .select({ id: services.id, active: services.active })
  .from(services)
  .where(eq(services.active, true));

if (seeded.length !== catalogue.length) {
  throw new Error(
    `[db:seed-services] Expected ${catalogue.length} active services after seeding, found ${seeded.length}.`,
  );
}

console.log(`[db:seed-services] Seeded and verified ${seeded.length} active services.`);
