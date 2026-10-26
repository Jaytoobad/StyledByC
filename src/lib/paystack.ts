import { getPaystackPublicKey, paymentConfig } from '../config';
import { verifyPayment } from './api';

export function isPaystackReady() {
  const publicKey = getPaystackPublicKey();
  if (!publicKey) return false;
  return typeof (window as any).PaystackPop !== 'undefined';
}

export function openPaystack(opts: {
  email: string;
  amount: number;
  reference: string;
  bookingRef: string;
  serviceName: string;
  onSuccess: (reference: string) => void;
  onCancel: () => void;
}) {
  const publicKey = getPaystackPublicKey();
  if (!publicKey) throw new Error('Payment is not configured. Please contact the studio.');
  if (typeof (window as any).PaystackPop === 'undefined') {
    throw new Error('Payment system failed to load. Please refresh and try again.');
  }
  const handler = (window as any).PaystackPop.setup({
    key: publicKey,
    email: opts.email,
    amount: Math.round(opts.amount * 100),
    currency: paymentConfig.currency || 'GHS',
    ref: opts.reference,
    metadata: {
      custom_fields: [
        { display_name: 'Booking Reference', variable_name: 'booking_ref', value: opts.bookingRef },
        { display_name: 'Service', variable_name: 'service', value: opts.serviceName },
      ],
    },
    callback: function (response: any) {
      opts.onSuccess(response.reference);
    },
    onClose: function () {
      opts.onCancel();
    },
  });
  handler.openIframe();
}

export async function verifyPaymentAfterCall(reference: string, bookingRef: string) {
  return verifyPayment({ reference, bookingRef });
}
