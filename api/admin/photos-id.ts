/**
 * Serve private booking photos to authorized admins
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { bookingPhotos } from '../../src/db/schema.js';
import { authorize } from '../_lib/admin-auth.js';

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
  }

  const auth = await authorize(req);
  if (!auth.authorized) {
    return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
  }

  const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
  const id = url.searchParams.get('id') || '';
  if (!id) {
    return sendJson(res, 400, { ok: false, error: 'Missing id.' });
  }
  try {
    const [photo] = await db.select().from(bookingPhotos).where(eq(bookingPhotos.id, id)).limit(1);
    if (!photo) {
      return sendJson(res, 404, { ok: false, error: 'Not found' });
    }
    const resp = await fetch(photo.blobUrl).catch(() => null);
    if (!resp || !resp.ok) {
      return sendJson(res, 502, { ok: false, error: 'Failed to fetch photo' });
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    res.statusCode = 200;
    res.setHeader('Content-Type', photo.mimeType || resp.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, no-store');
    res.end(buf);
    return;
  } catch (e) {
    console.error('[admin/photos-id] error:', e);
    return sendJson(res, 500, { ok: false, error: 'Failed to load photo.' });
  }
}
