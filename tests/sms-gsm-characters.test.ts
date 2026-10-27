import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as templates from '../src/lib/sms-templates';

// GSM-7 basic character set: ASCII 0x00-0x7F plus a few extension table chars.
// We reject anything outside this to avoid cedi sign (GH\u20B2), curly quotes,
// emoji, long dashes (em/ens), and other non-GSM characters.
const GSM7_REGEX = /^[\x00-\x7F]*$/;

describe('SMS GSM-7 character check', () => {
  const cases: string[] = [
    templates.requestReceived({ firstName: 'Ama', service: 'Brow Shaping', ref: 'STC-ABC123' }),
    templates.approved({ firstName: 'Ama', service: 'Brow Shaping', date: '2026-10-27', time: '10:00', payUrl: 'https://example.com/pay/123' }),
    templates.needsMoreInfo({ ref: 'STC-ABC123', message: 'Please send clearer photos', studioPhone: '233200000000' }),
    templates.rejected({ ref: 'STC-ABC123', reason: 'Not available', studioPhone: '233200000000' }),
    templates.confirmedAfterPayment({ service: 'Brow Shaping', date: '2026-10-27', time: '10:00', balance: 50 }),
    templates.expired({ ref: 'STC-ABC123', studioPhone: '233200000000' }),
    templates.newRequestOwner({ ref: 'STC-ABC123', name: 'Ama Mensah', service: 'Brow Shaping', date: '2026-10-27', time: '10:00' }),
    templates.paidNeedsAttentionOwner({ ref: 'STC-ABC123' }),
    templates.reminderDayBefore({ service: 'Brow Shaping', time: '10:00', studioPhone: '233200000000' }),
  ];

  it('messages contain only GSM-7 characters', () => {
    for (const msg of cases) {
      assert.ok(GSM7_REGEX.test(msg), `Message contains non-GSM characters: ${JSON.stringify(msg)}`);
    }
  });

  it('messages do not contain cedi sign, curly quotes, emoji, or long dashes', () => {
    for (const msg of cases) {
      assert.ok(!/\u20B2/.test(msg), `Message contains cedi sign: ${JSON.stringify(msg)}`);
      assert.ok(!/[\u2018\u2019\u201C\u201D]/.test(msg), `Message contains curly quotes: ${JSON.stringify(msg)}`);
      assert.ok(!/[\u2013\u2014\u2015]/.test(msg), `Message contains long dashes: ${JSON.stringify(msg)}`);
      assert.ok(!/[\u{1F000}-\u{1FFFF}]/u.test(msg), `Message contains emoji: ${JSON.stringify(msg)}`);
    }
  });

  it('warns when a message exceeds 160 characters', () => {
    for (const msg of cases) {
      if (msg.length > 160) {
        console.warn(`[WARN] Message over 160 chars (${msg.length}): ${JSON.stringify(msg)}`);
      }
    }
  });

  it('messages never exceed 650 characters', () => {
    for (const msg of cases) {
      assert.ok(msg.length <= 650, `Message exceeds 650 chars (${msg.length}): ${JSON.stringify(msg)}`);
    }
  });
});