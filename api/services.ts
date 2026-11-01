import type { IncomingMessage, ServerResponse } from 'node:http';
import { asc } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { services } from '../src/db/schema.js';
import { services as configServices } from '../src/config.js';

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
    const rows = await db.select().from(services).orderBy(asc(services.sortOrder), asc(services.name));
    if (rows.length === 0) {
      console.warn('[services] table is empty; serving configured fallback prices');
      return sendJson(res, 200, { ok: true, services: configServices });
    }
    return sendJson(res, 200, { ok: true, services: rows.filter((service) => service.active) });
  } catch (e) {
    console.error('[services] list error:', e);
    return sendJson(res, 500, { ok: false, error: 'Failed to load services.' });
  }
}
