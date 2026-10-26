import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../src/db/schema.ts';
import { scryptSync, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';

const email = process.env.OWNER_EMAIL?.trim();
const password = process.env.OWNER_PASSWORD;
if (!email || !password) {
  console.error('OWNER_EMAIL and OWNER_PASSWORD must be set in .env.local');
  process.exit(1);
}
const salt = randomBytes(16).toString('hex');
const hash = `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
const db = drizzle(neon(process.env.DATABASE_URL!), { schema });
await db.update(schema.adminUsers).set({ passwordHash: hash }).where(eq(schema.adminUsers.email, email));
console.log(`Owner ${email} password reset. Delete OWNER_PASSWORD from .env.local now.`);
process.exit(0);
EOF