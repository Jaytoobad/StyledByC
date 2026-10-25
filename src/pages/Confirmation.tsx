import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Check } from 'lucide-react';
import { services } from '../config';
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
};

const getBookings = (): LocalBooking[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
};

const serviceName = (id: string) =>
  services.find((s) => s.id === id)?.name || id;

export function Confirmation() {
  useEffect(() => {
    document.title = 'Booking confirmation — StyledByC';
  }, []);
  const navigate = useNavigate();
  const bookings = getBookings();
  const latest = bookings[0] || null;

  if (!latest) {
    return (
      <main className="confirmation" id="content">
        <div className="container">
          <div className="confirmation-card">
            <div className="confirmation-icon">
              <Check size={28} />
            </div>
            <h1>No booking found.</h1>
            <p>
              There are no recent bookings in this browser. Start a new
              booking below.
            </p>
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
  return (
    <main className="confirmation" id="content">
      <div className="container">
        <div className="confirmation-card">
          <div className="confirmation-icon">
            <Check size={28} />
          </div>
          <h1>Request received.</h1>
          <p>
            Your booking request has been sent to the studio. It is now pending
            review. You will be notified once the artist has reviewed your
            request.
          </p>
          <div className="confirmation-details">
            <dt>Reference</dt>
            <dd>{latest.ref}</dd>
            <dt>Service</dt>
            <dd>{serviceName(latest.serviceId)}</dd>
            <dt>Date &amp; time</dt>
            <dd>{dateLabel(latest.date)} &middot; {timeLabel(latest.time)}</dd>
            <dt>Status</dt>
            <dd>{latest.status}</dd>
          </div>
          <p style={{ marginTop: 24, fontSize: 14, color: 'var(--sb-grey)' }}>
            No payment has been taken. Do not send money until the artist
            confirms your appointment.
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
              onClick={(e) => {
                e.preventDefault();
                navigate('/guide');
              }}
              className="btn-link"
            >
              Read the pre-appointment guide
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
