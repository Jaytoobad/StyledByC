import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowDownRight, ShieldCheck, Phone } from 'lucide-react';
import { services, settings } from '../config';
import { money } from '../lib/money';
import { ServiceListing, type Service } from '../components/ServiceListing';
import { SectionHeading } from '../components/SectionHeading';
import { useSiteImages } from '../lib/site-images';
import { PreviousWorkGallery } from '../components/PreviousWorkGallery';
import { LocalBusinessSchema } from '../components/LocalBusinessSchema';

export function Home() {
  useEffect(() => {
    document.title = 'StyledByC \u2014 Brow Appointments, Accra';
  }, []);
  const navigate = useNavigate();
  const [list, setList] = useState<Service[]>(services);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const fee = settings.reservationFee;
  const { loading: imagesLoading } = useSiteImages();

  useEffect(() => {
    let cancelled = false;
    fetch('/api/services')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data || !Array.isArray(data.services)) {
          throw new Error(
            typeof data?.error === 'string' ? data.error : 'Could not load services.',
          );
        }
        return data.services as Service[];
      })
      .then((rows) => {
        if (!cancelled) {
          setList(
            rows.filter((service) => service.active !== false && service.category === 'Brows'),
          );
          setLoadError('');
        }
      })
      .catch((error) => {
        console.error('[home] service catalogue request failed:', error);
        if (!cancelled)
          setLoadError(
            'Showing the saved service menu because the latest services could not be loaded.',
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Scroll reveal — premium entrance animation for each section
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -80px 0px' },
    );
    document.querySelectorAll('.sr').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="home" id="content">
      <LocalBusinessSchema />
      <div className="glow" />
      <section className="hero sr sr-delay-1">
        <div className="hero-inner">
          <div className="hero-content reveal reveal-delay-1">
            <div className="hero-eyebrow">StyledByC</div>
            <h1 className="text-gradient">
              Brow treatments, <em>your definition.</em>
            </h1>
            <p className="reveal reveal-delay-2">
              Considered brow treatments designed to complement your natural features. A little time
              for yourself, with results that feel like you.
            </p>
            <div className="hero-actions reveal reveal-delay-3">
              <button
                type="button"
                className="btn btn-primary lift"
                onClick={() => navigate('/book')}
              >
                Book an appointment <ArrowRight size={15} />
              </button>
              <a href="/services" className="btn btn-secondary lift">
                View services <ArrowDownRight size={15} />
              </a>
            </div>
            <div className="hero-reassurance reveal reveal-delay-4">
              <ShieldCheck size={13} />
              Appointments secured with a reservation fee
              {fee > 0 && ` \u00B7 ${money(fee)}`}
            </div>
          </div>
        </div>
      </section>

      <section className="services-pricing sr sr-delay-1">
        <div className="container">
          <SectionHeading eyebrow="Services &amp; pricing">
            Find your <em>signature.</em>
          </SectionHeading>
          {loadError && (
            <p role="status" style={{ textAlign: 'center' }}>
              {loadError}
            </p>
          )}
          <div className="services-grid">
            {loading && (
              <p
                role="status"
                style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--sb-grey)' }}
              >
                Loading services…
              </p>
            )}
            {!loading &&
              list.map((s) => (
                <ServiceListing key={s.id} s={s} onBook={(id) => navigate(`/book?service=${id}`)} />
              ))}
            {!loading && list.length === 0 && (
              <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--sb-grey)' }}>
                No services are available right now. Please contact the studio.
              </p>
            )}
          </div>
          <div className="more-services">
            <Link to="/services" className="btn btn-secondary lift">
              View all services <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      <PreviousWorkGallery />

      <section className="pre-appointment-guide sr sr-delay-1">
        <div className="container">
          <SectionHeading eyebrow="Pre-appointment guide" align="left">
            Prepare for your <em>appointment.</em>
          </SectionHeading>
          <div className="guide-grid">
            <div className="guide-card lift">
              <h3>Before your visit</h3>
              <p>
                Some treatments need a little extra care before your appointment. Review the
                pre-appointment guide so we can help you get the best result from your visit.
              </p>
            </div>
            <div className="guide-card lift">
              <h3>Hybrid tint preparation</h3>
              <p>
                Avoid Retinol, AHA, BHA, facials, waxing, or chemical peels 48&ndash;72 hours before
                your appointment. Arrive with clean, makeup-free brows.
              </p>
            </div>
            <div className="guide-card lift">
              <h3>Skin &amp; health disclosure</h3>
              <p>
                Please disclose any medications, skin conditions, allergies, or recent treatments so
                we can assess the best option for you.
              </p>
            </div>
          </div>
          <a href="/guide" className="link-arrow">
            Read the full pre-appointment guide <ArrowRight size={15} />
          </a>
        </div>
      </section>

      <section className="how-to-book sr sr-delay-1">
        <div className="container">
          <SectionHeading eyebrow="How to book">
            Booking in <em>three steps.</em>
          </SectionHeading>
          <div className="steps">
            <div className="step lift">
              <div className="step-number">1</div>
              <h3>Choose a service</h3>
              <p>Pick the brow treatment that suits you.</p>
            </div>
            <div className="step lift">
              <div className="step-number">2</div>
              <h3>Pick a time</h3>
              <p>Select a date and an available appointment slot.</p>
            </div>
            <div className="step lift">
              <div className="step-number">3</div>
              <h3>Pay reservation fee</h3>
              <p>Secure your booking with a reservation fee.</p>
            </div>
          </div>
          <p className="how-to-book-note">
            This is a request, not a confirmed booking. We will review it and reply by SMS. If
            approved, you will have 30 minutes to pay the GH₵100 reservation fee to secure your
            slot.
          </p>
        </div>
      </section>

      <section className="brand-approach sr sr-delay-1">
        <div className="container">
          <div className="brand-grid">
            <div className="brand-content lift">
              <SectionHeading eyebrow="Our approach" align="left">
                Considered <em>beauty.</em>
              </SectionHeading>
              <p className="brand-lede">
                We believe good brow work starts with listening — to your face, your features, and
                the way you want to look. No templates, no trends for trends' sake. Just considered
                treatments that complement what's already there.
              </p>
              <div className="brand-notes">
                <div className="brand-note lift">
                  <ShieldCheck size={14} />
                  <span>Appointments secured with a reservation fee</span>
                </div>
                <div className="brand-note lift">
                  <Phone size={14} />
                  <span>Confirmed by SMS within 24 hours</span>
                </div>
              </div>
            </div>
            <div className="brand-image lift">
              <div className="image-frame image-frame--brand">
                <img
                  src="/images/brow-lamination-hybrid-tint/01.jpg"
                  alt="StyledByC studio interior"
                  loading="eager"
                  width={400}
                  height={500}
                  fetchPriority="high"
                />
              </div>
            </div>
          </div>
          <div className="brand-actions">
            <button
              type="button"
              className="btn btn-primary lift"
              onClick={() => navigate('/book')}
            >
              Book an appointment <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </section>

      <section className="final-cta sr sr-delay-1">
        <div className="container">
          <SectionHeading>
            Make space for <em>yourself.</em>
          </SectionHeading>
          <p className="reveal reveal-delay-1">
            Choose your service. Pick a time that works. Leave the rest to us.
          </p>
          <button type="button" className="btn btn-primary lift" onClick={() => navigate('/book')}>
            Book your appointment <ArrowRight size={15} />
          </button>
        </div>
      </section>
    </main>
  );
}
