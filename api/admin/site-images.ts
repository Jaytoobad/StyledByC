/**
 * StyledByC — Admin site images API
 *
 * Site images are stored inline in Neon Postgres as bytea (photo_data column).
 * Vercel Blob is no longer used for site images.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { siteImages } from '../../src/db/schema.js';
import { authorize, validateCsrf } from '../_lib/admin-auth.js';
import { writeAdminAuditLog } from '../_lib/audit.js';
import { checkRateLimit } from '../_lib/rate-limit.js';

const MAX_BODY_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const PUBLIC_SITE_IMAGE_SLOTS: string[] = [];

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

export type SiteImageListDependencies = {
  db: Pick<typeof db, 'select'>;
  authorize: typeof authorize;
};

async function serveSiteImage(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
  const id = url.searchParams.get('id') || '';
  if (!id) {
    return sendJson(res, 400, { ok: false, error: 'Missing id.' });
  }
  try {
    const [image] = await db.select().from(siteImages).where(eq(siteImages.id, id)).limit(1);
    if (!image || !image.photoData) {
      return sendJson(res, 404, { ok: false, error: 'Image not found.' });
    }
    const buf = Buffer.from(image.photoData);
    res.statusCode = 200;
    res.setHeader('Content-Type', image.mimeType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(buf);
    return;
  } catch (e) {
    console.error('[admin/site-images/serve] error:', e);
    return sendJson(res, 500, { ok: false, error: 'Failed to load image.' });
  }
}

export async function listSiteImages(
  req: IncomingMessage,
  res: ServerResponse,
  dependencies: SiteImageListDependencies = { db, authorize },
) {
  const auth = await dependencies.authorize(req);
  try {
    if (!auth.authorized) {
      const images = await dependencies.db
        .select({ slotKey: siteImages.slotKey, blobUrl: siteImages.blobUrl })
        .from(siteImages)
        .where(inArray(siteImages.slotKey, PUBLIC_SITE_IMAGE_SLOTS))
        .orderBy(asc(siteImages.position), asc(siteImages.slotKey));
      return sendJson(res, 200, { ok: true, images });
    }
    const rows = await dependencies.db
      .select()
      .from(siteImages)
      .orderBy(asc(siteImages.position), asc(siteImages.slotKey));
    const images = rows.map((row) => {
      const blobUrl =
        row.blobUrl ||
        (row.photoData
          ? `/api/admin/site-images?serve=1&id=${encodeURIComponent(row.id)}`
          : undefined);
      return blobUrl ? { ...row, blobUrl } : row;
    });
    return sendJson(res, 200, { ok: true, images: images });
  } catch (e) {
    console.error('[admin/site-images] list error:', e);
    return sendJson(res, 500, { ok: false, error: 'Failed to load images.' });
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
    if (url.searchParams.get('serve')) {
      return serveSiteImage(req, res);
    }
    return listSiteImages(req, res);
  }

  const auth = await authorize(req);
  if (!auth.authorized) {
    return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
  }
  if (!auth.userId) {
    return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
  }

  const userId = auth.userId as string;
  const rl = await checkRateLimit(`user:${userId}:admin-site-images`, 60, {
    windowMs: 60 * 1000,
  });
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter || 60));
    return sendJson(res, 429, { ok: false, error: 'Too many requests. Please try again later.' });
  }

  const csrf = validateCsrf(req);
  if (csrf.ok === false) {
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
      if (!allowed.includes(mimeType))
        return sendJson(res, 400, {
          ok: false,
          error: 'Invalid image type. Use JPG, PNG, or WebP.',
        });
      const cleaned = dataBase64.replace(/\s+/g, '');
      try {
        const bytes = Buffer.from(cleaned, 'base64');
        if (bytes.toString('base64') !== cleaned)
          return sendJson(res, 400, { ok: false, error: 'Invalid image data.' });
        if (bytes.length < 10)
          return sendJson(res, 400, { ok: false, error: 'Invalid image data.' });
        if (bytes.length > MAX_IMAGE_BYTES)
          return sendJson(res, 400, { ok: false, error: 'File too large.' });
        const rows = await db
          .insert(siteImages)
          .values({
            slotKey,
            photoData: bytes,
            mimeType,
            altText,
            position,
            updatedAt: new Date(),
          })
          .returning();
        const url = `/api/admin/site-images/serve?id=${encodeURIComponent(rows[0].id)}`;
        try {
          await writeAdminAuditLog({
            actorId: auth.userId,
            actorEmail: auth.email,
            action: 'site_image.upload',
            targetType: 'site_image',
            targetRef: slotKey,
            details: { slotKey, url },
          });
        } catch (error) {
          console.error('[admin/site-images] audit write failed:', error);
        }
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
      const altText =
        (input as any).altText !== undefined
          ? (input as any).altText
            ? String((input as any).altText).trim()
            : null
          : undefined;

      if (!slotKey && !id)
        return sendJson(res, 400, { ok: false, error: 'Missing slotKey or id.' });
      if (!dataBase64) return sendJson(res, 400, { ok: false, error: 'Missing image data.' });
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      if (!allowed.includes(mimeType))
        return sendJson(res, 400, {
          ok: false,
          error: 'Invalid image type. Use JPG, PNG, or WebP.',
        });
      const cleaned = dataBase64.replace(/\s+/g, '');
      try {
        const bytes = Buffer.from(cleaned, 'base64');
        if (bytes.toString('base64') !== cleaned)
          return sendJson(res, 400, { ok: false, error: 'Invalid image data.' });
        if (bytes.length < 10)
          return sendJson(res, 400, { ok: false, error: 'Invalid image data.' });
        if (bytes.length > MAX_IMAGE_BYTES)
          return sendJson(res, 400, { ok: false, error: 'File too large.' });

        if (id) {
          const updateData: any = { photoData: bytes, mimeType, updatedAt: new Date() };
          if (altText !== undefined) updateData.altText = altText;
          const rows = await db
            .update(siteImages)
            .set(updateData)
            .where(eq(siteImages.id, id))
            .returning();
          try {
            await writeAdminAuditLog({
              actorId: auth.userId,
              actorEmail: auth.email,
              action: 'site_image.replace',
              targetType: 'site_image',
              targetRef: id,
              details: { id },
            });
          } catch (error) {
            console.error('[admin/site-images] audit write failed:', error);
          }
          const url = `/api/admin/site-images/serve?id=${encodeURIComponent(rows[0].id)}`;
          return sendJson(res, 200, { ok: true, image: { ...rows[0], blobUrl: url } });
        } else {
          const existing = await db
            .select()
            .from(siteImages)
            .where(eq(siteImages.slotKey, slotKey))
            .limit(1);
          if (existing.length > 0) {
            const updateData: any = { photoData: bytes, mimeType, updatedAt: new Date() };
            if (altText !== undefined) updateData.altText = altText;
            const rows = await db
              .update(siteImages)
              .set(updateData)
              .where(eq(siteImages.slotKey, slotKey))
              .returning();
            try {
              await writeAdminAuditLog({
                actorId: auth.userId,
                actorEmail: auth.email,
                action: 'site_image.replace',
                targetType: 'site_image',
                targetRef: slotKey,
                details: { slotKey },
              });
            } catch (error) {
              console.error('[admin/site-images] audit write failed:', error);
            }
            const url = `/api/admin/site-images/serve?id=${encodeURIComponent(rows[0].id)}`;
            return sendJson(res, 200, { ok: true, image: { ...rows[0], blobUrl: url } });
          } else {
            const rows = await db
              .insert(siteImages)
              .values({
                slotKey,
                photoData: bytes,
                mimeType,
                altText: altText || null,
                position: 0,
                updatedAt: new Date(),
              })
              .returning();
            try {
              await writeAdminAuditLog({
                actorId: auth.userId,
                actorEmail: auth.email,
                action: 'site_image.upload',
                targetType: 'site_image',
                targetRef: slotKey,
                details: { slotKey },
              });
            } catch (error) {
              console.error('[admin/site-images] audit write failed:', error);
            }
            const url = `/api/admin/site-images/serve?id=${encodeURIComponent(rows[0].id)}`;
            return sendJson(res, 200, { ok: true, image: { ...rows[0], blobUrl: url } });
          }
        }
      } catch (e) {
        console.error('[admin/site-images] replace error:', e);
        return sendJson(res, 500, { ok: false, error: 'Failed to replace image.' });
      }
    }

    if (action === 'add') {
      const slotKey = String((input as any).slotKey || '').trim();
      const dataBase64 = String((input as any).dataBase64 || '');
      const mimeType = String((input as any).mimeType || '').trim();
      const altText =
        (input as any).altText !== undefined
          ? (input as any).altText
            ? String((input as any).altText).trim()
            : null
          : undefined;
      const position = typeof (input as any).position === 'number' ? (input as any).position : 0;

      if (!slotKey) return sendJson(res, 400, { ok: false, error: 'Missing slotKey.' });
      if (!dataBase64) return sendJson(res, 400, { ok: false, error: 'Missing image data.' });
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      if (!allowed.includes(mimeType))
        return sendJson(res, 400, {
          ok: false,
          error: 'Invalid image type. Use JPG, PNG, or WebP.',
        });
      const cleaned = dataBase64.replace(/\s+/g, '');
      try {
        const bytes = Buffer.from(cleaned, 'base64');
        if (bytes.toString('base64') !== cleaned)
          return sendJson(res, 400, { ok: false, error: 'Invalid image data.' });
        if (bytes.length < 10)
          return sendJson(res, 400, { ok: false, error: 'Invalid image data.' });
        if (bytes.length > MAX_IMAGE_BYTES)
          return sendJson(res, 400, { ok: false, error: 'File too large.' });
        const rows = await db
          .insert(siteImages)
          .values({
            slotKey,
            photoData: bytes,
            mimeType,
            altText,
            position,
            updatedAt: new Date(),
          })
          .returning();
        const url = `/api/admin/site-images/serve?id=${encodeURIComponent(rows[0].id)}`;
        try {
          await writeAdminAuditLog({
            actorId: auth.userId,
            actorEmail: auth.email,
            action: 'site_image.add',
            targetType: 'site_image',
            targetRef: slotKey,
            details: { slotKey, url },
          });
        } catch (error) {
          console.error('[admin/site-images] audit write failed:', error);
        }
        return sendJson(res, 200, { ok: true, image: rows[0] });
      } catch (e) {
        console.error('[admin/site-images] add error:', e);
        return sendJson(res, 500, { ok: false, error: 'Failed to add image.' });
      }
    }

    if (action === 'reorder') {
      const items = Array.isArray((input as any).items) ? (input as any).items : [];
      try {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item && item.id) {
            await db
              .update(siteImages)
              .set({
                position: typeof item.position === 'number' ? item.position : i,
                updatedAt: new Date(),
              })
              .where(eq(siteImages.id, String(item.id)));
          }
        }
        try {
          await writeAdminAuditLog({
            actorId: auth.userId,
            actorEmail: auth.email,
            action: 'site_image.reorder',
            targetType: 'site_image',
            targetRef: 'bulk',
            details: { count: items.length },
          });
        } catch (error) {
          console.error('[admin/site-images] audit write failed:', error);
        }
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
        try {
          await writeAdminAuditLog({
            actorId: auth.userId,
            actorEmail: auth.email,
            action: 'site_image.delete',
            targetType: 'site_image',
            targetRef: id,
          });
        } catch (error) {
          console.error('[admin/site-images] audit write failed:', error);
        }
      } else if (slotKey) {
        await db.delete(siteImages).where(eq(siteImages.slotKey, slotKey));
        try {
          await writeAdminAuditLog({
            actorId: auth.userId,
            actorEmail: auth.email,
            action: 'site_image.delete',
            targetType: 'site_image',
            targetRef: slotKey,
          });
        } catch (error) {
          console.error('[admin/site-images] audit write failed:', error);
        }
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
