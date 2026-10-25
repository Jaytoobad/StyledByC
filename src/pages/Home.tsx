import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { ArrowRight, ArrowDownRight, ShieldCheck } from 'lucide-react';
import { services, settings } from '../config';
import { money } from '../lib/money';
import { ServiceCard } from '../components/ServiceCard';

const categories = Array.from(new Set(services.map((s) => s.category)));

export function Home() {
  useEffect(() => {
    document.title = 'StyledByC — Lash &amp; Brow Appointments, Accra';
  }, []);
  const navigate = useNavigate();
  const featured = services.slice(0, 3);
  const fee = settings.reservationFee;

  return (
    <main className="home" id="content">
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-content">
            <div className="hero-eyebrow">StyledByC</div>
            <h1>
              Lash &amp; brow treatments, <em>your definition.</em>
            </h1>
            <p>
              Considered lash and brow treatments designed to complement your
              natural features. A little time for yourself, with results that
              feel like you.
            </p>
            <div className="hero-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate('/book')}
              >
                Book an appointment <ArrowRight size={15} />
              </button>
              <a
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/services');
                }}
                className="btn btn-secondary"
              >
                View services <ArrowDownRight size={15} />
              </a>
            </div>
            <div className="hero-reassurance">
              <ShieldCheck size={13} />
              Appointments secured with a reservation fee
              {fee > 0 && ` · ${money(fee)}`}
            </div>
          </div>

          <div className="hero-image">
            <img
              src="/images/brow-lamination-hybrid-tint/01.jpg"
              alt="StyledByC brow lamination and hybrid tint result"
              loading="lazy"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/images/brow-shaping-blade/placeholder.svg'; }}
            />
          </div>
        </div>
      </section>

      <section className="approach">
        <div className="container">
          <p>
            Quiet luxury. Thoughtful technique. Individual appointments made
            with care.
          </p>
        </div>
      </section>

      <section className="featured">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Featured services</div>
            <h2>Find your <em>signature.</em></h2>
          </div>
          <div className="featured-grid">
            {featured.map((s) => (
              <ServiceCard key={s.id} s={s} onBook={(id) => navigate(`/book?service=${id}`)} />
            ))}
          </div>
        </div>
      </section>

      <section className="how-it-works">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">How it works</div>
            <h2>Booking in <em>three steps.</em></h2>
          </div>
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <h3>Choose a service</h3>
              <p>Pick the lash or brow treatment that suits you.</p>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>Pick a time</h3>
              <p>Select a date and an available appointment slot.</p>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>Pay reservation fee</h3>
              <p>Secure your booking with a reservation fee.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="guide-teaser">
        <div className="guide-teaser-content">
          <div className="eyebrow">Before you arrive</div>
          <h3>A little preparation.<br /><em>A better experience.</em></h3>
          <p>
            Some treatments need a little extra care before your appointment.
            Review the pre-appointment guide so we can help you get the best
            result from your visit.
          </p>
          <a
            onClick={(e) => {
              e.preventDefault();
              navigate('/guide');
            }}
            className="link-arrow"
          >
            Read the pre-appointment guide <ArrowRight size={15} />
          </a>
        </div>
        <div className="guide-teaser-image">
          <img
            src="/images/brow-lamination-hybrid-tint/02.jpg"
            alt="StyledByC pre-appointment brow care"
            loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/images/brow-shaping-blade/placeholder.svg'; }}
          />
        </div>
      </section>

      <section className="final-cta">
        <div className="container">
          <h2>Make space for <em>yourself.</em></h2>
          <p>Choose your service. Pick a time that works. Leave the rest to us.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/book')}
          >
            Book your appointment <ArrowRight size={15} />
          </button>
        </div>
      </section>
    </main>
  );
}
