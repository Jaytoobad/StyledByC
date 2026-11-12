import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { listSiteImages, type SiteImageListDependencies } from '../api/admin/site-images.js';

const publicImages: Array<{ slotKey: string; blobUrl: string }> = [];
const adminImage = {
  ...publicImages[0],
  id: 'image-id',
  mimeType: 'image/jpeg',
  altText: 'Homepage hero',
  position: 0,
};

function makeResponse() {
  let statusCode = 200;
  let body: string | null = null;
  return {
    get statusCode() { return statusCode; },
    set statusCode(code: number) { statusCode = code; },
    setHeader() {},
    end(content?: string) { body = content ?? null; },
    get bodyOut() { return body; },
  };
}

function makeDependencies(authorized: boolean, rows: Record<string, unknown>[]) {
  let selectedFields: Record<string, unknown> | undefined;
  let whereCondition: unknown;
  const database = {
    select(fields?: Record<string, unknown>) {
      selectedFields = fields;
      return {
        from() {
          return {
            where(condition: unknown) {
              whereCondition = condition;
              return {
                orderBy() {
                  return Promise.resolve(rows);
                },
              };
            },
            orderBy() {
              return Promise.resolve(rows);
            },
          };
        },
      };
    },
  };
  const dependencies = {
    authorize: async () => ({ authorized }),
    db: database as unknown as SiteImageListDependencies['db'],
  };

  return {
    dependencies,
    get selectedFields() { return selectedFields; },
    get whereCondition() { return whereCondition; },
  };
}

function getColumnName(column: unknown): string | undefined {
  if (typeof column === 'object' && column !== null && 'name' in column && typeof column.name === 'string') {
    return column.name;
  }
  return undefined;
}

describe('site image listing', () => {
  it('limits anonymous responses to the public slots and public fields', async () => {
    const mock = makeDependencies(false, publicImages);
    const res = makeResponse();

    await listSiteImages(
      { method: 'GET', headers: {} } as Parameters<typeof listSiteImages>[0],
      res as Parameters<typeof listSiteImages>[1],
      mock.dependencies,
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(
      Object.fromEntries(Object.entries(mock.selectedFields || {}).map(([key, column]) => [key, getColumnName(column)])),
      { slotKey: 'slot_key', blobUrl: 'blob_url' },
    );
    assert.deepEqual(
      new PgDialect().sqlToQuery(mock.whereCondition as SQL).params,
      [],
    );
    assert.deepEqual(JSON.parse(res.bodyOut || '{}').images, publicImages);
  });

  it('keeps the full image listing available to authorized admins', async () => {
    const mock = makeDependencies(true, [adminImage]);
    const res = makeResponse();

    await listSiteImages(
      { method: 'GET', headers: {} } as Parameters<typeof listSiteImages>[0],
      res as Parameters<typeof listSiteImages>[1],
      mock.dependencies,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(mock.selectedFields, undefined);
    assert.equal(mock.whereCondition, undefined);
    assert.deepEqual(JSON.parse(res.bodyOut || '{}').images, [adminImage]);
  });
});
