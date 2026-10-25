import { useState } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Check } from 'lucide-react';
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

export function MyBookings() {
  useEffect(() => {
    document.title = 'My bookings — StyledByC';
  }, []);
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<LocalBooking[]>(getBookings);

  const clear = () => {
    localStorage.removeItem(KEY);
    setBookings([]);
  };

  return (
    <main className="bookings" id="content">
      <div className="container">
        <div className="bookings-header">
          <div className="section-head">
            <div className="eyebrow">My bookings</div>
            <h1>Your bookings, <em>at a glance.</em></h1>
            <p>
              Requests you submitted from this browser appear here for your
              reference. This is a local record — it is not the studio&rsquo;s
              admin system.
            </p>
          </div>
          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={clear}
              disabled={bookings.length === 0}
            >
              Clear local data
            </button>
          </div>
        </div>

        {bookings.length ? (
          bookings.map((b) => (
            <div key={b.ref} className="booking-row">
              <div className="ref">{b.ref}</div>
              <div className="info">
                <b>{serviceName(b.serviceId)}</b>
                <small>
                  {b.name} &middot; {dateLabel(b.date)} &middot;
                  {timeLabel(b.time)}
                </small>
                <small>{b.email} &middot; {money(b.fee)}</small>
              </div>
              <span className="status">{b.status}</span>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <CalendarDays size={34} />
            <h3>No bookings yet</h3>
            <p>
              Requests you submit from this browser appear here for your
              reference.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/book')}
            >
              Book an appointment
            </button>
          </div>
        )}

        <div className="policy-notice" style={{ marginTop: 24 }}>
          <Check size={16} />
          <p style={{ display: 'inline', fontSize: 14, color: '#6d665e' }}>
            The studio reviews every request before confirming an appointment.
            This page only shows what you submitted from this browser.
          </p>
        </div>
      </div>
    </main>
  );
}
