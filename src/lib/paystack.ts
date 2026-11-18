const PAYSTACK_INLINE_SRC = 'https://js.paystack.co/v1/inline.js';
let paystackLoadPromise: Promise<void> | null = null;

export function loadPaystackScript(): Promise<void> {
  if (typeof window === 'undefined')
    return Promise.reject(new Error('Payment is not available in this environment.'));
  if (typeof (window as any).PaystackPop !== 'undefined') return Promise.resolve();
  if (paystackLoadPromise) return paystackLoadPromise;

  paystackLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      `script[src="${PAYSTACK_INLINE_SRC}"]`,
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Payment system failed to load. Please refresh and try again.')),
        { once: true },
      );
      return;
    }
    const script = document.createElement('script');
    script.src = PAYSTACK_INLINE_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      paystackLoadPromise = null;
      reject(new Error('Payment system failed to load. Please refresh and try again.'));
    };
    document.head.appendChild(script);
  });

  return paystackLoadPromise;
}
