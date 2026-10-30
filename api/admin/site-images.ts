/**
 * StyledByC — Admin site images API
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { asc, eq } from 'drizzle-orm';
import { put } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { db } from '../../src/db/index.js';
import { siteImages } from '../../src/db/schema.js';
import { authorize, validateCsrf } from '../_lib/admin-auth.js';
import { writeAdminAuditLog } from '../_lib/audit.js';

const MAX_BODY_BYTES = 10 * 1024 * 1024;

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

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    try {
      const rows = await db.select().from(siteImages).orderBy(asc(siteImages.position), asc(siteImages.slotKey));
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

  const csrf = validateCsrf(req);
  if (!csrf.ok) {
    return sendJson(res, 403, { ok: false, error: csrf.error });
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

    const action = String((input as any).action || 'upload').trim();

    if (action === 'upload') {
      const slotKey = String((input as any).slotKey || '').trim();
      const dataBase64 = String((input as any).dataBase64 || '');
      const mimeType = String((input as any).mimeType || '').trim();
      const altText = (input as any).altText ? String((input as any).altText).trim() : null;
      const position = typeof (input as any).position === 'number' ? (input as any).position : 0;

      if (!slotKey) return sendJson(res, 400, { ok: false, error: 'Missing slotKey.' });
      if (!dataBase64) return sendJson(res, 400, { ok: false, error: 'Missing image data.' });
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      if (!allowed.includes(mimeType)) return sendJson(res, 400, { ok: false, error: 'Invalid image type. Use JPG, PNG, or WebP.' });
      const cleaned = dataBase64.replace(/\s+/g, '');
      try {
        const bytes = Buffer.from(cleaned, 'base64');
        if (bytes.length < 10) return sendJson(res, 400, { ok: false, error: 'Invalid image data.' });
        if (bytes.length > 10 * 1024 * 1024) return sendJson(res, 400, { ok: false, error: 'File too large.' });
        const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
        const { url } = await put(`site/${slotKey}/${randomUUID()}.${ext}`, bytes, { access: 'public', addRandomSuffix: true, contentType: mimeType });
        const rows = await db
          .insert(siteImages)
          .values({ slotKey, blobUrl: url, mimeType, altText, position, updatedAt: new Date() })
          .returning();
        try { await writeAdminAuditLog({ actorId: auth.userId, actorEmail: auth.email, action: 'site_image.upload', targetType: 'site_image', targetRef: slotKey, details: { slotKey, url } }); } catch {}
        return sendJson(res, 200, { ok: true, image: rows[0] });
      } catch (e) {
        console.error('[admin/site-images] upload error:', e);
        return sendJson(res, 500, { ok: false, error: 'Failed to upload image.' });
      }
    }

    if (action === 'replace') {
      const slotKey = String((input as any).slotKey || '').trim();
      const id = (input as any).id ? String((input as any).id) : null;
      const dataBase64 = String((input as any).dataBase64 || '');
      const mimeType = String((input as any).mimeType || '').trim();
      const altText = (input as any).altText !== undefined ? ((input as any).altText ? String((input as any).altText).trim() : null) : undefined;

      if (!slotKey && !id) return sendJson(res, 400, { ok: false, error: 'Missing slotKey or id.' });
      if (!dataBase64) return sendJson(res, 400, { ok: false, error: 'Missing image data.' });
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      if (!allowed.includes(mimeType)) return sendJson(res, 400, { ok: false, error: 'Invalid image type. Use JPG, PNG, or WebP.' });
      const cleaned = dataBase64.replace(/\s+/g, '');
      try {
        const bytes = Buffer.from(cleaned, 'base64');
        if (bytes.length < 10) return sendJson(res, 400, { ok: false, error: 'Invalid image data.' });
        if (bytes.length > 10 * 1024 * 1024) return sendJson(res, 400, { ok: false, error: 'File too large.' });
        const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
        const { url } = await put(`site/${slotKey || 'general'}/${randomUUID()}.${ext}`, bytes, { access: 'public', addRandomSuffix: true, contentType: mimeType });

        if (id) {
          const updateData: any = { blobUrl: url, mimeType, updatedAt: new Date() };
          if (altText !== undefined) updateData.altText = altText;
          const rows = await db.update(siteImages).set(updateData).where(eq(siteImages.id, id)).returning();
          try { await writeAdminAuditLog({ actorId: auth.userId, actorEmail: auth.email, action: 'site_image.replace', targetType: 'site_image', targetRef: id, details: { id, url } }); } catch {}
          return sendJson(res, 200, { ok: true, image: rows[0] });
        } else {
          const existing = await db.select().from(siteImages).where(eq(siteImages.slotKey, slotKey)).limit(1);
          if (existing.length > 0) {
            const updateData: any = { blobUrl: url, mimeType, updatedAt: new Date() };
            if (altText !== undefined) updateData.altText = altText;
            const rows = await db.update(siteImages).set(updateData).where(eq(siteImages.slotKey, slotKey)).returning();
            try { await writeAdminAuditLog({ actorId: auth.userId, actorEmail: auth.email, action: 'site_image.replace', targetType: 'site_image', targetRef: slotKey, details: { slotKey, url } }); } catch {}
            return sendJson(res, 200, { ok: true, image: rows[0] });
          } else {
            const rows = await db.insert(siteImages).values({ slotKey, blobUrl: url, mimeType, altText: altText || null, position: 0, updatedAt: new Date() }).returning();
            try { await writeAdminAuditLog({ actorId: auth.userId, actorEmail: auth.email, action: 'site_image.upload', targetType: 'site_image', targetRef: slotKey, details: { slotKey, url } }); } catch {}
            return sendJson(res, 200, { ok: true, image: rows[0] });
          }
        }
      } catch (e) {
        console.error('[admin/site-images] replace error:', e);
        return sendJson(res, 500, { ok: false, error: 'Failed to replace image.' });
      }
    }

    if (action === 'reorder') {
      const items = Array.isArray((input as any).items) ? (input as any).items : [];
      try {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item && item.id) {
            await db.update(siteImages).set({ position: typeof item.position === 'number' ? item.position : i, updatedAt: new Date() }).where(eq(siteImages.id, String(item.id)));
          }
        }
        try { await writeAdminAuditLog({ actorId: auth.userId, actorEmail: auth.email, action: 'site_image.reorder', targetType: 'site_image', targetRef: 'bulk', details: { count: items.length } }); } catch {}
        return sendJson(res, 200, { ok: true });
      } catch (e) {
        console.error('[admin/site-images] reorder error:', e);
        return sendJson(res, 500, { ok: false, error: 'Failed to reorder images.' });
      }
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
    const slotKey = (input as any).slotKey ? String((input as any).slotKey).trim() : null;
    const id = (input as any).id ? String((input as any).id) : null;
    if (!slotKey && !id) return sendJson(res, 400, { ok: false, error: 'Missing slotKey or id.' });
    try {
      if (id) {
        await db.delete(siteImages).where(eq(siteImages.id, id));
        try { await writeAdminAuditLog({ actorId: auth.userId, actorEmail: auth.email, action: 'site_image.delete', targetType: 'site_image', targetRef: id }); } catch {}
      } else if (slotKey) {
        await db.delete(siteImages).where(eq(siteImages.slotKey, slotKey));
        try { await writeAdminAuditLog({ actorId: auth.userId, actorEmail: auth.email, action: 'site_image.delete', targetType: 'site_image', targetRef: slotKey }); } catch {}
      }
      return sendJson(res, 200, { ok: true });
    } catch (e) {
      console.error('[admin/site-images] delete error:', e);
      return sendJson(res, 500, { ok: false, error: 'Failed to delete image.' });
    }
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
}