import { useEffect, useMemo, useState } from 'react';
import { adminApproveBooking, adminCancelBooking, adminListBookings, adminRejectBooking, type AdminBooking } from '../../lib/api';

const TOKEN_KEY = 'styledbyc-admin-token';

const ACCRA_TZ = 'Africa/Accra';

function looksLikeRawDate(s: unknown): boolean {
  if (typeof s !== 'string') return false;
  return /GMT|Greenwich|1899|Date/i.test(s);
}
function formatAccraDate(s: unknown): string {
  if (s == null) return '';
  const t = String(s).trim();
  if (!t) return '';
  if (!looksLikeRawDate(t) && !/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = new Date(t);
  if (isNaN(d.getTime())) return t;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: ACCRA_TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(d);
  const g = (p: Intl.DateTimeFormatPartTypes) => parts.find(x => x.type === p)?.value ?? '';
  return `${g('weekday')} ${g('day')} ${g('month')} ${g('year')}`;
}
function formatAccraTime(s: unknown): string {
  if (s == null) return '';
  const t = String(s).trim();
  if (!t) return '';
  if (!looksLikeRawDate(t) && !/^\d{1,2}:\d{2}$/.test(t)) return t;
  const d = new Date(t);
  if (isNaN(d.getTime())) return t;
  return new Intl.DateTimeFormat('en-GB', { timeZone: ACCRA_TZ, hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
}
function sanitizeBooking(b: AdminBooking): AdminBooking {
  return { ...b, date: formatAccraDate(b.date), time: formatAccraTime(b.time), createdAt: formatAccraDate(b.createdAt) };
}
function priceText(p: any) {
  if (p === null || p === undefined || p === '' || isNaN(Number(p))) return '-';
  return `GH₵${Number(p).toFixed(2)}`;
}
function dash(v: any) { const t = String(v ?? '').trim(); return t ? t : '-'; }

// Small pagination helper kept separate so it can be swapped to server-side later.
// To switch to server-side: replace the in-memory `paginate` call with a fetch
// that passes page/pageSize/search/filter/sort to the API and stores total count.
function paginate<T>(items: T[], page: number, pageSize: number): { pageItems: T[]; totalPages: number; start: number; end: number } {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(Math.max(1, page), totalPages);
  const start = (p - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  return { pageItems: items.slice(start, end), totalPages, start, end };
}

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useState<string>(() => { try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } });
  const [showToken, setShowToken] = useState(false);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [actioning, setActioning] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ ref: string; kind: 'reject' | 'cancel' } | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState<number>(() => {
    const p = new URLSearchParams(window.location.search).get('page');
    const n = p ? parseInt(p, 10) : 1;
    return isNaN(n) || n < 1 ? 1 : n;
  });
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('page', String(page));
    window.history.replaceState({}, '', url.toString());
  }, [page]);

  async function load() {
    if (!token.trim()) { setError('Enter admin token'); return; }
    try { sessionStorage.setItem(TOKEN_KEY, token.trim()); } catch {}
    setLoading(true); setError('');
    const res = await adminListBookings(token.trim());
    setLoading(false);
    if (!res.ok) { setError(res.error || 'Failed to load'); setBookings([]); return; }
    const rows = (res.rows || []).map(sanitizeBooking);
    setBookings(rows);
    setLastUpdated(new Date().toLocaleString());
  }

  useEffect(() => { if (token.trim()) load(); /* eslint-disable-next-line */ }, []);

  async function act(ref: string, kind: 'approve' | 'reject' | 'cancel') {
    setActioning(ref + kind); setError('');
    let res: any;
    if (kind === 'approve') res = await adminApproveBooking(token.trim(), ref);
    else if (kind === 'reject') res = await adminRejectBooking(token.trim(), ref);
    else res = await adminCancelBooking(token.trim(), ref);
    setActioning(null);
    if (!res.ok) { setError(res.error || 'Action failed'); return; }
    setBookings(prev => prev.map(b => b.ref === ref ? { ...b, status: res.status || (kind === 'approve' ? 'Approved' : kind === 'reject' ? 'Rejected' : 'Cancelled') } : b));
    setToast(`Booking ${kind === 'approve' ? 'approved' : kind === 'reject' ? 'rejected' : 'cancelled'}`);
    setTimeout(() => setToast(''), 2500);
  }

  const filteredSorted = useMemo(() => {
    let arr = bookings.filter(b => {
      const q = search.trim().toLowerCase();
      if (q && !(String(b.ref || '').toLowerCase().includes(q) || String(b.name || '').toLowerCase().includes(q) || String(b.email || '').toLowerCase().includes(q) || String(b.phone || '').toLowerCase().includes(q))) return false;
      if (statusFilter !== 'all' && String(b.status || '').toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (paymentFilter !== 'all' && String(b.paymentStatus || '').toLowerCase() !== paymentFilter.toLowerCase()) return false;
      return true;
    });
    arr = arr.slice().sort((a, b) => {
      if (sort === 'oldest') return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
      if (sort === 'appointment') return String(a.date || '').localeCompare(String(b.date || ''));
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
    return arr;
  }, [bookings, search, statusFilter, paymentFilter, sort]);

  // reset to page 1 when filters/search/sort/pageSize change
  useEffect(() => { setPage(1); }, [search, statusFilter, paymentFilter, sort, pageSize]);

  const { pageItems, totalPages, start, end } = paginate(filteredSorted, page, pageSize);

  const statusColor = (s: string) => {
    const l = (s || '').toLowerCase();
    if (l.includes('pending')) return 'bg-amber-100 text-amber-900';
    if (l.includes('approved')) return 'bg-green-100 text-green-900';
    if (l.includes('rejected')) return 'bg-red-100 text-red-900';
    if (l.includes('cancelled')) return 'bg-gray-200 text-gray-800';
    return 'bg-gray-100 text-gray-800';
  };
  const paymentColor = (s: string) => {
    const l = (s || '').toLowerCase();
    if (l.includes('paid')) return 'bg-green-100 text-green-900';
    return 'bg-orange-100 text-orange-900';
  };

  const clearFilters = () => { setSearch(''); setStatusFilter('all'); setPaymentFilter('all'); setSort('newest'); };

  const summary = {
    total: bookings.length,
    pending: bookings.filter(b => String(b.status).toLowerCase().includes('pending')).length,
    approved: bookings.filter(b => String(b.status).toLowerCase().includes('approved')).length,
    rejectedCancelled: bookings.filter(b => { const l = String(b.status).toLowerCase(); return l.includes('rejected') || l.includes('cancelled'); }).length,
  };

  if (!token.trim()) {
    return (
      <div className="max-w-[1200px] mx-auto px-5 md:px-8 py-12" style={{ fontFamily: 'var(--sb-sans)' }}>
        <div className="max-w-md mx-auto bg-white rounded-xl border border-[var(--sb-border)] p-8 shadow-sm">
          <h1 className="text-2xl mb-1" style={{ fontFamily: 'var(--sb-serif)' }}>Booking Admin</h1>
          <p className="text-sm text-[var(--sb-grey)] mb-6">Enter your admin token to continue.</p>
          <div className="relative">
            <input type={showToken ? 'text' : 'password'} value={token} onChange={e => setToken(e.target.value)} placeholder="Admin token" className="w-full h-11 px-3 pr-10 rounded border border-[var(--sb-border)] focus:outline-none focus:ring-2 focus:ring-[var(--sb-accent)]" />
            <button type="button" onClick={() => setShowToken(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--sb-grey)]" aria-label="Toggle token visibility">
              {showToken ? 'Hide' : 'Show'}
            </button>
          </div>
          {error && <div className="mt-3 px-3 py-2 rounded bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
          <button onClick={load} disabled={loading} className="mt-4 w-full h-11 rounded bg-[var(--sb-black)] text-white font-medium hover:opacity-90 disabled:opacity-50">
            {loading ? 'Loading...' : 'Load bookings'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-8 py-8 space-y-6" style={{ fontFamily: 'var(--sb-sans)' }}>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl" style={{ fontFamily: 'var(--sb-serif)' }}>Booking Admin</h1>
          <div className="w-12 h-0.5 mt-2" style={{ background: 'var(--sb-accent)' }} />
          <p className="text-sm text-[var(--sb-grey)] mt-2">Approve, reject, or cancel bookings.</p>
        </div>
        <button onClick={onClose} className="px-3 py-1.5 rounded border border-[var(--sb-border)] hover:bg-[var(--sb-ivory)]">Close</button>
      </header>

      {/* summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total bookings', value: summary.total },
          { label: 'Pending', value: summary.pending },
          { label: 'Approved', value: summary.approved },
          { label: 'Rejected/Cancelled', value: summary.rejectedCancelled },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-[var(--sb-border)] p-4">
            <div className="text-sm text-[var(--sb-grey)]">{c.label}</div>
            <div className="text-2xl font-semibold mt-1">{c.value}</div>
          </div>
        ))}
      </div>

      {/* toolbar */}
      <div className="bg-white rounded-xl border border-[var(--sb-border)] p-4 flex flex-wrap gap-3 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, phone or ref" className="flex-1 min-w-[180px] h-10 px-3 rounded border border-[var(--sb-border)] focus:outline-none focus:ring-2 focus:ring-[var(--sb-accent)]" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-10 px-3 rounded border border-[var(--sb-border)]">
          <option value="all">All statuses</option>
          <option value="Pending Approval">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className="h-10 px-3 rounded border border-[var(--sb-border)]">
          <option value="all">All payments</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)} className="h-10 px-3 rounded border border-[var(--sb-border)]">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="appointment">Appointment date</option>
        </select>
        <button onClick={clearFilters} className="text-sm text-[var(--sb-accent)] hover:underline">Clear filters</button>
        <button onClick={load} disabled={loading} className="h-10 px-4 rounded bg-[var(--sb-black)] text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2">
          {loading && <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          Refresh
        </button>
      </div>

      {error && <div className="px-4 py-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between"><span>{error}</span><button onClick={load} className="underline">Retry</button></div>}
      {toast && <div className="fixed bottom-4 right-4 bg-[var(--sb-black)] text-white px-4 py-2 rounded shadow">{toast}</div>}

      {/* list */}
      <div className="bg-white rounded-xl border border-[var(--sb-border)] overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 bg-[var(--sb-ivory)] rounded animate-pulse" />)}</div>
        ) : pageItems.length === 0 ? (
          <div className="p-12 text-center text-[var(--sb-grey)]">
            <p className="mb-3">{bookings.length === 0 ? 'No bookings yet' : 'No bookings match your filters'}</p>
            {bookings.length > 0 && <button onClick={clearFilters} className="text-[var(--sb-accent)] hover:underline">Clear filters</button>}
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white border-b border-[var(--sb-border)]">
                  <tr>
                    {['Ref', 'Customer', 'Service', 'Date & Time', 'Price', 'Payment', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left py-3 px-4 font-medium text-[var(--sb-grey)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(b => (
                    <tr key={b.ref} className="border-b border-[var(--sb-border)] hover:bg-[var(--sb-ivory)]">
                      <td className="py-3 px-4 font-mono text-xs">{dash(b.ref)}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{dash(b.name)}</div>
                        <div className="text-xs text-[var(--sb-grey)]">{dash(b.email)}</div>
                        <div className="text-xs text-[var(--sb-grey)]">{dash(b.phone)}</div>
                      </td>
                      <td className="py-3 px-4">{dash(b.service)}</td>
                      <td className="py-3 px-4">
                        <div>{dash(b.date)}</div>
                        <div className="text-xs text-[var(--sb-grey)]">{dash(b.time)}</div>
                      </td>
                      <td className="py-3 px-4">{priceText(b.price)}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${paymentColor(b.paymentStatus || '')}`}>{dash(b.paymentStatus)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor(b.status)}`}>{dash(b.status)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button disabled={String(b.status).toLowerCase().includes('approved') || !!actioning} onClick={() => act(b.ref, 'approve')} className="px-3 py-1 text-xs rounded bg-[var(--sb-black)] text-white disabled:opacity-40 flex items-center gap-1">
                            {actioning === b.ref + 'approve' && <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                            Approve
                          </button>
                          <button disabled={String(b.status).toLowerCase().includes('rejected') || !!actioning} onClick={() => setConfirm({ ref: b.ref, kind: 'reject' })} className="px-3 py-1 text-xs rounded border border-[var(--sb-border)] text-[var(--sb-black)] disabled:opacity-40 flex items-center gap-1">
                            {actioning === b.ref + 'reject' && <span className="inline-block w-3 h-3 border-2 border-[var(--sb-black)] border-t-transparent rounded-full animate-spin" />}
                            Reject
                          </button>
                          <button disabled={String(b.status).toLowerCase().includes('cancelled') || !!actioning} onClick={() => setConfirm({ ref: b.ref, kind: 'cancel' })} className="px-3 py-1 text-xs rounded border border-[var(--sb-border)] text-[var(--sb-grey)] disabled:opacity-40 flex items-center gap-1">
                            {actioning === b.ref + 'cancel' && <span className="inline-block w-3 h-3 border-2 border-[var(--sb-grey)] border-t-transparent rounded-full animate-spin" />}
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden space-y-3 p-4">
              {pageItems.map(b => (
                <div key={b.ref} className="border border-[var(--sb-border)] rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-xs">{dash(b.ref)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor(b.status)}`}>{dash(b.status)}</span>
                  </div>
                  <div className="font-medium">{dash(b.name)}</div>
                  <div className="text-xs text-[var(--sb-grey)]">{dash(b.email)} · {dash(b.phone)}</div>
                  <div className="text-xs">{dash(b.service)} · {dash(b.date)} {dash(b.time)} · {priceText(b.price)}</div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${paymentColor(b.paymentStatus || '')}`}>{dash(b.paymentStatus)}</span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button disabled={String(b.status).toLowerCase().includes('approved') || !!actioning} onClick={() => act(b.ref, 'approve')} className="flex-1 py-2 text-xs rounded bg-[var(--sb-black)] text-white disabled:opacity-40">Approve</button>
                    <button disabled={String(b.status).toLowerCase().includes('rejected') || !!actioning} onClick={() => setConfirm({ ref: b.ref, kind: 'reject' })} className="flex-1 py-2 text-xs rounded border border-[var(--sb-border)] disabled:opacity-40">Reject</button>
                    <button disabled={String(b.status).toLowerCase().includes('cancelled') || !!actioning} onClick={() => setConfirm({ ref: b.ref, kind: 'cancel' })} className="flex-1 py-2 text-xs rounded border border-[var(--sb-border)] text-[var(--sb-grey)] disabled:opacity-40">Cancel</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* pagination */}
      {!loading && filteredSorted.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="text-[var(--sb-grey)]">Showing {start + 1}-{end} of {filteredSorted.length} bookings</div>
          <div className="flex items-center gap-2">
            <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className="h-9 px-2 rounded border border-[var(--sb-border)]">
              {[10, 25, 50].map(n => <option key={n} value={n}>{n} / page</option>)}
            </select>
            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-3 py-1.5 rounded border border-[var(--sb-border)] disabled:opacity-40" aria-label="Previous page">Prev</button>
            {Array.from({ length: totalPages }).map((_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1).map((p, idx, arr) => (
              <span key={p} className="flex items-center gap-1">
                {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-[var(--sb-grey)]">…</span>}
                <button onClick={() => setPage(p)} aria-current={p === page ? 'page' : undefined} aria-label={`Page ${p}`} className={`px-3 py-1.5 rounded border ${p === page ? 'bg-[var(--sb-black)] text-white border-[var(--sb-black)]' : 'border-[var(--sb-border)]'}`}>{p}</button>
              </span>
            ))}
            <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="px-3 py-1.5 rounded border border-[var(--sb-border)] disabled:opacity-40" aria-label="Next page">Next</button>
          </div>
        </div>
      )}

      <div className="text-xs text-[var(--sb-grey)] flex items-center justify-between">
        <span>Last updated: {lastUpdated || '-'}</span>
        {bookings.length > 500 && <span>Older bookings may load slower.</span>}
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl border border-[var(--sb-border)] p-6 max-w-sm w-full">
            <h3 className="text-lg mb-2" style={{ fontFamily: 'var(--sb-serif)' }}>Confirm {confirm.kind}</h3>
            <p className="text-sm text-[var(--sb-grey)] mb-4">Are you sure you want to {confirm.kind} booking {confirm.ref}?</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirm(null)} className="px-3 py-1.5 rounded border border-[var(--sb-border)]">Cancel</button>
              <button onClick={() => { const c = confirm; setConfirm(null); act(c.ref, c.kind); }} className="px-3 py-1.5 rounded bg-[var(--sb-black)] text-white">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
