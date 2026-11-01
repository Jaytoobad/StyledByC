import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isWhatsAppOnlyService, WHATSAPP_ONLY_SERVICE_ID } from '../src/config.js';
import { createWhatsAppUrl } from '../src/lib/whatsapp.js';

describe('WhatsApp-only service', () => {
  it('identifies only Brow Shaping (Blade) as WhatsApp-only', () => {
    assert.equal(isWhatsAppOnlyService(WHATSAPP_ONLY_SERVICE_ID), true);
    assert.equal(isWhatsAppOnlyService('brow-wax'), false);
  });

  it('normalizes the studio phone and encodes the prefilled message', () => {
    assert.equal(
      createWhatsAppUrl('+233 20 565 7974', 'Hi StyledByC, brow shaping?'),
      'https://wa.me/233205657974?text=Hi%20StyledByC%2C%20brow%20shaping%3F',
    );
  });

  it('rejects invalid destination phone numbers', () => {
    assert.throws(() => createWhatsAppUrl('not a phone', 'Hello'), /phone number is invalid/);
  });
});
