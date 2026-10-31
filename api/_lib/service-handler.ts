/**
 * StyledByC — service management business logic.
 *
 * Pure, dependency-injected handler for /api/admin/services. The HTTP layer
 * (api/admin/services.ts) parses the request and calls handleServiceRequest.
 * Tests can exercise this function with a mock database without needing
 * DATABASE_URL.
 */

import { validateServiceInput, validateDeleteInput, type ValidatedService } from './service-validation.js';

export type ServiceRow = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  duration: number;
  photoRequired: boolean;
  tintGuideRequired: boolean;
  image: string;
  gallery: string[];
  active: boolean;
  sortOrder: number;
  updatedAt?: string;
};

export type ServiceRequest = {
  method: 'GET' | 'POST';
  action: string;
  input?: unknown;
};

export type ServiceResponse = {
  status: number;
  body: unknown;
};

export type ServiceDeps = {
  db: any;
  servicesTable: any;
  eq: (field: any, value: any) => any;
  asc: (field: any) => any;
  audit: (params: { action: string; targetType?: string; targetRef?: string; details?: unknown }) => Promise<void> | void;
};

function mapServiceRow(r: any): ServiceRow {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    description: r.description,
    price: r.price,
    duration: r.duration,
    photoRequired: !!r.photoRequired,
    tintGuideRequired: !!r.tintGuideRequired,
    image: r.image,
    gallery: Array.isArray(r.gallery) ? r.gallery : [],
    active: r.active !== false,
    sortOrder: typeof r.sortOrder === 'number' ? r.sortOrder : 0,
    updatedAt: r.updatedAt?.toISOString?.() || r.updatedAt,
  };
}

export async function handleServiceRequest(
  req: ServiceRequest,
  deps: ServiceDeps,
  auth: { userId: string; email: string }
): Promise<ServiceResponse> {
  const { db, servicesTable, eq, asc, audit } = deps;

  if (req.method === 'GET') {
    try {
      const rows = await db.select().from(servicesTable).orderBy(asc(servicesTable.sortOrder), asc(servicesTable.name));
      return { status: 200, body: { ok: true, services: rows.map(mapServiceRow) } };
    } catch (e) {
      console.error('[admin/services] list error:', e);
      return { status: 500, body: { ok: false, error: 'Failed to load services.' } };
    }
  }

  const action = req.action;

  if (action === 'activate' || action === 'deactivate') {
    const input = (req.input || {}) as Record<string, unknown>;
    const id = typeof input.id === 'string' ? input.id.trim() : '';
    if (!id) return { status: 400, body: { ok: false, error: 'Missing id.' } };
    const targetActive = action === 'activate';
    try {
      const [existing] = await db.select().from(servicesTable).where(eq(servicesTable.id, id)).limit(1);
      if (!existing) return { status: 404, body: { ok: false, error: 'Service not found.' } };
      if ((existing.active !== false) === targetActive) {
        return { status: 200, body: { ok: true, service: mapServiceRow(existing) } };
      }
      const [updated] = await db
        .update(servicesTable)
        .set({ active: targetActive, updatedAt: new Date() })
        .where(eq(servicesTable.id, id))
        .returning();
      try { await audit({ action: `service.${action}`, targetType: 'service', targetRef: id, details: { active: targetActive } }); } catch {}
      return { status: 200, body: { ok: true, service: mapServiceRow(updated || existing) } };
    } catch (e) {
      console.error(`[admin/services] ${action} error:`, e);
      return { status: 500, body: { ok: false, error: `Failed to ${action} service.` } };
    }
  }

  if (action === 'delete') {
    const parsed = validateDeleteInput(req.input);
    if (!parsed.ok) return { status: 400, body: { ok: false, error: parsed.error } };
    try {
      const [existing] = await db.select().from(servicesTable).where(eq(servicesTable.id, parsed.id)).limit(1);
      if (!existing) return { status: 404, body: { ok: false, error: 'Service not found.' } };
      await db.delete(servicesTable).where(eq(servicesTable.id, parsed.id));
      try { await audit({ action: 'service.delete', targetType: 'service', targetRef: parsed.id }); } catch {}
      return { status: 200, body: { ok: true } };
    } catch (e) {
      console.error('[admin/services] delete error:', e);
      return { status: 500, body: { ok: false, error: 'Failed to delete service.' } };
    }
  }

  // upsert (default action)
  const parsed = validateServiceInput(req.input);
  if (!parsed.ok) return { status: 400, body: { ok: false, error: parsed.error } };

  const values = {
    id: parsed.id,
    name: parsed.name,
    category: parsed.category,
    description: parsed.description,
    price: parsed.price,
    duration: parsed.duration,
    photoRequired: parsed.photoRequired,
    tintGuideRequired: parsed.tintGuideRequired,
    image: parsed.image,
    gallery: parsed.gallery,
    active: parsed.active,
    sortOrder: parsed.sortOrder,
    updatedAt: new Date(),
  };

  try {
    const [existing] = await db.select().from(servicesTable).where(eq(servicesTable.id, parsed.id)).limit(1);
    if (existing) {
      const rows = await db.update(servicesTable).set(values).where(eq(servicesTable.id, parsed.id)).returning();
      try { await audit({ action: 'service.update', targetType: 'service', targetRef: parsed.id, details: { name: parsed.name, price: parsed.price } }); } catch {}
      return { status: 200, body: { ok: true, service: mapServiceRow(rows[0]) } };
    } else {
      const rows = await db.insert(servicesTable).values(values).returning();
      try { await audit({ action: 'service.create', targetType: 'service', targetRef: parsed.id, details: { name: parsed.name, price: parsed.price } }); } catch {}
      return { status: 201, body: { ok: true, service: mapServiceRow(rows[0]) } };
    }
  } catch (e) {
    console.error('[admin/services] upsert error:', e);
    return { status: 500, body: { ok: false, error: 'Failed to save service.' } };
  }
}
