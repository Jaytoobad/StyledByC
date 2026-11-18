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
    const blob = await get(photo.blobUrl, { access: 'private' } as any);
    if (!blob) {
      return sendJson(res, 404, { ok: false, error: 'Photo not found.' });
    }
    const response =
      blob && typeof blob === 'object' && 'stream' in (blob as any)
        ? (blob as any)
        : await fetch(((blob as any).url as string | undefined) ?? photo.blobUrl);
    if (!response || !(response as Response).body) {
      return sendJson(res, 502, { ok: false, error: 'Photo content is not available.' });
    }
    const arrayBuffer = await (response as Response).arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    if (buf.byteLength > 2 * 1024 * 1024) {
      return sendJson(res, 413, { ok: false, error: 'Photo exceeds the allowed size.' });
    }
    res.statusCode = 200;
    res.setHeader(
      'Content-Type',
      photo.mimeType || (response as any).blob?.contentType || 'application/octet-stream',
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.end(buf);
    return;
  } catch (e) {
    console.error('[admin/photos-id] error:', e);
    return sendJson(res, 500, { ok: false, error: 'Failed to load photo.' });
  }
}
