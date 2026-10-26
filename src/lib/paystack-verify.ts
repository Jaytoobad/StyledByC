/**
 * StyledByC — Paystack server-side verification helper.
 *
 * Calls the Paystack verify endpoint with the secret key and normalises the
 * response. Amounts are compared in pesewas (1 GHS = 100 pesewas).
 */

export type PaystackVerifyResult = {
  ok: true;
  status: 'success';
  currency: string;
  amount: number; // pesewas
  reference: string;
  paidAt?: string;
  customer?: { email?: string; name?: string };
} | { ok: false; error: string };

export async function verifyPaystack(reference: string): Promise<PaystackVerifyResult> {
  const secret = (process.env.PAYSTACK_SECRET_KEY || '').trim();
  if (!secret) return { ok: false, error: 'Payment service is not configured.' };

  const url = `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
    });
  } catch {
    return { ok: false, error: 'Could not reach the payment provider.' };
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: 'Payment provider returned an invalid response.' };
  }

  if (!data || data.status !== true || !data.data) {
    return { ok: false, error: 'Payment verification failed.' };
  }

  const tx = data.data;
  if (tx.status !== 'success') {
    return { ok: false, error: 'Payment was not successful.' };
  }

  return {
    ok: true,
    status: 'success',
    currency: String(tx.currency || '').toUpperCase(),
    amount: Number(tx.amount) || 0,
    reference: String(tx.reference || reference),
    paidAt: tx.paidAt,
    customer: tx.customer,
  };
}