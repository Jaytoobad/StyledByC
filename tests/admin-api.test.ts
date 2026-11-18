import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { adminListBookings } from '../src/lib/api.js';

describe('adminListBookings', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('loads every server page for the client-side admin views', async () => {
    const requestedPages: number[] = [];
    globalThis.fetch = async (_input, init) => {
      const request = JSON.parse(String(init?.body)) as { page: number; pageSize: number };
      requestedPages.push(request.page);
      const row = { ref: `TEST-${request.page}` };
      return new Response(
        JSON.stringify({
          ok: true,
          rows: [row],
          total: 3,
          page: request.page,
          pageSize: request.pageSize,
          totalPages: 3,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const result = await adminListBookings();

    assert.deepEqual(requestedPages, [1, 2, 3]);
    assert.deepEqual(
      result.rows?.map((row) => row.ref),
      ['TEST-1', 'TEST-2', 'TEST-3'],
    );
    assert.equal(result.total, 3);
  });
});
