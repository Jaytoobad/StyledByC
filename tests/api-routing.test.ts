/**
 * Regression tests for consolidated API route dispatchers.
 *
 * These tests verify that the consolidated serverless functions correctly
 * route by `action` query parameter and enforce HTTP methods. They assert
 * responses returned before any database call, so no database connection is
 * required.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import authHandler from '../api/admin/auth.js';
import payHandler from '../api/pay.js';

function makeReq(method: string, url: string, cookieHeader: string | null = null, extraHeaders: Record<string,string> = {}): any {
  const req: any = {
    method,
    url,
    headers: {
      cookie: cookieHeader ?? undefined,
      ...extraHeaders,
    },
    on(event: string, listener: any) {
      if (event === 'end') listener();
      return req;
    },
    destroy() {},
  };
  return req;
}

function makeRes(): any {
  let statusCode = 200;
  let body: string | null = null;
  return {
    get statusCode() { return statusCode; },
    set statusCode(code: number) { statusCode = code; },
    setHeader() {},
    end(content?: string) { body = content ?? null; },
    get bodyOut() { return body; },
  } as any;
}

describe('consolidated admin auth dispatcher', () => {
  it('returns 404 for unknown action', async () => {
    const res = makeRes();
    await authHandler(makeReq('POST', '/api/admin/auth?action=unknown'), res);
    assert.strictEqual(res.statusCode, 404);
  });

  it('returns 404 when no action is provided', async () => {
    const res = makeRes();
    await authHandler(makeReq('GET', '/api/admin/auth'), res);
    assert.strictEqual(res.statusCode, 404);
  });

  it('returns 405 for GET on login', async () => {
    const res = makeRes();
    await authHandler(makeReq('GET', '/api/admin/auth?action=login'), res);
    assert.strictEqual(res.statusCode, 405);
  });

  it('returns 405 for GET on logout', async () => {
    const res = makeRes();
    await authHandler(makeReq('GET', '/api/admin/auth?action=logout'), res);
    assert.strictEqual(res.statusCode, 405);
  });

  it('returns 405 for POST on me', async () => {
    const res = makeRes();
    await authHandler(makeReq('POST', '/api/admin/auth?action=me'), res);
    assert.strictEqual(res.statusCode, 405);
  });

  it('returns 403 for logout without CSRF token', async () => {
    const res = makeRes();
    await authHandler(makeReq('POST', '/api/admin/auth?action=logout'), res);
    assert.strictEqual(res.statusCode, 403);
  });

  it('returns 200 for logout with valid CSRF and no session', async () => {
    const res = makeRes();
    const req = makeReq('POST', '/api/admin/auth?action=logout', null, {
      'x-xsrf-token': 'matching-token',
      cookie: 'XSRF-TOKEN=matching-token',
    });
    await authHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
  });
});

describe('consolidated pay dispatcher', () => {
  it('returns 405 for GET on pay/verify action', async () => {
    const res = makeRes();
    await payHandler(makeReq('GET', '/api/pay?action=verify'), res);
    assert.strictEqual(res.statusCode, 405);
  });

  it('returns 405 for POST on pay page (no verify action)', async () => {
    const res = makeRes();
    await payHandler(makeReq('POST', '/api/pay?ref=STC-123'), res);
    assert.strictEqual(res.statusCode, 405);
  });

  it('returns 403 for pay page without ref and token', async () => {
    const res = makeRes();
    await payHandler(makeReq('GET', '/api/pay'), res);
    assert.strictEqual(res.statusCode, 403);
    const parsed = JSON.parse(res.bodyOut as string);
    assert.strictEqual(parsed.valid, false);
    assert.strictEqual(parsed.error, 'Link not valid.');
  });

  it('returns 400 for pay/verify with empty body', async () => {
    const res = makeRes();
    await payHandler(makeReq('POST', '/api/pay?action=verify'), res);
    assert.strictEqual(res.statusCode, 400);
    const parsed = JSON.parse(res.bodyOut as string);
    assert.strictEqual(parsed.ok, false);
    assert.strictEqual(parsed.error, 'The request body is empty.');
  });
});
