import type { IncomingMessage, ServerResponse } from 'node:http';
import { asc, eq } from 'drizzle-orm';
import { put } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { db } from '../../src/db/index.js';
import { services } from '../../src/db/schema.js';
import { authorize, validateCsrf } from '../_lib/admin-auth.js';
import { writeAdminAuditLog } from '../_lib/audit.js';
import { validateServiceInput, validateDeleteInput, type ValidatedService } from '../_lib/service-validation.js';
import { handleServiceRequest, type ServiceDeps, type ServiceRequest, type ServiceResponse } from '../_lib/service-handler.js';

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => { size += c.length; if (size > 1024 * 1024) { reject(new Error('too large')); return; } chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = (req.method || 'GET').toUpperCase();

  const auth = await authorize(req);
  if (!auth.authorized || !auth.userId || !auth.email) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
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
      try { raw = await readBody(req); } catch { return sendJson(res, 400, { ok: false, error: 'Body too large.' }); }
      let input: unknown;
      try { input = JSON.parse(raw || '{}'); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid JSON.' }); }
      if (!isPlainObject(input)) return sendJson(res, 400, { ok: false, error: 'Invalid request.' });
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
    const allowed = ['image/jpeg','image/png','image/webp','image/jpg'];
    if (!dataBase64) return sendJson(res, 400, { ok: false, error: 'Missing image data.' });
    if (!allowed.includes(mimeType)) return sendJson(res, 400, { ok: false, error: 'Invalid image type.' });
    try {
      const bytes = Buffer.from(dataBase64.replace(/\s+/g,''), 'base64');
      if (bytes.length < 10) return sendJson(res, 400, { ok: false, error: 'Invalid image data.' });
      if (bytes.length > 10*1024*1024) return sendJson(res, 400, { ok: false, error: 'File too large.' });
      const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
      const { url } = await put('services/'+randomUUID()+'.'+ext, bytes, { access: 'public', addRandomSuffix: true, contentType: mimeType });
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


