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

        <article className="policy-article">
          <section>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid #d9c9b3' }}>BOOKING &amp; APPOINTMENT POLICIES</h2>
            <p style={{ fontSize: '16px' }}>
              Please read the following policies carefully before booking. By requesting and securing an appointment, you confirm that you have read, understood, and agreed to these terms and conditions.
            </p>
          </section>

          <section>
            <h3>1. Consultation &amp; Brow Assessment</h3>
            <p style={{ fontSize: '16px' }}>All clients are required to go through a brief consultation before making a deposit.</p>
            <p style={{ fontSize: '16px' }}>During the consultation, I will assess your natural brows, skin condition, previous treatments, and overall suitability for the service.</p>
            <p style={{ fontSize: '16px' }}>Depending on the condition of your brows, brow lamination or another preparation process may be required before your requested service can be performed. I reserve the right to recommend a different treatment or decline the service if your brows are not suitable at the time of consultation.</p>
          </section>

          <section>
            <h3>2. Skin, Products &amp; Medical Disclosure</h3>
            <p style={{ fontSize: '16px' }}>As part of your consultation, you may be asked questions about your skin, skincare routine, products you use around the brow area, recent treatments, allergies, sensitivities, and any other information that may affect the service.</p>
            <p style={{ fontSize: '16px' }}>You are responsible for providing complete and accurate information. Please do not withhold or misrepresent any relevant information.</p>
            <p style={{ fontSize: '16px' }}>If you fail to disclose relevant information after being asked, including the use of strong skincare products, active ingredients, recent treatments, allergies, sensitivities, or other conditions that may affect the service, I cannot be held responsible for an adverse reaction or outcome resulting from information that was not disclosed.</p>
            <p style={{ fontSize: '16px' }}>If I believe that a product, treatment, skin condition, or other factor may make the service unsuitable or unsafe, I reserve the right to refuse or postpone the appointment.</p>
            <p style={{ fontSize: '16px' }}>Your safety and the health of your skin and brows come first.</p>
          </section>

          <section>
            <h3>3. Booking &amp; Deposits</h3>
            <p style={{ fontSize: '16px' }}>A consultation or approval does not automatically secure your appointment.</p>
            <p style={{ fontSize: '16px' }}>Once you have been approved for the service, you will be given an available date and time and instructed to pay your booking deposit.</p>
            <p style={{ fontSize: '16px' }}>Once approved, your slot is held for 30 minutes while you pay the GH₵100 reservation fee. If payment is not received in that time, the slot is released. The reservation fee is non-refundable.</p>
            <p style={{ fontSize: '16px' }}>Your appointment is only confirmed once the deposit has been received.</p>
            <p style={{ fontSize: '16px' }}>Dates and times are not held without payment. If you are given a date and time but do not pay the deposit, the slot remains available to other clients. If another client pays the deposit first, the appointment will be given to them.</p>
            <p style={{ fontSize: '16px' }}>Please do not assume that a time is booked until you have received confirmation of your paid deposit.</p>
          </section>

          <section>
            <h3>4. Booking Deposit</h3>
            <p style={{ fontSize: '16px' }}>Once approved, your slot is held for 30 minutes while you pay the GH₵100 reservation fee. If payment is not received in that time, the slot is released. The reservation fee is non-refundable.</p>
            <p style={{ fontSize: '16px' }}>Once paid, the deposit secures your appointment and is not refundable if you change your mind, fail to attend, or are unable to make your appointment, subject to any applicable rescheduling terms.</p>
          </section>

          <section>
            <h3>5. Late Arrivals</h3>
            <p style={{ fontSize: '16px' }}>Please arrive on time for your appointment.</p>
            <p style={{ fontSize: '16px' }}>A 15-minute grace period is allowed only when you communicate with me regarding your delay.</p>
            <p style={{ fontSize: '16px' }}>Arriving 15 minutes late without prior communication will result in your appointment being cancelled, and your booking deposit will not be refunded.</p>
            <p style={{ fontSize: '16px' }}>Please understand that lateness can affect the appointments scheduled after yours, so punctuality is important.</p>
          </section>

          <section>
            <h3>6. Availability &amp; Slot Releases</h3>
            <p style={{ fontSize: '16px' }}>Appointments may be released in limited batches, including weekly slot releases, to avoid overbooking and to ensure enough time is available for each client.</p>
            <p style={{ fontSize: '16px' }}>Available appointments will be communicated through the booking process.</p>
            <p style={{ fontSize: '16px' }}>Slots are offered on a first-paid, first-confirmed basis. Simply requesting a date or receiving an available time does not guarantee the appointment.</p>
          </section>

          <section>
            <h3>7. Acceptance of Terms &amp; Conditions</h3>
            <p style={{ fontSize: '16px' }}>By proceeding with your booking and paying your deposit, you confirm that you have read, understood, and accepted these terms and conditions.</p>
            <p style={{ fontSize: '16px' }}>You also confirm that the information you provided during your consultation is accurate and complete.</p>
            <p style={{ fontSize: '16px' }}>Failure to disclose relevant information when asked may affect your eligibility for the service and may result in your appointment being refused, postponed, or cancelled.</p>
            <p style={{ fontSize: '16px' }}>By booking with me, you acknowledge and accept responsibility for providing accurate information necessary to determine whether the service is suitable for you.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid #d9c9b3', marginTop: '2rem' }}>BOOKING PROCESS</h2>
            <p style={{ fontSize: '16px' }}>Consultation → Brow/Skin Assessment → Approval → Available Slot Offered → Deposit Paid → Appointment Confirmed</p>
          </section>

          <section>
            <p style={{ fontSize: '16px' }}>Thank you for respecting these policies. They are in place to protect the health of your brows and skin, maintain a smooth booking process, and ensure fairness to all clients.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid #d9c9b3', marginTop: '2rem' }}>HYBRID TINT PRE-APPOINTMENT GUIDE</h2>
            <p style={{ fontSize: '16px' }}>Please review this checklist before booking your appointment to ensure safe application and the best results.</p>
          </section>

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
            <p style={{ fontSize: '16px' }}>
              Hybrid tint stains both hair and skin. Certain conditions may cause irritation, uneven results, or over-processing.
            </p>
          </section>

          <section>
            <h3>Pre-Appointment Prep (48&ndash;72 hours before)</h3>
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

          <section>
            <h3>Consent</h3>
            <p style={{ fontSize: '16px' }}>
              By booking, you confirm you have read and understood this guide and disclosed relevant conditions.
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
