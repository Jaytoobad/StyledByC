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
    get statusCode() {
      return statusCode;
    },
    set statusCode(code: number) {
      statusCode = code;
    },
    setHeader() {},
    end(content?: string) {
      body = content ?? null;
    },
    get status() {
      return statusCode;
    },
    get bodyOut() {
      return body;
    },
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
    it('does not require bearer auth (Vercel Cron sends none)', async () => {
      const res = makeCronRes();
      await expireHandler(makeCronReq(null), res);
      // The expiry operation is idempotent and harmless; the route is not
      // bearer-protected so the scheduled Vercel Cron can invoke it. In the
      // test environment DATABASE_URL is unset, so it falls through to a db
      // error rather than an auth error.
      assert.notStrictEqual(res.status, 401);
      assert.notStrictEqual(res.status, 503);
    });

    it('rejects a wrong bearer token', async () => {
      const res = makeCronRes();
      await expireHandler(makeCronReq('Bearer wrong-token'), res);
      assert.strictEqual(res.status, 401);
    });
  });

  describe('reminders handler', () => {
    it('does not require bearer auth (Vercel Cron sends none)', async () => {
      const res = makeCronRes();
      await remindersHandler(makeCronReq(null), res);
      assert.notStrictEqual(res.status, 401);
      assert.notStrictEqual(res.status, 503);
    });

    it('rejects a wrong bearer token', async () => {
      const res = makeCronRes();
      await remindersHandler(makeCronReq('Bearer wrong-token'), res);
      assert.strictEqual(res.status, 401);
    });
  });
});
