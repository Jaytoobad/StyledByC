import { useEffect, useState } from 'react';
import { adminApproveBooking, adminCancelBooking, adminListBookings, adminRejectBooking, type AdminBooking } from '../../lib/api';

const TOKEN_KEY = 'styledbyc-admin-token';

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useState<string>(() => {
    try {
      return localStorage.getItem(TOKEN_KEY) || '';
    } catch {
      return '';
    }
  });
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actioning, setActioning] = useState<string | null>(null);

  async function load() {
    if (!token.trim()) {
      setError('Enter admin token');
      return;
    }
    try {
      localStorage.setItem(TOKEN_KEY, token.trim());
    } catch {}
    setLoading(true);
    setError('');
    const res = await adminListBookings(token.trim());
    setLoading(false);
    if (!res.ok) {
      setError(res.error || 'Failed to load');
      setBookings([]);
      return;
    }
    setBookings((res.rows || []).slice().sort((a,b) => String(b.createdAt||'').localeCompare(String(a.createdAt||''))));
  }

  useEffect(() => {
    if (token.trim()) load();
  }, []);

  async function act(ref: string, kind: 'approve'|'reject'|'cancel') {
    setActioning(ref + kind);
    setError('');
    let res: any;
    if (kind === 'approve') res = await adminApproveBooking(token.trim(), ref);
    else if (kind === 'reject') res = await adminRejectBooking(token.trim(), ref);
    else res = await adminCancelBooking(token.trim(), ref);
    setActioning(null);
    if (!res.ok) {
      setError(res.error || 'Action failed');
      return;
    }
    await load();
  }

  return (
    <div className="admin-overlay" role="dialog" aria-modal="true">
      <div className="admin-modal">
        <header className="admin-header">
          <div>
            <h2>Booking Admin</h2>
            <p>Approve, reject, or cancel bookings</p>
          </div>
          <button className="btn outline" onClick={onClose}>Close</button>
        </header>
        <div className="admin-toolbar">
          <input className="admin-input" placeholder="Admin token" value={token} onChange={(e)=>setToken(e.target.value)} type="password" />
          <button className="btn" onClick={load} disabled={loading}>{loading ? 'Loading...' : 'Load'}</button>
        </div>
        {error && <div className="admin-error">{error}</div>}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Created</th>
                <th>Name</th>
                <th>Contact</th>
                <th>Service</th>
                <th>Date</th>
                <th>Time</th>
                <th>Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.ref}>
                  <td className="mono">{b.ref}</td>
                  <td>{b.createdAt ? new Date(b.createdAt).toLocaleString() : '-'}</td>
                  <td>{b.name}</td>
                  <td>{b.email}<br/>{b.phone}</td>
                  <td>{b.service}</td>
                  <td>{b.date}</td>
                  <td>{b.time}</td>
                  <td>GH₵{b.price}</td>
                  <td><span className={status }>{b.status}</span></td>
                  <td className="actions">
                    <button className="btn sm" disabled={b.status==='Approved' || !!actioning} onClick={()=>act(b.ref,'approve')}>Approve</button>
                    <button className="btn sm outline" disabled={b.status==='Rejected' || !!actioning} onClick={()=>act(b.ref,'reject')}>Reject</button>
                    <button className="btn sm ghost" disabled={b.status==='Cancelled' || !!actioning} onClick={()=>act(b.ref,'cancel')}>Cancel</button>
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && !loading && <tr><td colSpan={10} className="empty">No bookings</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
