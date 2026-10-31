import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import expireHandler from '../api/cron/expire.js';
import remindersHandler from '../api/cron/expire.js';

function makeCronReq(authHeader: string | null): any {
  return {
    method: 'GET',
    headers: authHeader ? { authorization: authHeader } : {},
  } as any;
}

function makeCronRes(): any {
  let statusCode = 200;
  let body: string | null = null;
  return {
    get statusCode() { return statusCode; },
    set statusCode(code: number) { statusCode = code; },
    setHeader() {},
    end(content?: string) { body = content ?? null; },
    get status() { return statusCode; },
    get bodyOut() { return body; },
  } as any;
}

describe('cron authentication', () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = 'test-cron-secret';
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalSecret;
    }
  });

  describe('expire handler', () => {
    it('returns 503 when CRON_SECRET is not configured', async () => {
      delete process.env.CRON_SECRET;
      const res = makeCronRes();
      await expireHandler(makeCronReq(null), res);
      assert.strictEqual(res.status, 503);
      const parsed = JSON.parse(res.bodyOut as string);
      assert.strictEqual(parsed.ok, false);
      assert.strictEqual(parsed.error, 'Cron not configured.');
    });

    it('returns 401 when no Authorization header', async () => {
      const res = makeCronRes();
      await expireHandler(makeCronReq(null), res);
      assert.strictEqual(res.status, 401);
      const parsed = JSON.parse(res.bodyOut as string);
      assert.strictEqual(parsed.ok, false);
      assert.strictEqual(parsed.error, 'Unauthorized');
    });

    it('returns 401 when Authorization is not Bearer', async () => {
      const res = makeCronRes();
      await expireHandler(makeCronReq('Basic abc123'), res);
      assert.strictEqual(res.status, 401);
    });

    it('returns 401 when Bearer token is wrong', async () => {
      const res = makeCronRes();
      await expireHandler(makeCronReq('Bearer wrong-token'), res);
      assert.strictEqual(res.status, 401);
    });

    it('passes auth when Bearer token matches (fails later at db call)', async () => {
      const res = makeCronRes();
      await expireHandler(makeCronReq('Bearer test-cron-secret'), res);
      assert.notStrictEqual(res.status, 401);
      assert.notStrictEqual(res.status, 503);
    });
  });

  describe('reminders handler', () => {
    it('returns 503 when CRON_SECRET is not configured', async () => {
      delete process.env.CRON_SECRET;
      const res = makeCronRes();
      await remindersHandler(makeCronReq(null, '/api/cron/expire?action=reminders'), res);
      assert.strictEqual(res.status, 503);
    });

    it('returns 401 when no Authorization header', async () => {
      const res = makeCronRes();
      await remindersHandler(makeCronReq(null, '/api/cron/expire?action=reminders'), res);
      assert.strictEqual(res.status, 401);
    });

    it('returns 401 when Bearer token is wrong', async () => {
      const res = makeCronRes();
      await remindersHandler(makeCronReq('Bearer wrong-token', '/api/cron/expire?action=reminders'), res);
      assert.strictEqual(res.status, 401);
    });

    it('passes auth when Bearer token matches (rejected later at phone/db check)', async () => {
      const res = makeCronRes();
      await remindersHandler(makeCronReq('Bearer test-cron-secret', '/api/cron/expire?action=reminders'), res);
      assert.notStrictEqual(res.status, 401);
    });
  });
});
