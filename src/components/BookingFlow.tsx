import { useCallback, useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  Clock3,
  Loader2,
  Mail,
  ShieldCheck,
  X,
} from 'lucide-react';
import { services, settings } from '../config';

type Service = (typeof services)[number];

import { submitBooking } from '../lib/api';
import { money, dateLabel, timeLabel } from '../lib/money';

const KEY = 'styledbyc-demo-availability-cache';

type LocalBooking = {
  ref: string;
  name: string;
  email: string;
  phone: string;
  serviceId: string;
  date: string;
  time: string;
  fee: number;
  status: string;
  photo?: string;
};

const getBookings = (): LocalBooking[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
};

const slots = () => {
  const result: string[] = [];
  const [h, m] = settings.openingTime.split(':').map(Number);
  const [eh, em] = settings.closingTime.split(':').map(Number);
  for (
    let n = h * 60 + m;
    n < eh * 60 + em;
    n += settings.slotIntervalMinutes
  ) {
    result.push(
      `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(
        2,
        '0'
      )}`
    );
  }
  return result;
};

const STEPS = [
  { id: 1, label: 'Service' },
  { id: 2, label: 'Date & time' },
  { id: 3, label: 'Your details' },
  { id: 4, label: 'Review & pay' },
];

export function BookingFlow() {
  useEffect(() => {
    document.title = 'Book an appointment — StyledByC';
  }, []);
  const navigate = useNavigate();
  const { serviceId } = useParams<{ serviceId?: string }>();

  const [step, setStep] = useState(1);
  const [service, setService] = useState<Service>(
    services.find((s) => s.id === serviceId) || services[0]
  );
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<LocalBooking | null>(null);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = `${tomorrow.getFullYear()}-${String(
    tomorrow.getMonth() + 1
  ).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  const bookings = getBookings();
  const occupied = bookings
    .filter(
      (b) =>
        b.date === date &&
        (b.status === 'Approved' || b.status === 'Demo confirmed')
    )
    .map((b) => b.time);
  const available = useMemo(
    () => slots().filter((s) => !occupied.includes(s)),
    [date]
  );
  const fee = settings.reservationFee;
  const balance = Math.max(0, service.price - (settings.feeCountsTowardTotal ? fee : 0));

  const startOver = useCallback((s?: Service) => {
    if (s) setService(s);
    setStep(1);
    setDate('');
    setTime('');
    setName('');
    setEmail('');
    setPhone('');
    setPhoto(null);
    setPreview('');
    setConsent(false);
    setError('');
    setApiError('');
    setDone(null);
    setSubmitting(false);
  }, []);

  const choosePhoto = (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      setError('Choose an image smaller than 8 MB.');
      return;
    }
    setPhoto(f);
    setPreview(URL.createObjectURL(f));
    setError('');
  };

  const next = () => {
    setError('');
    if (step === 1 && (!date || !time)) {
      setError('Choose an appointment date and time.');
      return;
    }
    if (
      step === 2 &&
      (!name.trim() ||
        !/^\S+@\S+\.\S+$/.test(email) ||
        phone.trim().length < 7)
    ) {
      setError('Enter your name, a valid email and a phone number.');
      return;
    }
    if (step === 2 && service.photoRequired && !photo) {
      setError('Please add a brow photo for this service.');
      return;
    }
    if (step === 2 && service.tintGuideRequired && !consent) {
      setError('Please acknowledge the hybrid tint guide.');
      return;
    }
    setStep((v) => Math.min(v + 1, 4));
  };

  const prev = () => {
    setError('');
    setStep((v) => Math.max(v - 1, 1));
  };

  const submitRequest = async () => {
    if (submitting) return;
    setSubmitting(true);
    setApiError('');
    try {
      const result = await submitBooking({
        serviceId: service.id,
        date,
        time,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        note: service.tintGuideRequired ? '' : '',
      });
      if (!result.ok || !result.booking) {
        setApiError(
          result.error || 'Your request could not be submitted. Please try again.'
        );
        setSubmitting(false);
        return;
      }
      const booking: LocalBooking = {
        ref: result.booking.ref,
        name,
        email,
        phone,
        serviceId: service.id,
        date,
        time,
        fee: result.booking.price,
        status: result.booking.status,
        photo: photo?.name,
      };
      const all = [booking, ...getBookings()];
      localStorage.setItem(KEY, JSON.stringify(all));
      setDone(booking);
      setStep(4);
    } catch (err) {
      setApiError(
        err instanceof Error
          ? err.message
          : 'Could not reach the booking service. Please try again later.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const serviceName = (id: string) =>
    services.find((s) => s.id === id)?.name || id;

  const isStep1 = step === 1;
  const isStep4 = step === 4;

  return (
    <main className="booking" id="content">
      <div className="booking-header">
        <button
          className="booking-back"
          type="button"
          onClick={() => {
            if (step === 1) {
              navigate('/services');
            } else {
              prev();
            }
          }}
        >
          <ArrowLeft size={15} />
          {step === 1 ? 'Back to services' : 'Previous step'}
        </button>
        <div className="booking-progress">
          <p className="small">Appointment request</p>
          <div className="progress-steps">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className={`progress-step ${
                  step === s.id
                    ? 'active'
                    : step > s.id
                      ? 'done'
                      : ''
                }`}
              >
                <div className="step-circle">
                  {step >= s.id ? <Check size={14} /> : s.id}
                </div>
                <span className="step-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="booking-layout">
        <section className="booking-form">
          {step === 1 && (
            <>
              <h1>Choose your <em>service.</em></h1>
              <p className="booking-sub">
                Select the treatment you would like to book.
              </p>
              <label className="booking-field">
                <span>Service</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {services.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`choice ${
                        service.id === s.id ? 'selected' : ''
                      }`}
                      onClick={() => {
                        setService(s);
                        setTime('');
                      }}
                    >
                      <input
                        type="radio"
                        name="service"
                        checked={service.id === s.id}
                        readOnly
                      />
                      <span>
                        <span className="choice-name">{s.name}</span>
                        <span className="choice-meta">
                          {s.duration} min · {s.category}
                        </span>
                      </span>
                      <span className="choice-price">{money(s.price)}</span>
                    </button>
                  ))}
                </div>
              </label>
              <p className="small field-hint">
                Selected: {service.name} — {money(service.price)}
              </p>
            </>
          )}

          {step === 2 && (
            <>
              <h1>
                Pick your <em>date and time.</em>
              </h1>
              <p className="booking-sub">
                Select a day and an available appointment slot.
              </p>
              <div className="booking-field">
                <label htmlFor="date">Appointment date</label>
                <input
                  id="date"
                  type="date"
                  min={minDate}
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setTime('');
                  }}
                />
              </div>
              <div className="booking-field">
                <label>Appointment time</label>
                <div className="times">
                  {date ? (
                    available.length ? (
                      available.map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={`time-chip ${
                            time === t ? 'selected' : ''
                          }`}
                          onClick={() => setTime(t)}
                        >
                          {timeLabel(t)}
                        </button>
                      ))
                    ) : (
                      <p className="no-slots">
                        No sample slots left on this date.
                      </p>
                    )
                  ) : (
                    <p className="no-slots">Choose a date to view times.</p>
                  )}
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1>
                A few <em>details, please.</em>
              </h1>
              <p className="booking-sub">
                Tell us how to reach you about your appointment.
              </p>
              <div className="booking-field">
                <label htmlFor="name">Full name</label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="booking-field">
                  <label htmlFor="email">Email address</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="booking-field">
                  <label htmlFor="phone">Phone number</label>
                  <input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+233 ..."
                  />
                </div>
              </div>
              {service.photoRequired && (
                <div className="booking-field" style={{ textAlign: 'center' }}>
                  <b style={{ display: 'block', marginBottom: 8 }}>
                    <Camera size={17} /> Share a brow photo
                  </b>
                  <p style={{ marginBottom: 12, fontSize: 14, color: '#6d665e' }}>
                    This service needs a photo so the artist can review your brows.
                  </p>
                  {preview ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                      <img src={preview} alt="Selected brow preview" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 6 }} />
                      <button type="button" className="btn-link" onClick={() => { setPhoto(null); setPreview(''); }}>
                        Remove photo
                      </button>
                    </div>
                  ) : (
                    <label className="btn btn-secondary btn-small" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 44 }}>
                      <Camera size={16} /> Choose or take photo
                      <input
                        hidden
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => choosePhoto(e.target.files?.[0])}
                      />
                    </label>
                  )}
                  <p className="small field-hint">
                    Demo only: the photo stays in this browser and is not uploaded.
                  </p>
                </div>
              )}
              {service.tintGuideRequired && (
                <div className="booking-field" style={{ border: '1px solid #e6e0d8', borderRadius: 6, padding: 16, background: '#fffdfa' }}>
                  <h3 style={{ marginBottom: 8, fontSize: 16 }}>Hybrid tint preparation</h3>
                  <p style={{ fontSize: 14, color: '#6d665e', marginBottom: 12 }}>
                    By booking, you confirm you have read and understood the
                    pre-appointment guide and will disclose relevant conditions to the artist.
                  </p>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: '#252321', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      style={{ width: 18, height: 18, marginTop: 2, accentColor: '#101010' }}
                    />
                    I have read and understood the guide and will disclose relevant concerns to the artist.
                  </label>
                </div>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <h1>
                Review your <em>booking.</em>
              </h1>
              <p className="booking-sub">
                Check the details before submitting your request.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div>
                  <p className="small">Service</p>
                  <p>{service.name}</p>
                </div>
                <div>
                  <p className="small">Date &amp; time</p>
                  <p>{dateLabel(date)} · {timeLabel(time)}</p>
                </div>
                <div>
                  <p className="small">Duration</p>
                  <p>{service.duration} minutes</p>
                </div>
                <div>
                  <p className="small">Service total</p>
                  <p>{money(service.price)}</p>
                </div>
                {fee > 0 && (
                  <div>
                    <p className="small">Reservation fee</p>
                    <p>{money(fee)}</p>
                  </div>
                )}
                <div>
                  <p className="small">Balance due</p>
                  <p>{money(balance)}</p>
                </div>
              </div>
              <div style={{ border: '1px solid #e6e0d8', borderRadius: 6, padding: 16, background: '#fffdfa', marginBottom: 24 }}>
                <ShieldCheck size={16} style={{ marginRight: 8 }} />
                <p style={{ display: 'inline', fontSize: 14, color: '#6d665e' }}>
                  This request will be reviewed by the studio. No payment is
                  taken at this stage. Your appointment is not confirmed until
                  the studio approves it.
                </p>
              </div>
            </>
          )}

          {error && (
            <div style={{ background: '#fff4f4', color: '#b00020', padding: 12, borderRadius: 6, fontSize: 14, marginBottom: 16 }}>
              {error}
            </div>
          )}
          {apiError && (
            <div style={{ background: '#fff4f4', color: '#b00020', padding: 12, borderRadius: 6, fontSize: 14, marginBottom: 16 }}>
              {apiError}
            </div>
          )}

          {!isStep4 && (
            <div className="booking-actions">
              {step > 1 && (
                <button type="button" className="btn btn-link" onClick={prev}>
                  Back <ArrowLeft size={15} />
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={step === 3 ? submitRequest : next}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 size={15} className="spin" />
                    Submitting request
                  </>
                ) : step === 3 ? (
                  <>
                    Submit request <Check size={15} />
                  </>
                ) : (
                  <>
                    Continue <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          )}
        </section>

        <aside className="booking-summary">
          <div className="summary-card">
            <h3>Your selection</h3>
            <div className="summary-row">
              <span>Service</span>
              <b>{service.name}</b>
            </div>
            <div className="summary-row">
              <span>Duration</span>
              <b>{service.duration} min</b>
            </div>
            <div className="summary-row">
              <span>Price</span>
              <b>{money(service.price)}</b>
            </div>
            {fee > 0 && (
              <div className="summary-row">
                <span>Reservation fee</span>
                <b>{money(fee)}</b>
              </div>
            )}
            <div className="summary-total">
              <span>Total</span>
              <b>{money(balance)}</b>
            </div>
          </div>
          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 14, color: '#6d665e', marginBottom: 12 }}>
              Questions? Contact the studio.
            </p>
            <a
              href={`mailto:${services[0] && 'freemancedil69@gmail.com'}`}
              className="btn-link"
            >
              <Mail size={14} /> Contact the studio
            </a>
          </div>
        </aside>
      </div>

      {isStep4 && done && (
        <div className="confirmation-card" style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', padding: 48, background: '#fffdfa', border: '1px solid #e6e0d8', borderRadius: 8 }}>
          <div className="confirmation-icon">
            <Check size={28} />
          </div>
          <h1 style={{ marginBottom: 16 }}>Request received.</h1>
          <p style={{ marginBottom: 24, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto', color: '#6d665e' }}>
            Your booking request has been sent to the studio. It is now pending
            review. You will be notified once the artist has reviewed your
            request.
          </p>
          <div className="confirmation-details">
            <dt>Reference</dt>
            <dd>{done.ref}</dd>
            <dt>Service</dt>
            <dd>{serviceName(done.serviceId)}</dd>
            <dt>Date &amp; time</dt>
            <dd>{dateLabel(done.date)} · {timeLabel(done.time)}</dd>
            <dt>Status</dt>
            <dd>{done.status}</dd>
          </div>
          <p style={{ marginTop: 24, fontSize: 14, color: '#6d665e' }}>
            No payment has been taken. Do not send money until the artist confirms your appointment.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/requests')}
            >
              View my bookings
            </button>
            <a
              onClick={(e) => { e.preventDefault(); navigate('/guide'); }}
              className="btn-link"
            >
              Read the pre-appointment guide
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
