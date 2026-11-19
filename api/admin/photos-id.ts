/**
 * Serve private booking photos to authorized admins.
 *
 * Photos are stored inline in Neon Postgres as bytea (photo_data column).
 * Vercel Blob is no longer used for booking photos.
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
    if (!photo.photoData) {
      return sendJson(res, 404, { ok: false, error: 'Photo content is not available.' });
    }
    const buf = Buffer.from(photo.photoData);
    if (buf.byteLength > 2 * 1024 * 1024) {
      return sendJson(res, 413, { ok: false, error: 'Photo exceeds the allowed size.' });
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', photo.mimeType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, no-store');
    res.end(buf);
    return;
  } catch (e) {
    console.error('[admin/photos-id] error:', e);
    return sendJson(res, 500, { ok: false, error: 'Failed to load photo.' });
  }
}
