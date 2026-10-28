import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Mail, Phone } from 'lucide-react';
import { getPayPage, verifyPayment } from '../lib/api';
import { openPaystack } from '../lib/paystack';
import { RESERVATION_FEE_GHS } from '../config/booking';
import { business, getPaystackPublicKey } from '../config';
import { money } from '../lib/money';

export function Pay() {
  const { ref } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('t') || '';

  const [booking, setBooking] = useState<any>(null);
  const [invalid, setInvalid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'paying' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [paystackReference] = useState(() => `stc-pay-${ref}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!ref || !token) { setInvalid(true); return; }
    let cancelled = false;
    setLoading(true);
    getPayPage(ref, token).then((data) => {
      if (cancelled) return;
      setLoading(false);
      if (!data.ok || !data.valid || !data.booking) { setInvalid(true); return; }
      setBooking(data.booking);
    });
    return () => { cancelled = true; };
  }, [ref, token]);

  const handlePay = () => {
    setError('');
    const publicKey = typeof getPaystackPublicKey === 'function' ? getPaystackPublicKey() : '';
    if (!publicKey) { setError('Payment is not configured. Please contact the studio.'); return; }
    if (typeof (window as any).PaystackPop === 'undefined') { setError('Payment system failed to load. Please refresh and try again.'); return; }
    const b = booking;
    if (!b) return;
    setStatus('paying');
    const handler = (window as any).PaystackPop.setup({
      key: publicKey,
      email: b.email,
      amount: RESERVATION_FEE_GHS * 100,
      currency: 'GHS',
      ref: paystackReference,
      metadata: {
        custom_fields: [
          { display_name: 'Booking Reference', variable_name: 'booking_ref', value: b.ref },
          { display_name: 'Service', variable_name: 'service', value: b.service },
        ],
      },
      callback: (response: any) => {
        verifyPayment({ reference: response.reference, bookingRef: b.ref }).then((res) => {
          if (res.ok) {
            setStatus('done');
          } else {
            setStatus('error');
            setError(res.error || 'Payment could not be verified.');
          }
        }).catch(() => {
          setStatus('error');
          setError('Payment could not be verified. Please contact the studio.');
        });
      },
      onClose: () => { setStatus('idle'); },
    });
    handler.openIframe();
  };

  if (invalid) {
    return (
      <main className="confirmation" id="content" style={{ padding: 40 }}>
        <div className="container">
          <div className="confirmation-card">
            <div className="confirmation-icon" />
            <h1>Payment link not valid</h1>
            <p>
              This payment link is invalid or has expired. If your appointment
              was approved, contact the studio to request a new payment link.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
              <Link to="/" className="btn btn-primary">Back to home</Link>
              <a href={`mailto:${business.email}`} className="btn-link">Contact the studio</a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="confirmation" id="content" style={{ padding: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div style={{ textAlign: 'center' }}><Loader2 size={24} className="spin" /> <span style={{ marginLeft: 8, color: 'var(--sb-grey)' }}>Loading payment…</span></div>
      </main>
    );
  }

  const deadline = booking.paymentDeadline ? new Date(booking.paymentDeadline).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const balance = Math.max(0, (booking.price || 0) - RESERVATION_FEE_GHS);

  return (
    <main className="confirmation" id="content" style={{ padding: 24 }}>
      <div className="container">
        <div className="confirmation-card" style={{ maxWidth: 520, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Check size={20} />
            <h1 style={{ margin: 0 }}>Pay reservation fee</h1>
          </div>
          <div style={{ border: '1px solid #e6e0d8', borderRadius: 6, padding: 16, background: '#fffdfa', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 14, color: 'var(--sb-grey)' }}>Booking reference</span>
              <span style={{ fontSize: 14, fontFamily: 'var(--sb-sans)' }}>{booking.ref}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 14, color: 'var(--sb-grey)' }}>Service</span>
              <span style={{ fontSize: 14 }}>{booking.service}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 14, color: 'var(--sb-grey)' }}>Appointment</span>
              <span style={{ fontSize: 14 }}>{booking.approvedSlotDate?.slice(0, 10) || booking.date} at {booking.approvedSlotTime || booking.time}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 14, color: 'var(--sb-grey)' }}>Reservation fee</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{money(RESERVATION_FEE_GHS)}</span>
            </div>
            {balance > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, color: 'var(--sb-grey)' }}>
                <span>Balance due at the studio</span>
                <span>{money(balance)}</span>
              </div>
            )}
            {deadline && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, color: 'var(--sb-grey)' }}>
                <span>Pay within</span>
                <span>{deadline}</span>
              </div>
            )}
            <p style={{ fontSize: 13, color: 'var(--sb-grey)', marginTop: 10 }}>
              The reservation fee secures your slot. The balance is payable at the studio.
            </p>
          </div>

          {status === 'error' && <p style={{ color: '#b00020', fontSize: 14, marginBottom: 12 }}>{error}</p>}

          {status === 'done' ? (
            <>
              <h2 style={{ marginBottom: 8 }}>Payment received.</h2>
              <p style={{ marginBottom: 20, color: 'var(--sb-grey)' }}>
                Your appointment is confirmed. Please arrive on time. The balance of
                {money(balance)} is due at the studio.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Link to="/" className="btn btn-primary">Back to home</Link>
                <a href={`mailto:${business.email}`} className="btn-link"><Mail size={14} /> Contact the studio</a>
                <a href={`tel:${business.phone.replace(/\s/g, '')}`} className="btn-link"><Phone size={14} /> Call us</a>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                disabled={status === 'paying'}
                className="btn btn-primary"
                onClick={handlePay}
                style={{ minHeight: 44, fontSize: 16 }}
              >
                {status === 'paying' ? (<><Loader2 size={16} className="spin" /> Processing payment</>) : (`Pay ${money(RESERVATION_FEE_GHS)} now`)}
              </button>
              <p style={{ fontSize: 13, color: 'var(--sb-grey)' }}>
                You will be redirected to Paystack to complete the payment. Do not close this page.
              </p>
              <button type="button" onClick={() => navigate('/')} className="btn-link"><ArrowLeft size={14} /> Back to home</button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
