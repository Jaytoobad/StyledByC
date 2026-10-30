import type { IncomingMessage, ServerResponse } from 'node:http';
import { asc, eq } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { services } from '../../src/db/schema.js';
import { authorize, validateCsrf } from '../_lib/admin-auth.js';
import { writeAdminAuditLog } from '../_lib/audit.js';

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
  if (!auth.authorized) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });

  if (method === 'GET') {
    try {
      const rows = await db.select().from(services).orderBy(asc(services.sortOrder), asc(services.name));
      return sendJson(res, 200, { ok: true, services: rows });
    } catch (e) {
      console.error('[admin/services] list error:', e);
      return sendJson(res, 500, { ok: false, error: 'Failed to load services.' });
    }
  }

  const csrf = validateCsrf(req);
  if (!csrf.ok) return sendJson(res, 403, { ok: false, error: csrf.error });

  if (method === 'POST') {
    let raw: string;
    try { raw = await readBody(req); } catch { return sendJson(res, 400, { ok: false, error: 'Body too large.' }); }
    let input: unknown;
    try { input = JSON.parse(raw || '{}'); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid JSON.' }); }
    if (!isPlainObject(input)) return sendJson(res, 400, { ok: false, error: 'Invalid request.' });

    const action = String((input as any).action || 'upsert').trim();

    if (action === 'delete') {
      const id = String((input as any).id || '').trim();
      if (!id) return sendJson(res, 400, { ok: false, error: 'Missing id.' });
      try {
        await db.delete(services).where(eq(services.id, id));
        try { await writeAdminAuditLog({ actorId: auth.userId!, actorEmail: auth.email!, action: 'service.delete', targetType: 'service', targetRef: id }); } catch {}
        return sendJson(res, 200, { ok: true });
      } catch (e) {
        console.error('[admin/services] delete error:', e);
        return sendJson(res, 500, { ok: false, error: 'Failed to delete service.' });
      }
    }

    // upsert
    const id = String((input as any).id || '').trim();
    const name = String((input as any).name || '').trim();
    const category = String((input as any).category || '').trim();
    const description = String((input as any).description || '').trim();
    const price = Number((input as any).price);
    const duration = Number((input as any).duration);
    const photoRequired = Boolean((input as any).photoRequired);
    const tintGuideRequired = Boolean((input as any).tintGuideRequired);
    const image = String((input as any).image || '').trim();
    const gallery = Array.isArray((input as any).gallery) ? (input as any).gallery.map(String) : [];
    const active = (input as any).active === undefined ? true : Boolean((input as any).active);
    const sortOrder = typeof (input as any).sortOrder === 'number' ? (input as any).sortOrder : 0;

    if (!id) return sendJson(res, 400, { ok: false, error: 'Missing id.' });
    if (!name) return sendJson(res, 400, { ok: false, error: 'Missing name.' });
    if (!category) return sendJson(res, 400, { ok: false, error: 'Missing category.' });
    if (!description) return sendJson(res, 400, { ok: false, error: 'Missing description.' });
    if (!Number.isFinite(price) || price < 0) return sendJson(res, 400, { ok: false, error: 'Invalid price.' });
    if (!Number.isFinite(duration) || duration <= 0) return sendJson(res, 400, { ok: false, error: 'Invalid duration.' });

    const values = { id, name, category, description, price, duration, photoRequired, tintGuideRequired, image, gallery, active, sortOrder, updatedAt: new Date() };

    try {
      const existing = await db.select().from(services).where(eq(services.id, id)).limit(1);
      if (existing.length > 0) {
        const rows = await db.update(services).set(values).where(eq(services.id, id)).returning();
        try { await writeAdminAuditLog({ actorId: auth.userId!, actorEmail: auth.email!, action: 'service.update', targetType: 'service', targetRef: id, details: { name, price } }); } catch {}
        return sendJson(res, 200, { ok: true, service: rows[0] });
      } else {
        const rows = await db.insert(services).values(values).returning();
        try { await writeAdminAuditLog({ actorId: auth.userId!, actorEmail: auth.email!, action: 'service.create', targetType: 'service', targetRef: id, details: { name, price } }); } catch {}
        return sendJson(res, 200, { ok: true, service: rows[0] });
      }
    } catch (e) {
      console.error('[admin/services] upsert error:', e);
      return sendJson(res, 500, { ok: false, error: 'Failed to save service.' });
    }
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
}
