import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getCookie } from '../api/_lib/admin-auth.js';
import { verifyPassword } from '../api/admin/auth.js';
import { validateCsrf } from '../api/_lib/admin-auth.js';
import { scryptSync, randomBytes } from 'node:crypto';

function makeReq(cookieHeader: string | null, method = 'GET', headers: Record<string, string> = {}): any {
  return {
    method,
    headers: {
      cookie: cookieHeader ?? undefined,
      ...headers,
    } as any,
  };
}

describe('admin auth helpers', () => {
  describe('getCookie', () => {
    it('returns null when no cookie header', () => {
      assert.strictEqual(getCookie(makeReq(null), 'admin_session'), null);
    });

    it('returns null when cookie name not present', () => {
      assert.strictEqual(getCookie(makeReq('other=value'), 'admin_session'), null);
    });

    it('returns the cookie value when present', () => {
      assert.strictEqual(getCookie(makeReq('admin_session=abc123'), 'admin_session'), 'abc123');
    });

    it('returns the cookie value among multiple cookies', () => {
      assert.strictEqual(getCookie(makeReq('foo=bar; admin_session=xyz789; baz=qux'), 'admin_session'), 'xyz789');
    });

    it('decodes URI-encoded values', () => {
      assert.strictEqual(getCookie(makeReq('admin_session=hello%20world'), 'admin_session'), 'hello world');
    });
  });

  describe('verifyPassword', () => {
    it('returns true for a correct password', () => {
      const password = 's3cr3t-p@ssw0rd';
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync(password, salt, 64).toString('hex');
      const stored = `scrypt$${salt}$${hash}`;
      assert.strictEqual(verifyPassword(password, stored), true);
    });

    it('returns false for a wrong password', () => {
      const password = 's3cr3t-p@ssw0rd';
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync(password, salt, 64).toString('hex');
      const stored = `scrypt$${salt}$${hash}`;
      assert.strictEqual(verifyPassword('wrong-password', stored), false);
    });

    it('returns false for a malformed hash', () => {
      assert.strictEqual(verifyPassword('password', 'not-a-hash'), false);
      assert.strictEqual(verifyPassword('password', 'scrypt$salt'), false);
      assert.strictEqual(verifyPassword('password', 'bcrypt$salt$hash'), false);
    });

    it('returns false for empty inputs', () => {
      assert.strictEqual(verifyPassword('', ''), false);
    });
  });

  describe('validateCsrf', () => {
    it('allows safe methods without CSRF token', () => {
      for (const method of ['GET', 'HEAD', 'OPTIONS']) {
        const result = validateCsrf(makeReq(null, method));
        assert.strictEqual(result.ok, true);
      }
    });

    it('rejects POST without XSRF-TOKEN cookie', () => {
      const result = validateCsrf(makeReq(null, 'POST'));
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, 'CSRF token mismatch.');
    });

    it('rejects POST when cookie and header do not match', () => {
      const req = makeReq('XSRF-TOKEN=cookie-value', 'POST', { 'x-xsrf-token': 'header-value' });
      const result = validateCsrf(req);
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, 'CSRF token mismatch.');
    });

    it('rejects POST when header is missing but cookie present', () => {
      const req = makeReq('XSRF-TOKEN=cookie-value', 'POST');
      const result = validateCsrf(req);
      assert.strictEqual(result.ok, false);
    });

    it('accepts POST when cookie and header match', () => {
      const token = 'matching-token-123';
      const req = makeReq(`XSRF-TOKEN=${token}`, 'POST', { 'x-xsrf-token': token });
      const result = validateCsrf(req);
      assert.strictEqual(result.ok, true);
    });
  });
});
