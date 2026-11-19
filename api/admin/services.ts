import type { IncomingMessage, ServerResponse } from 'node:http';
import { asc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '../../src/db/index.js';
import { services } from '../../src/db/schema.js';
import { authorize, validateCsrf } from '../_lib/admin-auth.js';
import { writeAdminAuditLog } from '../_lib/audit.js';
import { checkRateLimit } from '../_lib/rate-limit.js';
import {
  handleServiceRequest,
  type ServiceDeps,
  type ServiceRequest,
  type ServiceResponse,
} from '../_lib/service-handler.js';

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > 1024 * 1024) {
        reject(new Error('too large'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
    if (url.searchParams.get('serve')) {
      return serveServiceImage(req, res);
    }
  }

  const auth = await authorize(req);
  if (!auth.authorized || !auth.userId || !auth.email)
    return sendJson(res, 401, { ok: false, error: 'Unauthorized' });

  const userId = auth.userId as string;
  const rl = await checkRateLimit(`user:${userId}:admin-services`, 60, {
    windowMs: 60 * 1000,
  });
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter || 60));
    return sendJson(res, 429, { ok: false, error: 'Too many requests. Please try again later.' });
  }
  // Parse the request into a structured object for the business logic layer.
  let parsed: ServiceRequest;
  try {
    if (method === 'GET') {
      parsed = { method: 'GET', action: 'list' };
    } else {
      const csrf = validateCsrf(req);
      if (csrf.ok === false) return sendJson(res, 403, { ok: false, error: csrf.error });
      if (method !== 'POST') {
        res.setHeader('Allow', 'GET, POST');
        return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
      }
      let raw: string;
      try {
        raw = await readBody(req);
      } catch {
        return sendJson(res, 400, { ok: false, error: 'Body too large.' });
      }
      let input: unknown;
      try {
        input = JSON.parse(raw || '{}');
      } catch {
        return sendJson(res, 400, { ok: false, error: 'Invalid JSON.' });
      }
      if (!isPlainObject(input))
        return sendJson(res, 400, { ok: false, error: 'Invalid request.' });
      parsed = { method: 'POST', action: String((input as any).action || 'upsert').trim(), input };
    }
  } catch (e) {
    console.error('[admin/services] request parse error:', e);
    return sendJson(res, 500, { ok: false, error: 'Failed to process request.' });
  }

  const deps: ServiceDeps = {
    db: db as any,
    servicesTable: services as any,
    eq,
    asc,
    audit: (p) => writeAdminAuditLog({ actorId: auth.userId!, actorEmail: auth.email!, ...p }),
  };

  // Handle image upload action (reuses Vercel Blob)
  if (parsed.method === 'POST' && parsed.action === 'upload-image') {
    const input = (parsed.input || {}) as Record<string, unknown>;
    const dataBase64 = String(input.dataBase64 || '');
    const mimeType = String(input.mimeType || '').trim();
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!dataBase64) return sendJson(res, 400, { ok: false, error: 'Missing image data.' });
    if (!allowed.includes(mimeType))
      return sendJson(res, 400, { ok: false, error: 'Invalid image type.' });
    const cleaned = dataBase64.replace(/\s+/g, '');
    try {
      const bytes = Buffer.from(cleaned, 'base64');
      if (bytes.toString('base64') !== cleaned)
        return sendJson(res, 400, { ok: false, error: 'Invalid image data.' });
      if (bytes.length < 10) return sendJson(res, 400, { ok: false, error: 'Invalid image data.' });
      if (bytes.length > 10 * 1024 * 1024)
        return sendJson(res, 400, { ok: false, error: 'File too large.' });
      const serviceId = randomUUID();
      await db
        .insert(services)
        .values({
          id: serviceId,
          name: `Image ${serviceId.slice(0, 8)}`,
          category: 'brows',
          description: 'Temporary image storage',
          price: 0,
          duration: 0,
          photoRequired: false,
          tintGuideRequired: false,
          imageData: bytes,
          image: `/api/admin/services/serve?id=${encodeURIComponent(serviceId)}`,
          gallery: [],
          active: false,
          sortOrder: 0,
          updatedAt: new Date(),
        })
        .returning();
      const url = `/api/admin/services/serve?id=${encodeURIComponent(serviceId)}`;
      return sendJson(res, 200, { ok: true, url });
    } catch (e) {
      console.error('[admin/services] upload error:', e);
      return sendJson(res, 500, { ok: false, error: 'Failed to upload image.' });
    }
  }

  const authed = { userId: auth.userId as string, email: auth.email as string };
  let result: ServiceResponse;
  try {
    result = await handleServiceRequest(parsed, deps, authed);
  } catch (e) {
    console.error('[admin/services] handler error:', e);
    return sendJson(res, 500, { ok: false, error: 'Failed to process request.' });
  }

  return sendJson(res, result.status, result.body);
}

async function serveServiceImage(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
  const id = url.searchParams.get('id') || '';
  if (!id) {
    return sendJson(res, 400, { ok: false, error: 'Missing id.' });
  }
  try {
    const [service] = await db.select().from(services).where(eq(services.id, id)).limit(1);
    if (!service || !service.imageData) {
      return sendJson(res, 404, { ok: false, error: 'Image not found.' });
    }
    const buf = Buffer.from(service.imageData);
    res.statusCode = 200;
    res.setHeader('Content-Type', service.image || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(buf);
    return;
  } catch (e) {
    console.error('[admin/services/serve] error:', e);
    return sendJson(res, 500, { ok: false, error: 'Failed to load image.' });
  }
}
