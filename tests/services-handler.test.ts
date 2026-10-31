import { describe, it } from 'node:test';
import assert from 'node:assert';
import { handleServiceRequest } from '../api/_lib/service-handler.js';
import { createMockDb, eq, asc } from './_mock-db.ts';

function baseInput(overrides = {}) {
  return {
    id: 'brow-shaping-blade',
    name: 'Brow Shaping (Blade)',
    category: 'Brows',
    description: 'Precision blade shaping.',
    price: 60,
    duration: 30,
    image: '/images/brow-shaping-blade/01.jpg',
    ...overrides,
  };
}

const auth = { userId: 'u1', email: 'a@b.com' };

describe('handleServiceRequest', () => {
  it('lists services', async () => {
    const { db } = createMockDb([{ id: 's1', name: 'A', category: 'C', description: 'd', price: 10, duration: 20, photoRequired: false, tintGuideRequired: false, image: 'i', gallery: [], active: true, sortOrder: 0 }]);
    const deps = { db, servicesTable: { id: "id", name: "name", category: "category", description: "description", price: "price", duration: "duration", photoRequired: "photoRequired", tintGuideRequired: "tintGuideRequired", image: "image", gallery: "gallery", active: "active", sortOrder: "sortOrder", updatedAt: "updatedAt" }, eq, asc, audit: async () => {} };
    const r = await handleServiceRequest({ method: 'GET', action: 'list' }, deps, auth);
    assert.strictEqual(r.status, 200);
    assert.strictEqual((r.body as any).services.length, 1);
  });

  it('creates a service', async () => {
    const { db } = createMockDb([]);
    const auditCalls = [];
    const deps = { db, servicesTable: { id: "id", name: "name", category: "category", description: "description", price: "price", duration: "duration", photoRequired: "photoRequired", tintGuideRequired: "tintGuideRequired", image: "image", gallery: "gallery", active: "active", sortOrder: "sortOrder", updatedAt: "updatedAt" }, eq, asc, audit: async (p) => { auditCalls.push(p); } };
    const r = await handleServiceRequest({ method: 'POST', action: 'upsert', input: baseInput() }, deps, auth);
    assert.strictEqual(r.status, 201);
    assert.strictEqual((r.body as any).service.id, 'brow-shaping-blade');
    assert.strictEqual(auditCalls.length, 1);
    assert.strictEqual(auditCalls[0].action, 'service.create');
  });

  it('updates existing service and price', async () => {
    const { db } = createMockDb([{ id: 'brow-shaping-blade', name: 'Old', category: 'Brows', description: 'd', price: 10, duration: 20, photoRequired: false, tintGuideRequired: false, image: 'i', gallery: [], active: true, sortOrder: 0 }]);
    const auditCalls = [];
    const deps = { db, servicesTable: { id: "id", name: "name", category: "category", description: "description", price: "price", duration: "duration", photoRequired: "photoRequired", tintGuideRequired: "tintGuideRequired", image: "image", gallery: "gallery", active: "active", sortOrder: "sortOrder", updatedAt: "updatedAt" }, eq, asc, audit: async (p) => { auditCalls.push(p); } };
    const r = await handleServiceRequest({ method: 'POST', action: 'upsert', input: baseInput({ price: 99 }) }, deps, auth);
    assert.strictEqual(r.status, 200);
    assert.strictEqual((r.body as any).service.price, 99);
    assert.strictEqual(auditCalls[0].action, 'service.update');
  });

  it('activates/deactivates', async () => {
    const { db } = createMockDb([{ id: 's1', name: 'A', category: 'C', description: 'd', price: 10, duration: 20, photoRequired: false, tintGuideRequired: false, image: 'i', gallery: [], active: false, sortOrder: 0 }]);
    const auditCalls = [];
    const deps = { db, servicesTable: { id: "id", name: "name", category: "category", description: "description", price: "price", duration: "duration", photoRequired: "photoRequired", tintGuideRequired: "tintGuideRequired", image: "image", gallery: "gallery", active: "active", sortOrder: "sortOrder", updatedAt: "updatedAt" }, eq, asc, audit: async (p) => { auditCalls.push(p); } };
    const r1 = await handleServiceRequest({ method: 'POST', action: 'activate', input: { id: 's1' } }, deps, auth);
    assert.strictEqual(r1.status, 200);
    assert.strictEqual((r1.body as any).service.active, true);
    const r2 = await handleServiceRequest({ method: 'POST', action: 'deactivate', input: { id: 's1' } }, deps, auth);
    assert.strictEqual(r2.status, 200);
    assert.strictEqual((r2.body as any).service.active, false);
    assert.ok(auditCalls.length >= 1);
  });

  it('delete supported', async () => {
    const { db, rows } = createMockDb([{ id: 's1', name: 'A', category: 'C', description: 'd', price: 10, duration: 20, photoRequired: false, tintGuideRequired: false, image: 'i', gallery: [], active: true, sortOrder: 0 }]);
    const auditCalls = [];
    const deps = { db, servicesTable: { id: "id", name: "name", category: "category", description: "description", price: "price", duration: "duration", photoRequired: "photoRequired", tintGuideRequired: "tintGuideRequired", image: "image", gallery: "gallery", active: "active", sortOrder: "sortOrder", updatedAt: "updatedAt" }, eq, asc, audit: async (p) => { auditCalls.push(p); } };
    const r = await handleServiceRequest({ method: 'POST', action: 'delete', input: { id: 's1' } }, deps, auth);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(rows.length, 0);
    assert.strictEqual(auditCalls[0].action, 'service.delete');
  });

  it('invalid requests', async () => {
    const { db } = createMockDb([]);
    const deps = { db, servicesTable: { id: "id", name: "name", category: "category", description: "description", price: "price", duration: "duration", photoRequired: "photoRequired", tintGuideRequired: "tintGuideRequired", image: "image", gallery: "gallery", active: "active", sortOrder: "sortOrder", updatedAt: "updatedAt" }, eq, asc, audit: async () => {} };
    const r = await handleServiceRequest({ method: 'POST', action: 'upsert', input: { id: 'x' } }, deps, auth);
    assert.strictEqual(r.status, 400);
  });

  it('duplicate service ids handled as update', async () => {
    const { db } = createMockDb([{ id: 'brow-shaping-blade', name: 'Old', category: 'Brows', description: 'd', price: 10, duration: 20, photoRequired: false, tintGuideRequired: false, image: 'i', gallery: [], active: true, sortOrder: 0 }]);
    const deps = { db, servicesTable: { id: "id", name: "name", category: "category", description: "description", price: "price", duration: "duration", photoRequired: "photoRequired", tintGuideRequired: "tintGuideRequired", image: "image", gallery: "gallery", active: "active", sortOrder: "sortOrder", updatedAt: "updatedAt" }, eq, asc, audit: async () => {} };
    const r = await handleServiceRequest({ method: 'POST', action: 'upsert', input: baseInput() }, deps, auth);
    assert.strictEqual(r.status, 200);
  });

  it('database errors', async () => {
    const db = {
      select() { throw new Error('db'); },
      update() { throw new Error('db'); },
      insert() { throw new Error('db'); },
      delete() { throw new Error('db'); },
    };
    const deps = { db, servicesTable: { id: "id", name: "name", category: "category", description: "description", price: "price", duration: "duration", photoRequired: "photoRequired", tintGuideRequired: "tintGuideRequired", image: "image", gallery: "gallery", active: "active", sortOrder: "sortOrder", updatedAt: "updatedAt" }, eq, asc, audit: async () => {} };
    const r = await handleServiceRequest({ method: 'GET', action: 'list' }, deps, auth);
    assert.strictEqual(r.status, 500);
  });

  it('missing id activate', async () => {
    const { db } = createMockDb([]);
    const deps = { db, servicesTable: { id: "id", name: "name", category: "category", description: "description", price: "price", duration: "duration", photoRequired: "photoRequired", tintGuideRequired: "tintGuideRequired", image: "image", gallery: "gallery", active: "active", sortOrder: "sortOrder", updatedAt: "updatedAt" }, eq, asc, audit: async () => {} };
    const r = await handleServiceRequest({ method: 'POST', action: 'activate', input: {} }, deps, auth);
    assert.strictEqual(r.status, 400);
  });

  it('not found delete', async () => {
    const { db } = createMockDb([]);
    const deps = { db, servicesTable: { id: "id", name: "name", category: "category", description: "description", price: "price", duration: "duration", photoRequired: "photoRequired", tintGuideRequired: "tintGuideRequired", image: "image", gallery: "gallery", active: "active", sortOrder: "sortOrder", updatedAt: "updatedAt" }, eq, asc, audit: async () => {} };
    const r = await handleServiceRequest({ method: 'POST', action: 'delete', input: { id: 'nope' } }, deps, auth);
    assert.strictEqual(r.status, 404);
  });
});
