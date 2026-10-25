import { useEffect, useState } from 'react';
import { adminApproveBooking, adminCancelBooking, adminListBookings, adminRejectBooking, type AdminBooking } from '../../lib/api';

const TOKEN_KEY = 'styledbyc-admin-token';

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useState<string>(() => {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
  });
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actioning, setActioning] = useState<string | null>(null);

  async function load() {
    if (!token.trim()) { setError('Enter admin token'); return; }
    try { localStorage.setItem(TOKEN_KEY, token.trim()); } catch {}
    setLoading(true); setError(''); setSuccess('');
    const res = await adminListBookings(token.trim());
    setLoading(false);
    if (!res.ok) { setError(res.error || 'Failed to load'); setBookings([]); return; }
    setBookings((res.rows || []).slice().sort((a,b) => String(b.createdAt||'').localeCompare(String(a.createdAt||''))));
  }

  useEffect(() => { if (token.trim()) load(); }, []);

  async function act(ref: string, kind: 'approve'|'reject'|'cancel') {
    setActioning(ref + kind); setError(''); setSuccess('');
    let res: any;
    if (kind === 'approve') res = await adminApproveBooking(token.trim(), ref);
    else if (kind === 'reject') res = await adminRejectBooking(token.trim(), ref);
    else res = await adminCancelBooking(token.trim(), ref);
    setActioning(null);
    if (!res.ok) { setError(res.error || 'Action failed'); return; }
    setSuccess(`${kind} succeeded for ${ref}`);
    await load();
  }

  const statusColor = (s: string) => {
    const l = s.toLowerCase();
    if (l.includes('pending')) return 'bg-amber-100 text-amber-800';
    if (l.includes('approved')) return 'bg-green-100 text-green-800';
    if (l.includes('rejected')) return 'bg-red-100 text-red-800';
    if (l.includes('cancelled')) return 'bg-gray-200 text-gray-700';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[1100px] bg-white rounded-xl border border-gray-200 shadow-xl max-h-[90vh] overflow-auto">
        <header className="flex items-center justify-between px-5 md:px-8 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-semibold">Booking Admin</h2>
            <p className="text-sm text-gray-500">Approve, reject, or cancel bookings</p>
          </div>
          <button className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50" onClick={onClose}>Close</button>
        </header>
        <div className="px-5 md:px-8 py-4 flex gap-2">
          <input className="flex-1 h-10 px-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Admin token" value={token} onChange={(e)=>setToken(e.target.value)} type="password" />
          <button className="h-10 px-5 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50" onClick={load} disabled={loading}>{loading ? 'Loading...' : 'Load'}</button>
        </div>
        {error && <div className="mx-5 md:mx-8 mb-3 px-4 py-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
        {success && <div className="mx-5 md:mx-8 mb-3 px-4 py-3 rounded bg-green-50 border border-green-200 text-green-700 text-sm">{success}</div>}
        <div className="px-5 md:px-8 pb-6">
          <div className="hidden md:block overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-gray-200">
                  {['Ref','Created','Name','Contact','Service','Date','Time','Price','Status','Actions'].map(h => <th key={h} className="text-left py-2 px-2 font-medium text-gray-600">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {bookings.map(b => (
                  <tr key={b.ref} className="border-b border-gray-100">
                    <td className="py-2 px-2 font-mono text-xs">{b.ref}</td>
                    <td className="py-2 px-2">{b.createdAt ? new Date(b.createdAt).toLocaleString() : '-'}</td>
                    <td className="py-2 px-2">{b.name}</td>
                    <td className="py-2 px-2">{b.email}<br/>{b.phone}</td>
                    <td className="py-2 px-2">{b.service}</td>
                    <td className="py-2 px-2">{b.date}</td>
                    <td className="py-2 px-2">{b.time}</td>
                    <td className="py-2 px-2">GH₵{b.price}</td>
                    <td className="py-2 px-2"><span className={`px-2 py-0.5 rounded text-xs ${statusColor(b.status)}`}>{b.status}</span></td>
                    <td className="py-2 px-2 flex gap-1">
                      <button className="px-2 py-1 text-xs rounded bg-green-600 text-white disabled:opacity-40" disabled={b.status==='Approved' || !!actioning} onClick={()=>act(b.ref,'approve')}>Approve</button>
                      <button className="px-2 py-1 text-xs rounded bg-red-600 text-white disabled:opacity-40" disabled={b.status==='Rejected' || !!actioning} onClick={()=>act(b.ref,'reject')}>Reject</button>
                      <button className="px-2 py-1 text-xs rounded bg-gray-600 text-white disabled:opacity-40" disabled={b.status==='Cancelled' || !!actioning} onClick={()=>act(b.ref,'cancel')}>Cancel</button>
                    </td>
                  </tr>
                ))}
                {bookings.length === 0 && !loading && <tr><td colSpan={10} className="py-4 text-center text-gray-400">No bookings</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="md:hidden space-y-3">
            {bookings.map(b => (
              <div key={b.ref} className="border border-gray-200 rounded-lg p-3 space-y-1">
                <div className="flex justify-between"><span className="font-mono text-xs">{b.ref}</span><span className={`px-2 py-0.5 rounded text-xs ${statusColor(b.status)}`}>{b.status}</span></div>
                <div className="text-sm font-medium">{b.name}</div>
                <div className="text-xs text-gray-500">{b.email} · {b.phone}</div>
                <div className="text-xs">{b.service} · {b.date} {b.time} · GH₵{b.price}</div>
                <div className="flex gap-1 pt-1">
                  <button className="px-2 py-1 text-xs rounded bg-green-600 text-white" onClick={()=>act(b.ref,'approve')}>Approve</button>
                  <button className="px-2 py-1 text-xs rounded bg-red-600 text-white" onClick={()=>act(b.ref,'reject')}>Reject</button>
                  <button className="px-2 py-1 text-xs rounded bg-gray-600 text-white" onClick={()=>act(b.ref,'cancel')}>Cancel</button>
                </div>
              </div>
            ))}
            {bookings.length === 0 && !loading && <div className="text-center text-gray-400 py-4">No bookings</div>}
          </div>
        </div>
      </div>
    </div>
  );
}