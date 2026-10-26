import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Camera, Check, Loader2, Mail } from 'lucide-react';
import { services } from '../config';
import { SectionHeading } from './SectionHeading';
import { submitBooking } from '../lib/api';
import { money, dateLabel, timeLabel } from '../lib/money';
import { CHECKLIST_SERVICES, POLICY_VERSION, RESERVATION_FEE_GHS, PAYMENT_WINDOW_MINUTES, AVAILABILITY_FALLBACK } from '../config/booking';
import { PhotoCapture, type StoredPhoto } from './PhotoCapture';
import { processImage, MAX_PAYLOAD_BYTES } from '../lib/image';

type Service = (typeof services)[number];

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
  paymentOption?: string;
  amountPaid?: number;
  balanceDue?: number;
  paymentStatus?: string;
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
  const [h, m] = AVAILABILITY_FALLBACK.openingTime.split(':').map(Number);
  const [eh, em] = AVAILABILITY_FALLBACK.closingTime.split(':').map(Number);
  for (let n = h * 60 + m; n < eh * 60 + em; n += AVAILABILITY_FALLBACK.stepMinutes) {
    result.push(String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'));
  }
  return result;
};

const QUESTIONNAIRE_ITEMS = [
  'Using acne medication (e.g., Accutane, prescription creams)',
  'Using Retinol, AHA, or BHA products',
  'Started new medications recently',
  'Sensitive skin',
  'Eczema, dermatitis, or skin conditions',
  'Pregnant or breastfeeding',
  'Recent facial, peel, or skin treatment (last 7 days)',
  'Recent skin changes (breakouts, dryness, irritation)',
];

const PHOTO_SLOTS = [
  {
    id: 1,
    label: 'Photo 1',
    required: true,
    caption: 'Close-up, facing the camera straight on. Both brows fully visible, no makeup, good light.',
  },
  {
    id: 2,
    label: 'Photo 2',
    required: true,
    caption: 'Close-up from a slight angle so we can see brow shape and skin.',
  },
  {
    id: 3,
    label: 'Photo 3',
    required: false,
    caption: 'Anything we should know about (patch, scar, previous tint).',
  },
] as const;

