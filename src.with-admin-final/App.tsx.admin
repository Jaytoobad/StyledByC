
import { useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  ArrowDownRight,
  CalendarDays,
  Camera,
  Check,
  Clock3,
  Mail,
  Menu,
  ShieldCheck,
  Sparkles,
  X,
  Instagram,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import ImageGallery from './components/image-gallery';
import {
  business,
  services,
  settings,
  type Service,
} from './config';
import { submitBooking } from './lib/api';

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

const KEY = 'styledbyc-demo-availability-cache';

const money = (n: number) =>
  new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    maximumFractionDigits: 0,
  }).format(n);

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

const timeLabel = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-GH', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

const dateLabel = (s: string) =>
  new Date(`${s}T12:00:00`).toLocaleDateString('en-GH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

export default function App() {
  const [page, setPage] = useState('home');
  const [menu, setMenu] = useState(false);
  const [filter, setFilter] = useState('All');
  const [service, setService] = useState<Service>(services[0]);
  const [step, setStep] = useState(1);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [checkout, setCheckout] = useState(false);
  const [done, setDone] = useState<LocalBooking | null>(null);
  const [bookings, setBookings] = useState<LocalBooking[]>(getBookings);
  const [policyNote, setPolicyNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [submitOk, setSubmitOk] = useState(false);

  const listed = useMemo(
    () => services.filter((s) => filter === 'All' || s.category === filter),
    [filter]
  );

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const minDate = `${tomorrow.getFullYear()}-${String(
    tomorrow.getMonth() + 1
  ).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  // Local cache of confirmed bookings only — used for client-side availability hints.
  // The backend is authoritative for availability.
  const occupied = bookings
    .filter((b) => b.date === date && (b.status === 'Approved' || b.status === 'Demo confirmed'))
    .map((b) => b.time);

  const available = slots().filter((s) => !occupied.includes(s));
  const fee = settings.reservationFee;
  const balance = Math.max(
    0,
    service.price - (settings.feeCountsTowardTotal ? fee : 0)
  );

  const go = (p: string) => {
    setPage(p);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const start = (s?: Service) => {
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
    setCheckout(false);
    setSubmitting(false);
    setSubmitOk(false);
    go('book');
  };

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

    setStep((v) => v + 1);
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
        note: service.tintGuideRequired ? policyNote.trim() : '',
      });

      if (!result.ok || !result.booking) {
        setApiError(result.error || 'Your request could not be submitted. Please try again.');
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
      setBookings(all);
      setDone(booking);
      setCheckout(false);
      setStep(4);
      setSubmitOk(true);
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

  return (
    <div className="app">
      <div className="topline">
        <span>THOUGHTFULLY DESIGNED BEAUTY</span>
        <span>ACCRA, GHANA · BY APPOINTMENT</span>
      </div>

      {/* MAIN NAVIGATION */}
      <header className="header">
        <button
          className="brand"
          type="button"
          onClick={() => go('home')}
          aria-label="StyledByC home"
        >
          <img
            src="/styledbyC.png"
            alt="StyledByC"
            className="brand-logo"
          />
        </button>

        <nav
          id="main-navigation"
          className={menu ? 'nav open' : 'nav'}
          aria-label="Main navigation"
        >
          {[
            ['home', 'Home'],
            ['services', 'Services'],
            ['policy', 'Pre-appointment guide'],
            ['manage', 'Your requests'],
          ].map(([p, t]) => (
            <button
              type="button"
              className={page === p ? 'active' : ''}
              key={p}
              onClick={() => go(p)}
            >
              {t}
            </button>
          ))}
        </nav>

        <button
          className="btn dark headerbtn"
          type="button"
          onClick={() => start()}
        >
          Book an appointment <ArrowRight size={15} />
        </button>

        <button
          className="menubtn"
          type="button"
          aria-label={menu ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menu}
          aria-controls="main-navigation"
          onClick={() => setMenu((previous) => !previous)}
        >
          {menu ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {page === 'home' && (
        <main>
          <section className="hero">
            <div className="herotxt">
              <div className="eyebrow">— THE ART OF THE DETAIL</div>
              <h1>
                Beauty, in your
                <br />
                <em>own definition.</em>
              </h1>
              <p>
                Considered lash and brow treatments designed to complement your
                natural features. A little time for yourself, with results that
                feel like you.
              </p>

              <div className="actions">
                <button className="btn dark" onClick={() => start()}>
                  Reserve your appointment <ArrowRight size={15} />
                </button>
                <button
                  className="plain"
                  onClick={() =>
                    document
                      .getElementById('services')
                      ?.scrollIntoView({ behavior: 'smooth' })
                  }
                >
                  Explore services <ArrowDownRight size={16} />
                </button>
              </div>

              <div className="footnote">
                <ShieldCheck size={15} /> Appointments secured with a
                reservation fee
              </div>
            </div>

            <div className="heroimage">
              <img
                src="https://images.unsplash.com/photo-1583001809873-a128495da465?auto=format&fit=crop&w=1200&q=85"
                alt="Beauty treatment inspiration"
              />
              <span className="floatnote">
                <Sparkles size={17} /> YOUR TIME.
                <br /> YOUR RITUAL.
              </span>
              <div className="caption">
                01 / THE BROW EDIT{' '}
                <span>Soft definition. Intentional detail.</span>
              </div>
            </div>
          </section>

          <section className="intro">
            <span>01 — OUR APPROACH</span>
            <p>
              Quiet luxury. Thoughtful technique.
              <br />
              <em>Beauty that feels like you.</em>
            </p>
            <span>
              INDIVIDUAL APPOINTMENTS
              <br />
              MADE WITH CARE
            </span>
          </section>

          <section id="services" className="section">
            <div className="secthead">
              <div className="eyebrow">— THE SERVICE MENU</div>
              <h2>
                Find your <em>signature.</em>
              </h2>
            </div>

            <div className="grid">
              {services.slice(0, 3).map((s, i) => (
                <ServiceCard
                  key={s.id}
                  s={s}
                  i={i}
                  onBook={() => start(s)}
                />
              ))}
            </div>

            <button className="plain more" onClick={() => go('services')}>
              View all services <ArrowRight size={15} />
            </button>
          </section>

          <section className="editorial">
            <img
              src="https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=1000&q=85"
              alt="Beauty products and tools"
              loading="lazy"
            />
            <div>
              <div className="eyebrow">— BEFORE YOU ARRIVE</div>
              <h2>
                A little preparation.
                <br />
                <em>A better experience.</em>
              </h2>
              <p>
                Some treatments need a little extra care before your
                appointment. Review the relevant guide so we can help you get
                the best result from your visit.
              </p>
              <button className="btn outline" onClick={() => go('policy')}>
                Read the pre-appointment guide <ArrowRight size={15} />
              </button>
            </div>
          </section>

          <section className="cta">
            <div className="eyebrow">— YOUR NEXT APPOINTMENT</div>
            <h2>
              Make space for <em>yourself.</em>
            </h2>
            <p>
              Choose your service. Pick a time that works. Leave the rest to
              us.
            </p>
            <button className="btn light" onClick={() => start()}>
              Book your appointment <ArrowRight size={15} />
            </button>
          </section>
        </main>
      )}

      {page === 'services' && (
        <main className="page">
          <PageIntro
            eyebrow="THE SERVICE MENU"
            title={
              <>
                Considered care.
                <br />
                <em>Beautiful detail.</em>
              </>
            }
            desc="Explore the treatments and choose the one that feels right for you."
          />

          <div className="filters">
            {['All', 'Brows', 'Lashes'].map((f) => (
              <button
                className={filter === f ? 'chosen' : ''}
                key={f}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="grid">
            {listed.map((s, i) => (
              <ServiceCard
                key={s.id}
                s={s}
                i={i}
                onBook={() => start(s)}
              />
            ))}
          </div>
        </main>
      )}

      {page === 'policy' && (
        <main className="page policybg">
          <PageIntro
            eyebrow="PLEASE READ BEFORE YOUR VISIT"
            title={
              <>
                Your appointment,
                <br />
                <em>prepared with care.</em>
              </>
            }
            desc="This hybrid tint guide was supplied by the artist. It applies to hybrid tint appointments."
          />

          <article className="policy">
            <div className="docline">
              CLIENT CARE / 01 <span>PRE-APPOINTMENT GUIDE</span>
            </div>
            <h2>
              Hybrid Tint
              <br />
              <em>Pre-Appointment Guide</em>
            </h2>
            <p>
              Please review this checklist before booking your appointment to
              ensure safe application and the best results.
            </p>

            <Policy />

            <div className="notice">
              <ShieldCheck size={18} />
              This guide is for preparation and disclosure, not medical
              clearance. Contact the artist if you have questions about
              suitability.
            </div>

            <button className="btn dark" onClick={() => start(services.find((s) => s.id === 'brow-lamination-hybrid-tint'))}>
              Book a hybrid tint appointment <ArrowRight size={15} />
            </button>
          </article>
        </main>
      )}

      {page === 'book' && (
        <main className="booking">
          <div className="bookingtop">
            <button
              className="plain"
              onClick={() => (step === 1 ? go('services') : setStep((v) => v - 1))}
            >
              <ArrowLeft size={15} />{' '}
              {step === 1 ? 'Back to services' : 'Previous step'}
            </button>
            <span>APPOINTMENT REQUEST / {Math.min(step, 3)} OF 03</span>
          </div>

          {step === 4 && done ? (
            <div className="success">
              <div className="successicon">
                {submitOk ? <Check /> : <AlertTriangle size={30} />}
              </div>
              <div className="eyebrow">REQUEST SUBMITTED</div>
              <h1>
                Your request is <em>received.</em>
              </h1>
              <p>
                Your booking request has been sent to the studio. It is now
                pending review. You will be notified once the artist has
                reviewed your request and made a decision. No appointment is
                confirmed yet.
              </p>

              <div className="refbox">
                BOOKING REFERENCE
                <strong>{done.ref}</strong>
                <button
                  className="plain"
                  onClick={() => navigator.clipboard?.writeText(done.ref)}
                >
                  Copy reference
                </button>
              </div>

              <p>
                {serviceName(done.serviceId)}
                <br />
                {dateLabel(done.date)} · {timeLabel(done.time)}
                <br />
                Status: {done.status}
              </p>

              <div className="notice">
                <ShieldCheck size={17} />
                No payment has been taken. Do not send money until the artist
                confirms your appointment.
              </div>

              <button className="btn dark" onClick={() => go('home')}>
                Return to homepage <ArrowRight size={15} />
              </button>
            </div>
          ) : (
            <div className="booklayout">
              <section className="form">
                <div className="eyebrow">— YOUR APPOINTMENT</div>

                {step === 1 && (
                  <>
                    <h1>
                      Choose your <em>moment.</em>
                    </h1>
                    <p className="sub">
                      Select a service, date and time to get started.
                    </p>

                    <label className="label">SELECT A SERVICE</label>
                    <div className="servicechoices">
                      {services.map((s) => (
                        <button
                          key={s.id}
                          className={
                            service.id === s.id ? 'choice selected' : 'choice'
                          }
                          onClick={() => {
                            setService(s);
                            setTime('');
                          }}
                        >
                          <span className="radio">
                            {service.id === s.id && <Check size={12} />}
                          </span>
                          <span>
                            <b>{s.name}</b>
                            <small>
                              {s.duration} min · {s.category}
                              {s.photoRequired ? ' · Photo required' : ''}
                            </small>
                          </span>
                          <strong>{money(s.price)}</strong>
                        </button>
                      ))}
                    </div>

                    <div className="fields">
                      <div>
                        <label className="label" htmlFor="date">
                          APPOINTMENT DATE
                        </label>
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

                      <div>
                        <label className="label">APPOINTMENT TIME</label>
                        <div className="times">
                          {date ? (
                            available.length ? (
                              available.map((t) => (
                                <button
                                  className={time === t ? 'chosen' : ''}
                                  key={t}
                                  onClick={() => setTime(t)}
                                >
                                  {timeLabel(t)}
                                </button>
                              ))
                            ) : (
                              <small>No sample slots left on this date.</small>
                            )
                          ) : (
                            <small>Choose a date to view times.</small>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <h1>
                      A few details, <em>please.</em>
                    </h1>
                    <p className="sub">
                      Tell us how to reach you about your appointment.
                    </p>

                    <div className="inputstack">
                      <label className="label" htmlFor="name">
                        FULL NAME
                      </label>
                      <input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your full name"
                      />

                      <div className="fields">
                        <div>
                          <label className="label" htmlFor="email">
                            EMAIL ADDRESS
                          </label>
                          <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                          />
                        </div>
                        <div>
                          <label className="label" htmlFor="phone">
                            PHONE NUMBER
                          </label>
                          <input
                            id="phone"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+233 ..."
                          />
                        </div>
                      </div>

                      {service.photoRequired && (
                        <div className="uploadbox">
                          <b>
                            <Camera size={17} /> Share a brow photo
                          </b>
                          <p>
                            This service needs a photo so the artist can review
                            your brows.
                          </p>

                          {preview ? (
                            <div className="preview">
                              <img src={preview} alt="Selected brow preview" />
                              <button
                                className="plain"
                                onClick={() => {
                                  setPhoto(null);
                                  setPreview('');
                                }}
                              >
                                Remove photo
                              </button>
                            </div>
                          ) : (
                            <label className="uploadbtn">
                              <Camera size={16} /> Choose or take photo
                              <input
                                hidden
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(e) =>
                                  choosePhoto(e.target.files?.[0])
                                }
                              />
                            </label>
                          )}

                          <small>
                            Demo only: the photo stays in this browser and is
                            not uploaded.
                          </small>
                        </div>
                      )}

                      {service.tintGuideRequired && (
                        <div className="consent">
                          <h3>Hybrid tint preparation</h3>
                          <Policy compact />

                          <label className="check">
                            <input
                              type="checkbox"
                              checked={consent}
                              onChange={(e) => setConsent(e.target.checked)}
                            />
                            I have read and understood the guide and will
                            disclose relevant concerns to the artist.
                          </label>

                          <label className="label" htmlFor="note">
                            OPTIONAL NOTE FOR THE ARTIST
                          </label>
                          <textarea
                            id="note"
                            rows={2}
                            value={policyNote}
                            onChange={(e) => setPolicyNote(e.target.value)}
                            placeholder="Leave a short question or concern."
                          />
                          <small>
                            Avoid unnecessary medical details. This note is not
                            sent or securely stored in demo mode.
                          </small>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    <h1>
                      Review your <em>booking.</em>
                    </h1>
                    <p className="sub">
                      Check the details before continuing to demo checkout.
                    </p>

                    <div className="review">
                      {[
                        ['Service', service.name],
                        ['Date', dateLabel(date)],
                        ['Time', timeLabel(time)],
                        ['Duration', `${service.duration} minutes`],
                        ['Customer', name],
                        ['Contact', `${email} · ${phone}`],
                        ['Service total', money(service.price)],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <span>{k}</span>
                          <b>{v}</b>
                        </div>
                      ))}
                    </div>

                    <div className="notice">
                      <ShieldCheck size={17} />
                      This request will be reviewed by the studio. No payment
                      is taken at this stage.
                    </div>
                  </>
                )}

                {error && <div className="error">{error}</div>}

                {step < 3 && (
                  <button className="btn dark continue" onClick={next}>
                    Continue <ArrowRight size={15} />
                  </button>
                )}

                {step === 3 && (
                  <button
                    className="btn dark continue"
                    onClick={() => setCheckout(true)}
                    disabled={submitting}
                  >
                    Continue to checkout <ArrowRight size={15} />
                  </button>
                )}

                {checkout && (
                  <div className="checkout">
                    <button
                      className="close"
                      onClick={() => {
                        if (submitting) return;
                        setCheckout(false);
                      }}
                      aria-label="Close checkout"
                      disabled={submitting}
                    >
                      <X size={16} />
                    </button>
                    <span className="demo">BOOKING REQUEST</span>
                    <h3>Service total · {money(service.price)}</h3>
                    <p>
                      Submitting this request will send your details to the
                      studio for review. No payment is taken at this stage.
                    </p>
                    {apiError && (
                      <div className="error">{apiError}</div>
                    )}
                    <button
                      className="btn dark continue"
                      onClick={submitRequest}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={15} className="spin" /> Submitting request
                        </>
                      ) : (
                        <>
                          Submit request <Check size={15} />
                        </>
                      )}
                    </button>
                    <button
                      className="plain"
                      onClick={() => {
                        if (submitting) return;
                        setCheckout(false);
                        setApiError('');
                      }}
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                <div className="secure">
                  <ShieldCheck size={15} /> Your request is pending owner
                  review. No appointment is confirmed until the studio approves
                  it.
                </div>
              </section>

              <aside className="summary">
                <ImageGallery
                  images={service.gallery}
                  altBase={service.name}
                  emptyLabel="No service photos yet"
                  emptySublabel="Client photos will be added here soon."
                />
                <div>
                  <small>YOUR SELECTION</small>
                  <h3>{service.name}</h3>
                  <p>{service.description}</p>

                  <div className="sumrow">
                    <span>
                      <Clock3 size={14} /> {service.duration} min
                    </span>
                    <b>{money(service.price)}</b>
                  </div>

                  <hr />

                  <div className="contact">
                    <Mail size={15} /> Questions?{' '}
                    <a href={`mailto:${business.email}`}>Contact the studio</a>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </main>
      )}

      {page === 'manage' && (
        <main className="page">
          <PageIntro
            eyebrow="YOUR REQUESTS"
            title={
              <>
                Your bookings,
                <br />
                <em>at a glance.</em>
              </>
            }
            desc="Requests you submitted from this browser. This is a local
            record for your own reference — it is not the studio's admin
            system."
          />

          <div className="managebar">
            <b>{bookings.length} request(s) saved locally</b>
            <button
              className="btn outline"
              onClick={() => {
                localStorage.removeItem(KEY);
                setBookings([]);
              }}
            >
              Clear local data
            </button>
          </div>

          {bookings.length ? (
            bookings.map((b) => (
              <div className="bookingrow" key={b.ref}>
                <b>
                  {b.ref} · {b.name}
                </b>
                <span>
                  {serviceName(b.serviceId)} · {b.date} · {timeLabel(b.time)}
                </span>
                <small>
                  {b.email} · {money(b.fee)} · {b.status}
                </small>
              </div>
            ))
          ) : (
            <div className="empty">
              <CalendarDays size={30} />
              <h3>No requests yet</h3>
              <p>
                Requests you submit from this browser appear here for your
                reference.
              </p>
              <button className="btn dark" onClick={() => start()}>
                Make a request <ArrowRight size={15} />
              </button>
            </div>
          )}

          <div className="notice">
            <ShieldCheck size={17} />
            The studio reviews every request before confirming an appointment.
            This page only shows what you submitted from this browser.
          </div>
        </main>
      )}

      <footer className="footer">
        <div className="footercols">
          <div>
            <button className="brand footerbrand" onClick={() => go('home')}>
              <img
                src="/styledbyC.png"
                alt="StyledByC"
                className="brand-logo"
              />
            </button>
            <p>
              Thoughtful lash and brow treatments.
              <br />A little time, just for you.
            </p>
          </div>

          <div>
            <b>EXPLORE</b>
            <button onClick={() => go('services')}>Services</button>
            <button onClick={() => start()}>Book an appointment</button>
            <button onClick={() => go('policy')}>
              Pre-appointment guide
            </button>
          </div>

          <div>
            <b>GET IN TOUCH</b>
            <a href={`mailto:${business.email}`}>
              <Mail size={14} /> {business.email}
            </a>
            <a href={`tel:${business.phone.replace(/\s/g, '')}`}>
              {business.phone}
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer"
            >
              <Instagram size={14} /> Instagram
            </a>
          </div>
        </div>

        <div className="footbottom">
          © {new Date().getFullYear()} {business.name}
          <span>DEMO BUILD · SAMPLE PRICES &amp; POLICIES</span>
        </div>
      </footer>

      <div className="ribbon">DEMO EXPERIENCE</div>
    </div>
  );
}

function ServiceCard({
  s,
  i,
  onBook,
}: {
  s: Service;
  i: number;
  onBook: () => void;
}) {
  return (
    <article className="card">
      <div className="cardimg">
        <ImageGallery
          images={s.gallery}
          altBase={s.name}
          emptyLabel="No service photos yet"
          emptySublabel="Client photos will be added here soon."
        />
        <span>0{i + 1}</span>
        <button onClick={onBook} aria-label={`Book ${s.name}`}>
          <ArrowDownRight size={18} />
        </button>
      </div>

      <div className="cardbody">
        <small>
          {s.category.toUpperCase()} / {s.duration} MIN
        </small>
        <div className="cardtitle">
          <h3>{s.name}</h3>
          <b>{money(s.price)}</b>
        </div>
        <p>{s.description}</p>
        <button className="plain" onClick={onBook}>
          Book this service <ArrowRight size={14} />
        </button>
      </div>
    </article>
  );
}

function PageIntro({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: React.ReactNode;
  desc: string;
}) {
  return (
    <div className="pageintro">
      <div className="eyebrow">— {eyebrow}</div>
      <h1>{title}</h1>
      <p>{desc}</p>
    </div>
  );
}

function Policy({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'policycontent compact' : 'policycontent'}>
      <section>
        <h3>Skin &amp; Health Checklist</h3>
        <ol>
          <li>Using acne medication (e.g., Accutane, prescription creams)</li>
          <li>Using Retinol, AHA, or BHA products</li>
          <li>Started new medications recently</li>
          <li>Sensitive skin</li>
          <li>Eczema, dermatitis, or skin conditions</li>
          <li>Pregnant or breastfeeding</li>
          <li>Recent facial, peel, or skin treatment (last 7 days)</li>
          <li>Recent skin changes (breakouts, dryness, irritation)</li>
        </ol>
      </section>

      <section>
        <h3>Why This Matters</h3>
        <p>
          Hybrid tint stains both hair and skin. Certain conditions may cause
          irritation, uneven results, or over-processing.
        </p>
      </section>

      <section>
        <h3>
          Pre-Appointment Prep <span>(48–72 hours before)</span>
        </h3>
        <ol>
          <li>Avoid Retinol, AHA/BHA, and exfoliating products</li>
          <li>Avoid facials, waxing, or chemical peels</li>
          <li>Avoid tanning or self-tanner on the face</li>
          <li>Arrive with clean, makeup-free brows</li>
        </ol>
      </section>

      <section>
        <h3>When to Reschedule</h3>
        <ol>
          <li>Sunburn</li>
          <li>Broken or irritated skin</li>
          <li>Active eczema flare-up</li>
          <li>Recent advanced skin treatments</li>
        </ol>
      </section>

      {!compact && (
        <section>
          <h3>Consent</h3>
          <p>
            By booking, you confirm you have read and understood this guide and
            disclosed relevant conditions.
          </p>
        </section>
      )}
    </div>
  );
}
