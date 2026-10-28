/**
 * StyledByC — Admin site images API
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { eq } from 'drizzle-orm';
import { put } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { db } from '../../src/db/index.js';
import { siteImages } from '../../src/db/schema.js';
import { authorize } from '../_lib/admin-auth.js';

const MAX_BODY_BYTES = 6 * 1024 * 1024;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    try {
      const rows = await db.select().from(siteImages).orderBy(siteImages.position, siteImages.slotKey);
      return sendJson(res, 200, { ok: true, images: rows });
    } catch (e) {
      console.error('[admin/site-images] list error:', e);
      return sendJson(res, 500, { ok: false, error: 'Failed to load images.' });
    }
  }

  const auth = await authorize(req);
  if (!auth.authorized) {
    return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
  }

  if (method === 'POST') {
    const contentLength = Number(req.headers['content-length'] || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return sendJson(res, 413, { ok: false, error: 'Request is too large.' });
    }
    let input: unknown;
    try {
      const raw = await readBody(req);
      if (!raw) return sendJson(res, 400, { ok: false, error: 'The request body is empty.' });
      input = JSON.parse(raw);
    } catch {
      return sendJson(res, 400, { ok: false, error: 'The request body could not be read.' });
    }
    if (!isPlainObject(input)) return sendJson(res, 400, { ok: false, error: 'Invalid request.' });
    const slotKey = String((input as any).slotKey || '').trim();
    const dataBase64 = String((input as any).dataBase64 || '');
    const mimeType = String((input as any).mimeType || '').trim();
    if (!slotKey) return sendJson(res, 400, { ok: false, error: 'Missing slotKey.' });
    if (!dataBase64) return sendJson(res, 400, { ok: false, error: 'Missing image data.' });
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(mimeType)) return sendJson(res, 400, { ok: false, error: 'Invalid image type.' });
    const cleaned = dataBase64.replace(/\s+/g, '');
    try {
      const bytes = Buffer.from(cleaned, 'base64');
      if (bytes.length < 10) return sendJson(res, 400, { ok: false, error: 'Invalid image data.' });
      const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
      const { url } = await put(`site/${slotKey}/${randomUUID()}.${ext}`, bytes, { access: 'public', addRandomSuffix: true, contentType: mimeType });
      const rows = await db
        .insert(siteImages)
        .values({ slotKey, blobUrl: url, mimeType, position: 0, updatedAt: new Date() })
        .onConflictDoUpdate({ target: siteImages.slotKey, set: { blobUrl: url, mimeType, updatedAt: new Date() } })
        .returning();
      return sendJson(res, 200, { ok: true, image: rows[0] });
    } catch (e) {
      console.error('[admin/site-images] upload error:', e);
      return sendJson(res, 500, { ok: false, error: 'Failed to upload image.' });
    }
  }

  if (method === 'DELETE') {
    let input: unknown;
    try {
      const raw = await readBody(req);
      if (!raw) return sendJson(res, 400, { ok: false, error: 'The request body is empty.' });
      input = JSON.parse(raw);
    } catch {
      return sendJson(res, 400, { ok: false, error: 'The request body could not be read.' });
    }
    if (!isPlainObject(input)) return sendJson(res, 400, { ok: false, error: 'Invalid request.' });
    const slotKey = String((input as any).slotKey || '').trim();
    if (!slotKey) return sendJson(res, 400, { ok: false, error: 'Missing slotKey.' });
    try {
      await db.delete(siteImages).where(eq(siteImages.slotKey, slotKey));
      return sendJson(res, 200, { ok: true });
    } catch (e) {
      console.error('[admin/site-images] delete error:', e);
      return sendJson(res, 500, { ok: false, error: 'Failed to delete image.' });
    }
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
}
