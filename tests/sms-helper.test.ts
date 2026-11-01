import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sendSms } from '../api/_lib/sms.js';

describe('sendSms stub mode', () => {
  const originalSmsMode = process.env.SMS_MODE;
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    if (originalSmsMode === undefined) delete process.env.SMS_MODE;
    else process.env.SMS_MODE = originalSmsMode;
    globalThis.fetch = originalFetch;
  });

  it('reports that no message was sent and does not call the provider', async () => {
    process.env.SMS_MODE = 'stub';
    globalThis.fetch = async () => {
      throw new Error('Stub mode must not call the SMS provider.');
    };

    const result = await sendSms('', '', { event: 'test' });

    assert.deepEqual(result, { status: 'stubbed' });
  });
});
