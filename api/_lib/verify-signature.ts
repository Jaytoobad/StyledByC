import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifySignature(rawBody: string, signature: string | undefined): boolean {
  const secret = (process.env.PAYSTACK_SECRET_KEY || '').trim();
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
  } catch (e) {
    console.log('[paystack/webhook] signature invalid: error');
    return false;
  }
}
