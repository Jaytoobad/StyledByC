import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as templates from '../src/lib/sms-templates';

describe('SMS templates', () => {
  it('requestReceived', () => {
    const msg = templates.requestReceived({ firstName: 'Ama', service: 'Brow Shaping', ref: 'STC-ABC123' });
    assert.ok(msg.includes('Styled By C: Hi Ama, we got your Brow Shaping request (STC-ABC123). We will review your photos and reply soon. Not yet confirmed.'));
  });

  it('approved uses GHS and config fee/window', () => {
    const msg = templates.approved({ firstName: 'Ama', service: 'Brow Shaping', date: '2026-10-27', time: '10:00', payUrl: 'https://example.com/pay/123' });
    assert.ok(msg.includes('Pay the GHS 100 reservation fee within 30 mins to secure it: https://example.com/pay/123'));
    assert.ok(!msg.includes('GH\u20B2'));
  });

  it('needsMoreInfo', () => {
    const msg = templates.needsMoreInfo({ ref: 'STC-ABC123', message: 'Please send clearer photos', studioPhone: '233200000000' });
    assert.ok(msg.includes('Please call or WhatsApp 233200000000'));
  });

  it('rejected', () => {
    const msg = templates.rejected({ ref: 'STC-ABC123', reason: 'Not available', studioPhone: '233200000000' });
    assert.ok(msg.includes('Questions? Call 233200000000'));
  });

  it('confirmedAfterPayment uses GHS', () => {
    const msg = templates.confirmedAfterPayment({ service: 'Brow Shaping', date: '2026-10-27', time: '10:00', balance: 50 });
    assert.ok(msg.includes('Balance at the studio: GHS 50'));
  });

  it('expired', () => {
    const msg = templates.expired({ ref: 'STC-ABC123', studioPhone: '233200000000' });
    assert.ok(msg.includes('Call 233200000000 to rebook'));
  });

  it('newRequestOwner uses first name only', () => {
    const msg = templates.newRequestOwner({ ref: 'STC-ABC123', name: 'Ama Mensah', service: 'Brow Shaping', date: '2026-10-27', time: '10:00' });
    assert.ok(msg.includes('Ama,'));
    assert.ok(!msg.includes('Mensah'));
  });

  it('paidNeedsAttentionOwner', () => {
    const msg = templates.paidNeedsAttentionOwner({ ref: 'STC-ABC123' });
    assert.ok(msg.startsWith('ATTENTION STC-ABC123:'));
  });

  it('reminderDayBefore', () => {
    const msg = templates.reminderDayBefore({ service: 'Brow Shaping', time: '10:00', studioPhone: '233200000000' });
    assert.ok(msg.includes('tomorrow at 10:00'));
  });
});