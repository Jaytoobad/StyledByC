/**
 * Serve private booking photos to authorized admins
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { eq } from 'drizzle-orm';
import { get } from '@vercel/blob';
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
    const blob = await get(photo.blobUrl, { access: 'private' });
    if (!blob) {
      return sendJson(res, 404, { ok: false, error: 'Photo not found.' });
    }
    if (!blob.stream) {
      return sendJson(res, 502, { ok: false, error: 'Photo content is not available.' });
    }
    const reader = blob.stream.getReader();
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > 2 * 1024 * 1024) {
        await reader.cancel();
        return sendJson(res, 413, { ok: false, error: 'Photo exceeds the allowed size.' });
      }
      chunks.push(Buffer.from(value));
    }
    const buf = Buffer.concat(chunks, totalBytes);
    res.statusCode = 200;
    res.setHeader('Content-Type', photo.mimeType || blob.blob.contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, no-store');
    res.end(buf);
    return;
  } catch (e) {
    console.error('[admin/photos-id] error:', e);
    return sendJson(res, 500, { ok: false, error: 'Failed to load photo.' });
  }
}