export function BookingFlow() {
  const { serviceId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialService = useMemo(() => { const fromQuery = searchParams.get('service'); const id = serviceId || fromQuery; return services.find((s) => s.id === id) || services[0]; }, [serviceId, searchParams]);

  const [service, setService] = useState<Service>(initialService);
  const [step, setStep] = useState(1);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [photos, setPhotos] = useState<StoredPhoto[]>([]);
  const [photosConsent, setPhotosConsent] = useState(false);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [done, setDone] = useState<LocalBooking | null>(null);

  const [questionnaire, setQuestionnaire] = useState<Record<string, 'yes' | 'no' | ''>>(Object.fromEntries(QUESTIONNAIRE_ITEMS.map((item) => [item, ''])));
  const [questionnaireExtra, setQuestionnaireExtra] = useState('');
  const [policyAccepted, setPolicyAccepted] = useState(false);

  const needsQuestionnaire = CHECKLIST_SERVICES.includes(service.name);
  const showPhotos = service.photoRequired;
  const photoStepId = showPhotos ? (needsQuestionnaire ? 5 : 4) : null;
  const reviewStepId = needsQuestionnaire ? 6 : 5;

  const steps = useMemo(() => {
    const result = [
      { id: 1, label: 'Service' },
      { id: 2, label: 'Date & time' },
      { id: 3, label: 'Your details' },
    ];
    if (needsQuestionnaire) result.push({ id: 4, label: 'Questionnaire' });
    if (showPhotos) result.push({ id: photoStepId!, label: 'Brow photos' });
    result.push({ id: reviewStepId, label: 'Review & send' });
    return result;
  }, [needsQuestionnaire, showPhotos, photoStepId, reviewStepId]);

  useEffect(() => {
    const s = services.find((x) => x.id === serviceId);
    if (s) {
      setService(s);
      setStep(1);
      setDate('');
      setTime('');
      setName('');
      setEmail('');
      setPhone('');
      setPhotos([]);
      setPhotosConsent(false);
      setConsent(false);
      setDone(null);
      setApiError('');
      setQuestionnaire(Object.fromEntries(QUESTIONNAIRE_ITEMS.map((item) => [item, ''])));
      setQuestionnaireExtra('');
      setPolicyAccepted(false);
    }
  }, [serviceId]);

  const allSlots = useMemo(() => slots(), []);
  const available = useMemo(() => {
    if (!date) return [];
    return allSlots;
  }, [allSlots, date]);

  const minDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
  }, []);

  const openDates = useMemo(() => {
    const result: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < AVAILABILITY_FALLBACK.daysAhead; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      if (AVAILABILITY_FALLBACK.openDays.includes(d.getDay())) {
        result.push(d.toISOString().split('T')[0]);
      }
    }
    return result;
  }, []);

  const next = () => {
    setApiError('');
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!date || !time) { setApiError('Please select a date and time to continue.'); return; }
      setStep(3);
      return;
    }
    if (step === 3) {
      if (!name.trim()) { setApiError('Please enter your full name.'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setApiError('Please enter a valid email address.'); return; }
      if (!/^[+0-9\s()-]{7,20}$/.test(phone.trim())) { setApiError('Please enter a valid phone number.'); return; }
      if (service.tintGuideRequired && !consent) { setApiError('Please confirm you have read and understood the guide.'); return; }
      setStep(needsQuestionnaire ? 4 : photoStepId ?? reviewStepId);
      return;
    }
    if (step === 4 && needsQuestionnaire) {
      const allAnswered = QUESTIONNAIRE_ITEMS.every((item) => questionnaire[item] === 'yes' || questionnaire[item] === 'no');
      if (!allAnswered) { setApiError('Please answer all questionnaire questions.'); return; }
      setStep(photoStepId ?? reviewStepId);
      return;
    }
    if (step === photoStepId) {
      const missing = PHOTO_SLOTS.filter((s) => s.required && !photos.some((p) => p.slotId === s.id)).map((s) => s.label);
      if (missing.length) { setApiError(`Please add ${missing.join(' and ')} to continue.`); return; }
      if (!photosConsent) { setApiError('Please agree to share your photos for assessment.'); return; }
      setStep(reviewStepId);
      return;
    }
  };

  const prev = () => { setApiError(''); setStep((v) => Math.max(v - 1, 1)); };

  const createBooking = async () => {
    if (submitting) return;
    if (!policyAccepted) { setApiError('Please accept the policies to continue.'); return; }
    setSubmitting(true); setApiError('');
    try {
      const questionnairePayload = needsQuestionnaire ? { items: QUESTIONNAIRE_ITEMS.map((q) => ({ question: q, answer: questionnaire[q] })), extra: questionnaireExtra } : undefined;

      let photoPayload = photos.map(({ name, mimeType, dataBase64 }) => ({ name, mimeType, dataBase64 }));
      let payload: any = {
        serviceId: service.id, date, time, name: name.trim(), email: email.trim(), phone: phone.trim(), note: '',
        questionnaire: questionnairePayload ? JSON.stringify(questionnairePayload) : undefined,
        policyAccepted: true, policyVersion: POLICY_VERSION, acceptedAt: new Date().toISOString(), requestType: 'request',
        photos: photoPayload,
      };

      if (new Blob([JSON.stringify(payload)]).size > MAX_PAYLOAD_BYTES) {
        photoPayload = await Promise.all(photos.map((p) => processImage(p.file, { quality: 0.4 })));
        payload = { ...payload, photos: photoPayload.map(({ name, mimeType, dataBase64 }) => ({ name, mimeType, dataBase64 })) };
      }

      if (new Blob([JSON.stringify(payload)]).size > MAX_PAYLOAD_BYTES) {
        setApiError('Your photos are too large to submit. Please retake them at a smaller size or remove Photo 3 and try again.');
        setSubmitting(false);
        return;
      }

      const result = await submitBooking(payload);
      if (!result.ok || !result.booking) { setApiError(result.error || 'Your request could not be submitted. Please try again.'); setSubmitting(false); return; }
      const booking: LocalBooking = {
        ref: result.booking.ref, name, email, phone, serviceId: service.id, date, time, fee: RESERVATION_FEE_GHS, status: result.booking.status || 'Pending Approval',
        photo: photos.length ? photos.map((p) => p.name).join(', ') : undefined, paymentOption: 'request', amountPaid: 0, balanceDue: service.price, paymentStatus: 'Unpaid',
      };
      const all = [booking, ...getBookings()];
      try { localStorage.setItem(KEY, JSON.stringify(all)); } catch {}
      setDone(booking); setSubmitting(false);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Could not reach the booking service. Please try again later.');
      setSubmitting(false);
    }
  };

  const serviceName = (id: string) => services.find((s) => s.id === id)?.name || id;
  const isReviewStep = step === reviewStepId;

  return (
    <main className="booking" id="content">
      <div className="booking-header">
        <button className="booking-back" type="button" onClick={() => { if (step === 1) { navigate('/services'); } else if (done) { navigate('/services'); } else { prev(); } }} style={{ minHeight: 44 }}>
          <ArrowLeft size={15} />
          {step === 1 ? 'Back to services' : done ? 'Back to services' : 'Previous step'}
        </button>
        <div className="booking-progress">
          <p className="small">Send a request</p>
          <div className="progress-steps">
            {steps.map((s) => (
              <div key={s.id} className={`progress-step ${step === s.id ? 'active' : step > s.id ? 'done' : ''}`}>
                <div className="step-circle">{step >= s.id ? <Check size={14} /> : s.id}</div>
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
              <SectionHeading align="left">Choose your <em>service.</em></SectionHeading>
              <p className="booking-sub">Select the treatment you would like to book.</p>
              <label className="booking-field">
                <span>Service</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {services.map((s) => (
                    <button key={s.id} type="button" className={`choice ${service.id === s.id ? 'selected' : ''}`} onClick={() => { setService(s); setTime(''); setStep(2); }} style={{ minHeight: 44 }}>
                      <input type="radio" name="service" checked={service.id === s.id} readOnly />
                      <span>
                        <span className="choice-name">{s.name}</span>
                        <span className="choice-meta">{s.duration} min · {s.category}</span>
                      </span>
                      <span className="choice-price">{money(s.price)}</span>
                    </button>
                  ))}
                </div>
              </label>
            </>
          )}

          {step === 2 && (
            <>
              <SectionHeading align="left" as="h1">Pick your <em>date and time.</em></SectionHeading>
              <p className="booking-sub">Select a day and an available appointment slot.</p>
               <div className="booking-field">
                 <label>Appointment date</label>
                 <div className="times">
                   {openDates.map((d) => (<button key={d} type="button" className={`time-chip ${date === d ? 'selected' : ''}`} onClick={() => { setDate(d); setTime(''); }} style={{ minHeight: 44, fontSize: 16 }}>{new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</button>))}
                 </div>
               </div>
               <div className="booking-field">
                 <label>Appointment time</label>
                 <div className="times">
                   {date ? (available.length ? available.map((t) => (<button key={t} type="button" className={`time-chip ${time === t ? 'selected' : ''}`} onClick={() => setTime(t)} style={{ minHeight: 44, fontSize: 16 }}>{timeLabel(t)}</button>)) : <p className="no-slots">No available times right now. Please check back soon or contact the studio.</p>) : <p className="no-slots">Choose a date to view times.</p>}
                 </div>
               </div>
            </>
          )}

          {step === 3 && (
            <>
              <SectionHeading align="left" as="h1">A few <em>details, please.</em></SectionHeading>
              <p className="booking-sub">Tell us how to reach you about your appointment.</p>
              <div className="booking-field">
                <label htmlFor="name">Full name</label>
                <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" style={{ minHeight: 44, fontSize: 16 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="booking-field">
                  <label htmlFor="email">Email address</label>
                  <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={{ minHeight: 44, fontSize: 16 }} />
                </div>
                <div className="booking-field">
                  <label htmlFor="phone">Phone number</label>
                  <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+233 ..." style={{ minHeight: 44, fontSize: 16 }} />
                </div>
              </div>
              {service.tintGuideRequired && (
                <div className="booking-field" style={{ border: '1px solid #e6e0d8', borderRadius: 6, padding: 16, background: '#fffdfa' }}>
                  <h3 style={{ marginBottom: 8, fontSize: 16 }}>Hybrid tint preparation</h3>
                  <p style={{ fontSize: 14, color: 'var(--sb-grey)', marginBottom: 12 }}>By booking, you confirm you have read and understood the pre-appointment guide and will disclose relevant conditions to the artist.</p>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: '#252321', cursor: 'pointer' }}>
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2, accentColor: '#101010' }} />
                    I have read and understood the guide and will disclose relevant concerns to the artist.
                  </label>
                </div>
              )}
            </>
          )}

          {step === 4 && needsQuestionnaire && (
            <>
              <SectionHeading align="left" as="h1">Skin &amp; health <em>questionnaire</em></SectionHeading>
              <p className="booking-sub">Answering honestly keeps you safe. A Yes does not automatically stop your booking. It helps us assess the best option for you.</p>
              {QUESTIONNAIRE_ITEMS.map((item) => (
                <div key={item} className="booking-field" style={{ borderBottom: '1px solid #f0ebe4', paddingBottom: 12 }}>
                  <p style={{ fontSize: 16, marginBottom: 10 }}>{item}</p>
                  <div style={{ display: 'flex', gap: 20 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 16, minHeight: 44 }}>
                      <input type="radio" name={`q-${item}`} checked={questionnaire[item] === 'yes'} onChange={() => setQuestionnaire((prev) => ({ ...prev, [item]: 'yes' }))} style={{ width: 18, height: 18 }} />
                      Yes
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 16, minHeight: 44 }}>
                      <input type="radio" name={`q-${item}`} checked={questionnaire[item] === 'no'} onChange={() => setQuestionnaire((prev) => ({ ...prev, [item]: 'no' }))} style={{ width: 18, height: 18 }} />
                      No
                    </label>
                  </div>
                </div>
              ))}
              <div className="booking-field">
                <label htmlFor="qextra" style={{ fontSize: 16 }}>Anything else we should know? (allergies, products you use around your brows, previous tints)</label>
                <textarea id="qextra" value={questionnaireExtra} onChange={(e) => setQuestionnaireExtra(e.target.value)} rows={4} style={{ fontSize: 16, padding: 10 }} />
              </div>
            </>
          )}

          {step === photoStepId && (
            <>
              <SectionHeading align="left" as="h1">Brow <em>photos.</em></SectionHeading>
              <p className="booking-sub">Please share two photos of your brows so we can assess them before your appointment.</p>
              {PHOTO_SLOTS.map((slot) => (
                <div key={slot.id} style={{ marginBottom: 20 }}>
                  <PhotoCapture
                    slot={slot}
                    photo={photos.find((p) => p.slotId === slot.id) || null}
                    onChange={(p) => setPhotos((prev) => {
                      const next = prev.filter((x) => x.slotId !== slot.id);
                      if (p) next.push(p);
                      return next;
                    })}
                  />
                </div>
              ))}
              <div className="booking-field" style={{ border: '1px solid #e6e0d8', borderRadius: 6, padding: 16, background: '#fffdfa' }}>
                <p style={{ fontSize: 16, color: 'var(--sb-grey)', marginBottom: 10 }}>Your photos are used only so we can assess your brows before your appointment, and are kept private.</p>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 16, cursor: 'pointer' }}>
                  <input type="checkbox" checked={photosConsent} onChange={(e) => setPhotosConsent(e.target.checked)} style={{ width: 20, height: 20, marginTop: 2, accentColor: '#101010', minWidth: 20 }} />
                  <span>I agree to share these photos for assessment.</span>
                </label>
              </div>
            </>
          )}

          {isReviewStep && !done && (
            <>
              <SectionHeading align="left" as="h1">Review &amp; <em>send request</em></SectionHeading>
              <p className="booking-sub">Review your details before sending.</p>

              <div className="booking-field" style={{ border: '1px solid #e6e0d8', borderRadius: 6, padding: 16, background: '#fffdfa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <b style={{ fontSize: 16 }}>Service</b>
                  <button type="button" className="btn-link" onClick={() => setStep(1)} style={{ minHeight: 44 }}>Edit</button>
                </div>
                <p style={{ fontSize: 16 }}>{service.name} · {service.duration} min · {money(service.price)}</p>
              </div>

              <div className="booking-field" style={{ border: '1px solid #e6e0d8', borderRadius: 6, padding: 16, background: '#fffdfa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <b style={{ fontSize: 16 }}>Date &amp; time</b>
                  <button type="button" className="btn-link" onClick={() => setStep(2)} style={{ minHeight: 44 }}>Edit</button>
                </div>
                <p style={{ fontSize: 16 }}>{dateLabel(date)} · {timeLabel(time)}</p>
              </div>

              <div className="booking-field" style={{ border: '1px solid #e6e0d8', borderRadius: 6, padding: 16, background: '#fffdfa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <b style={{ fontSize: 16 }}>Your details</b>
                  <button type="button" className="btn-link" onClick={() => setStep(3)} style={{ minHeight: 44 }}>Edit</button>
                </div>
                <p style={{ fontSize: 16, marginBottom: 4 }}>{name}</p>
                <p style={{ fontSize: 16, marginBottom: 4 }}>{email}</p>
                <p style={{ fontSize: 16 }}>{phone}</p>
              </div>

              {showPhotos && (
                <div className="booking-field" style={{ border: '1px solid #e6e0d8', borderRadius: 6, padding: 16, background: '#fffdfa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <b style={{ fontSize: 16 }}>Brow photos</b>
                    <button type="button" className="btn-link"                     onClick={() => setStep(photoStepId!)} style={{ minHeight: 44 }}>Edit</button>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {photos.map((p) => (
                      <div key={`${p.slotId}-${p.name}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <img src={p.preview} alt={p.name} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid #e6e0d8' }} />
                        <span style={{ fontSize: 13, color: 'var(--sb-grey)' }}>{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {needsQuestionnaire && (
                <div className="booking-field" style={{ border: '1px solid #e6e0d8', borderRadius: 6, padding: 16, background: '#fffdfa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <b style={{ fontSize: 16 }}>Questionnaire answers</b>
                    <button type="button" className="btn-link" onClick={() => setStep(4)} style={{ minHeight: 44 }}>Edit</button>
                  </div>
                  {QUESTIONNAIRE_ITEMS.map((item) => (<p key={item} style={{ fontSize: 15, marginBottom: 6 }}><span style={{ color: 'var(--sb-grey)' }}>{item}:</span> <b>{questionnaire[item]}</b></p>))}
                  {questionnaireExtra && <p style={{ fontSize: 15, marginTop: 8 }}><span style={{ color: 'var(--sb-grey)' }}>Extra notes:</span> {questionnaireExtra}</p>}
                </div>
              )}

              <div className="booking-field" style={{ border: '1px solid #e6e0d8', borderRadius: 6, padding: 16, background: '#fffdfa' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 16, cursor: 'pointer' }}>
                  <input type="checkbox" checked={policyAccepted} onChange={(e) => setPolicyAccepted(e.target.checked)} style={{ width: 20, height: 20, marginTop: 2, accentColor: '#101010', minWidth: 20 }} />
                  <span>I have read and agree to the <a href="/guide" target="_blank" rel="noopener noreferrer" className="btn-link" style={{ display: 'inline' }}>Booking &amp; Appointment Policies and the Pre-appointment guide</a>.</span>
                </label>
              </div>

              <div className="booking-field">
                <p style={{ fontSize: 15, color: 'var(--sb-grey)' }}>This is a request, not a confirmed booking. We will review it and reply by email. If approved, you will have {PAYMENT_WINDOW_MINUTES} minutes to pay the GH₵{RESERVATION_FEE_GHS} reservation fee to secure your slot.</p>
              </div>
            </>
          )}

          {apiError && <p className="form-error" style={{ color: '#b00020', fontSize: 15 }}>{apiError}</p>}

          {!done && !isReviewStep && (
            <div className="booking-actions">
              {step > 1 && <button type="button" className="btn btn-ghost" onClick={prev} style={{ minHeight: 44, fontSize: 16 }}>Previous</button>}
              <button type="button" className="btn btn-primary" onClick={next} style={{ minHeight: 44, fontSize: 16 }}>Continue <ArrowRight size={16} /></button>
            </div>
          )}

          {isReviewStep && !done && (
            <div className="booking-actions">
              <button type="button" className="btn btn-ghost" onClick={prev} style={{ minHeight: 44, fontSize: 16 }}>Previous</button>
              <button type="button" className="btn btn-primary" onClick={createBooking} disabled={submitting || !policyAccepted} style={{ minHeight: 44, fontSize: 16, opacity: submitting || !policyAccepted ? 0.6 : 1 }}>
                {submitting ? (<><Loader2 size={16} className="spin" /> Sending request</>) : ('Send request')}
              </button>
            </div>
          )}
        </section>

        <aside className="booking-summary">
          <div className="summary-card">
            <h2>Request summary</h2>
            <div className="summary-row"><span>Service</span><b>{service.name}</b></div>
            <div className="summary-row"><span>Duration</span><b>{service.duration} min</b></div>
            <div className="summary-row"><span>Price</span><b>{money(service.price)}</b></div>
            <div className="summary-total"><span>To pay if approved</span><b>GH₵{RESERVATION_FEE_GHS}</b></div>
            <p className="small" style={{ marginTop: 8 }}>{PAYMENT_WINDOW_MINUTES} min window to pay after approval</p>
          </div>
          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 14, color: 'var(--sb-grey)', marginBottom: 12 }}>Questions? Contact the studio.</p>
            <a href="mailto:freemancedil69@gmail.com" className="btn-link"><Mail size={14} /> Contact the studio</a>
          </div>
        </aside>
      </div>

      {done && (
        <div className="confirmation-card" style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', padding: 48, background: '#fffdfa', border: '1px solid #e6e0d8', borderRadius: 8 }}>
          <div className="confirmation-icon"><Check size={28} /></div>
          <h1 style={{ marginBottom: 16 }}>Request sent.</h1>
          <p style={{ marginBottom: 16, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto', color: 'var(--sb-grey)', fontSize: 16 }}>This is a request, not a confirmed booking. We will review it and reply by email. If approved, you will have {PAYMENT_WINDOW_MINUTES} minutes to pay the GH₵{RESERVATION_FEE_GHS} reservation fee to secure your slot.</p>
          <div className="confirmation-details" style={{ textAlign: 'left', maxWidth: 400, margin: '0 auto' }}>
            <dt>Booking reference</dt><dd>{done.ref}</dd>
            <dt>Service</dt><dd>{serviceName(done.serviceId)}</dd>
            <dt>Date &amp; time</dt><dd>{dateLabel(done.date)} · {timeLabel(done.time)}</dd>
            <dt>Status</dt><dd>{done.status}</dd>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/')} style={{ minHeight: 44, fontSize: 16 }}>Back to home</button>
          </div>
        </div>
      )}
    </main>
  );
}
