import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import { SectionHeading } from '../components/SectionHeading';

export function Guide() {
  useEffect(() => {
    document.title = 'Pre-appointment guide — StyledByC';
  }, []);
  const navigate = useNavigate();

  return (
    <main className="policy-page" id="content">
      <div className="container">
        <SectionHeading eyebrow="Pre-appointment guide">
          Your appointment, <em>prepared with care.</em>
        </SectionHeading>
        <p style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto var(--sb-space-6)' }}>
          Please review this checklist before booking your appointment to
          ensure safe application and the best results.
        </p>

        <article className="policy-article">
          <section>
            <h3>Skin &amp; health checklist</h3>
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
            <h3>Why this matters</h3>
            <p>
              Hybrid tint stains both hair and skin. Certain conditions may
              cause irritation, uneven results, or over-processing.
            </p>
          </section>

          <section>
            <h3>Pre-appointment prep (48&ndash;72 hours before)</h3>
            <ol>
              <li>Avoid Retinol, AHA/BHA, and exfoliating products</li>
              <li>Avoid facials, waxing, or chemical peels</li>
              <li>Avoid tanning or self-tanner on the face</li>
              <li>Arrive with clean, makeup-free brows</li>
            </ol>
          </section>

          <section>
            <h3>When to reschedule</h3>
            <ol>
              <li>Sunburn</li>
              <li>Broken or irritated skin</li>
              <li>Active eczema flare-up</li>
              <li>Recent advanced skin treatments</li>
            </ol>
          </section>

          <section>
            <h3>Consent</h3>
            <p>
              By booking, you confirm you have read and understood this guide
              and disclosed relevant conditions.
            </p>
          </section>
        </article>

        <div className="policy-notice">
          <ShieldCheck size={16} />
          This guide is for preparation and disclosure, not medical clearance.
          Contact the artist if you have questions about suitability.
        </div>

        <div className="policy-cta" style={{ marginTop: 40, textAlign: 'center' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/book')}
          >
            Book an appointment
          </button>
        </div>
      </div>
    </main>
  );
}
