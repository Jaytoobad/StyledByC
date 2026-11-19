import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from './env.js';

export function verifySignature(rawBody: string, signature: string | undefined): boolean {
  const secret = env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) {
    console.log('[paystack/webhook] signature invalid: missing secret or header');
    return false;
  }
  try {
    const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
    const sig = Buffer.from(signature);
    const exp = Buffer.from(expected);
    if (sig.length !== exp.length) {
      console.log('[paystack/webhook] signature invalid: length mismatch');
      return false;
    }
    const match = timingSafeEqual(sig, exp);
    if (!match) {
      console.log('[paystack/webhook] signature invalid: mismatch');
    }
    return match;
  } catch (_e) {
    console.log('[paystack/webhook] signature invalid: error');
    return false;
  }
}
