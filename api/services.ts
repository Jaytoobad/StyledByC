import type { IncomingMessage, ServerResponse } from 'node:http';
import { asc, eq } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { services } from '../src/db/schema.js';

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
  }
  try {
    const rows = await db.select().from(services).where(eq(services.active, true)).orderBy(asc(services.sortOrder), asc(services.name));
    return sendJson(res, 200, { ok: true, services: rows });
  } catch (e) {
    console.error('[services] list error:', e);
    return sendJson(res, 500, { ok: false, error: 'Failed to load services.' });
  }
}
