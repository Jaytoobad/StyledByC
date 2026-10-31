import React from 'react';
import { Link } from 'react-router-dom';

export interface AdminOverviewProps {
  stats: any;
  bookings: any[];
}

export function AdminOverview({ stats, bookings }: AdminOverviewProps) {
  const recent = bookings.slice(0, 5);
  const upcoming = bookings.filter(b => !['rejected','cancelled','expired'].includes(String(b.status).toLowerCase())).slice(0, 5);
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="summary-grid">
        <div className="card summary-card summary-card-default"><div className="summary-label">Total bookings</div><div className="summary-value">{stats?.total ?? bookings.length}</div></div>
        <div className="card summary-card summary-card-pending"><div className="summary-label">Pending</div><div className="summary-value">{stats?.pendingApproval ?? bookings.filter(b=>String(b.status).toLowerCase().includes('pending')).length}</div></div>
        <div className="card summary-card summary-card-approved"><div className="summary-label">Confirmed</div><div className="summary-value">{stats?.confirmed ?? 0}</div></div>
        <div className="card summary-card summary-card-default"><div className="summary-label">Completed</div><div className="summary-value">{stats?.completed ?? 0}</div></div>
      </div>
      <div className="card admin-card" style={{ padding: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontFamily: 'var(--sb-serif)' }}>Revenue</h2>
        <p style={{ margin: 4, fontSize: 13, color: 'var(--sb-grey)' }}>Reservation fees collected: {stats?.reservationFeesCollected ?? 0}</p>
      </div>
      <div className="card admin-card" style={{ padding: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontFamily: 'var(--sb-serif)' }}>Recent bookings</h2>
        {recent.map(b => <div key={b.ref} style={{ borderBottom: '1px solid var(--sb-border)', padding: '8px 0' }}>{b.name} - {b.service} - {b.date}</div>)}
        {recent.length === 0 && <div>No recent bookings.</div>}
      </div>
      <div className="card admin-card" style={{ padding: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontFamily: 'var(--sb-serif)' }}>Upcoming appointments</h2>
        {upcoming.map(b => <div key={b.ref} style={{ borderBottom: '1px solid var(--sb-border)', padding: '8px 0' }}>{b.name} - {b.service} - {b.date} {b.time}</div>)}
        {upcoming.length === 0 && <div>No upcoming appointments.</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link to="/admin/bookings" className="btn btn-primary">Manage bookings</Link>
        <Link to="/admin/services" className="btn btn-secondary">Manage services</Link>
        <Link to="/admin/payments" className="btn btn-secondary">View payments</Link>
      </div>
    </div>
  );
}
export default AdminOverview;