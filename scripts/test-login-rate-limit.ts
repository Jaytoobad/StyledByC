import assert from 'node:assert/strict';
import { countRecentFailedLogins, shouldBlockLogin, type LoginAttempt } from '../api/_lib/login-rate-limit-core.js';

const now = new Date('2026-11-01T12:00:00.000Z');
const since = new Date(now.getTime() - 15 * 60 * 1000);
const attempts: LoginAttempt[] = [
  ...Array.from({ length: 4 }, (_, index) => ({
    action: 'login_failed',
    targetRef: 'owner@example.test',
    details: { ip: '192.0.2.10' },
    createdAt: new Date(now.getTime() - index * 60_000),
  })),
  {
    action: 'login_failed',
    targetRef: 'other@example.test',
    details: { ip: '192.0.2.10' },
    createdAt: new Date(now.getTime() - 5 * 60_000),
  },
  {
    action: 'login_failed',
    targetRef: 'other@example.test',
    details: { ip: '192.0.2.11' },
    createdAt: new Date(now.getTime() - 6 * 60_000),
  },
  {
    action: 'login_failed',
    targetRef: 'owner@example.test',
    details: { ip: '192.0.2.10' },
    createdAt: new Date(since.getTime() - 1),
  },
  {
    action: 'login_success',
    targetRef: 'owner@example.test',
    details: { ip: '192.0.2.10' },
    createdAt: now,
  },
];

const counts = countRecentFailedLogins(attempts, '192.0.2.10', 'owner@example.test', since);
assert.deepEqual(counts, { ipCount: 5, emailCount: 4 });
assert.equal(shouldBlockLogin(counts.ipCount, counts.emailCount), true);
assert.equal(shouldBlockLogin(4, 5), true);
assert.equal(shouldBlockLogin(4, 4), false);

console.log('PASS login rate limit: counts failed attempts by IP/email within 15 minutes and blocks at five.');
