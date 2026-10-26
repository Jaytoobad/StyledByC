import { useEffect, useMemo, useState } from 'react';
import { Search, FileText } from 'lucide-react';
import { adminApproveBooking, adminCancelBooking, adminListBookings, adminRejectBooking, type AdminBooking } from '../../lib/api';

const TOKEN_KEY = 'styledbyc-admin-token';

const ACCRA_TZ = 'Africa/Accra';

const DEMO_BOOKINGS: AdminBooking[] = Array.from({ length: 27 }).map((_, i) => {
  const services = ['Brow Shaping', 'Lash Lift', 'Brow Tint', 'Laminate & Tint', 'HD Brows'];
  const statuses = ['Pending Approval', 'Approved', 'Rejected', 'Cancelled'];
  const payments = ['paid', 'unpaid'];
  const names = ['Ama Mensah', 'Kojo Boateng', 'Efua Owusu', 'Nana Adjei', 'Akua Osei', 'Kwame Asante', 'Adwoa Nyarko', 'Kofi Amankwah'];
  const date = new Date(Date.now() - (i * 86400000));
  const dateStr = date.toISOString().slice(0, 10);
  const time = ['09:00', '10:30', '12:00', '13:30', '15:00'][i % 5];
  return {
    ref: `SB-${String(1000 + i).padStart(4, '0')}`,
    name: names[i % names.length],
    email: `customer${i + 1}@example.com`,
    phone: `+233 20 ${String(1000000 + i).slice(-7)}`,
    service: services[i % services.length],
    date: dateStr,
    time,
    price: [45, 65, 35, 75, 85][i % 5],
    status: statuses[i % statuses.length],
    paymentStatus: payments[i % payments.length],
    createdAt: dateStr,
  };
});

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

  useEffect(() => {
    if (import.meta.env.DEV && !token.trim()) {
      const rows = DEMO_BOOKINGS.map(sanitizeBooking);
      setBookings(rows);
      setLastUpdated(new Date().toLocaleString());
      setToken('demo');
      return;
    }
    if (token.trim()) load();
    /* eslint-disable-next-line */
  }, []);

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
    if (l.includes('pending')) return 'admin-badge-pending';
    if (l.includes('approved')) return 'admin-badge-approved';
    if (l.includes('rejected')) return 'admin-badge-rejected';
    if (l.includes('cancelled')) return 'admin-badge-cancelled';
    return 'admin-badge-default';
  };
  const paymentColor = (s: string) => {
    const l = (s || '').toLowerCase();
    if (l.includes('paid')) return 'admin-badge-paid';
    return 'admin-badge-unpaid';
  };

  const clearFilters = () => { setSearch(''); setStatusFilter('all'); setPaymentFilter('all'); setSort('newest'); };

  const summary = {
    total: bookings.length,
    pending: bookings.filter(b => String(b.status).toLowerCase().includes('pending')).length,
    approved: bookings.filter(b => String(b.status).toLowerCase().includes('approved')).length,
    rejectedCancelled: bookings.filter(b => { const l = String(b.status).toLowerCase(); return l.includes('rejected') || l.includes('cancelled'); }).length,
  };

  const summaryTone = (label: string) => {
    if (label === 'Pending') return 'summary-card-pending';
    if (label === 'Approved') return 'summary-card-approved';
    if (label === 'Rejected/Cancelled') return 'summary-card-rejected';
    return 'summary-card-default';
  };

  if (!token.trim()) {
    return (
      <div className="admin-page" style={{ fontFamily: 'var(--sb-sans)' }}>
        <div className="container admin-login">
          <div className="card admin-login-card">
            <h1 className="admin-title">Booking Admin</h1>
            <div className="admin-title-accent" />
            <p className="admin-subtitle">Enter your admin token to continue.</p>
            {error && <div className="admin-error-inline">{error}</div>}
            <div className="admin-token-row">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="Admin token"
                className="admin-input"
              />
              <button
                type="button"
                onClick={() => setShowToken(s => !s)}
                className="admin-toggle"
                aria-label="Toggle token visibility"
              >
                {showToken ? 'Hide' : 'Show'}
              </button>
            </div>
            <button onClick={load} disabled={loading} className="btn btn-primary admin-full-btn">
              {loading ? 'Loading...' : 'Load bookings'}
            </button>
      </div>
    </div>
  );
}

  return (
    <div className="admin-page" style={{ fontFamily: 'var(--sb-sans)' }}>
      <div className="container admin-main">
        <header className="admin-header">
          <div>
            <h1 className="admin-title">Booking Admin</h1>
            <div className="admin-title-accent" />
            <p className="admin-subtitle">Approve, reject, or cancel bookings.</p>
          </div>
          <button onClick={onClose} className="btn btn-secondary admin-close">Close</button>
        </header>

        {/* summary cards */}
        <div className="summary-grid">
          {[
            { label: 'Total bookings', value: summary.total },
            { label: 'Pending', value: summary.pending },
            { label: 'Approved', value: summary.approved },
            { label: 'Rejected/Cancelled', value: summary.rejectedCancelled },
          ].map(c => (
            <div key={c.label} className={`card summary-card ${summaryTone(c.label)}`}>
              <div className="summary-label">{c.label}</div>
              <div className="summary-value">{c.value}</div>
            </div>
          ))}
        </div>

        {/* toolbar */}
        <div className="admin-toolbar">
        <div className="admin-toolbar-row">
          <div className="admin-search-wrap">
            <Search size={18} className="admin-search-icon" aria-hidden="true" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, phone or ref" className="admin-search" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="admin-select">
            <option value="all">All statuses</option>
            <option value="Pending Approval">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className="admin-select">
            <option value="all">All payments</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
          <select value={sort} onChange={e => setSort(e.target.value)} className="admin-select">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="appointment">Appointment date</option>
          </select>
          <button onClick={clearFilters} className="admin-link">Clear filters</button>
          <button onClick={load} disabled={loading} className="admin-refresh">
            {loading && <span className="admin-spinner" />}
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="admin-error"><span>{error}</span><button onClick={load} className="admin-link">Retry</button></div>}
      {toast && <div className="admin-toast">{toast}</div>}

      {/* list */}
      <div className="admin-list">
        {loading ? (
          <div className="admin-skeleton">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="admin-skeleton-row" />)}</div>
        ) : pageItems.length === 0 ? (
          <div className="admin-empty">
            <div className="admin-empty-icon"><FileText size={28} /></div>
            <p className="admin-empty-title">{bookings.length === 0 ? 'No bookings yet' : 'No bookings match your filters'}</p>
            <p className="admin-empty-text">{bookings.length === 0 ? 'Bookings will appear here once they are made.' : 'Try adjusting your search or filters.'}</p>
            {bookings.length > 0 && <button onClick={clearFilters} className="admin-link">Clear filters</button>}
          </div>
        ) : (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th key="Ref" className="admin-th admin-th-ref">Ref</th>
                    <th key="Customer" className="admin-th admin-th-customer">Customer</th>
                    <th key="Service" className="admin-th admin-th-service">Service</th>
                    <th key="Date & Time" className="admin-th admin-th-date">Date &amp; Time</th>
                    <th key="Price" className="admin-th admin-th-price">Price</th>
                    <th key="Payment" className="admin-th admin-th-payment">Payment</th>
                    <th key="Status" className="admin-th admin-th-status">Status</th>
                    <th key="Actions" className="admin-th admin-th-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(b => (
                    <tr key={b.ref} className="admin-tr">
                      <td className="admin-td admin-td-ref admin-td-mono">{dash(b.ref)}</td>
                      <td className="admin-td admin-td-customer">
                        <div className="admin-name">{dash(b.name)}</div>
                        <div className="admin-meta">{dash(b.email)}</div>
                        <div className="admin-meta">{dash(b.phone)}</div>
                      </td>
                      <td className="admin-td admin-td-service">{dash(b.service)}</td>
                      <td className="admin-td admin-td-date">
                        <div className="admin-date-main">{dash(b.date)}</div>
                        <div className="admin-meta">{dash(b.time)}</div>
                      </td>
                      <td className="admin-td admin-td-price">{priceText(b.price)}</td>
                      <td className="admin-td admin-td-payment">
                        <span className={`admin-badge ${paymentColor(b.paymentStatus || '')}`}>{dash(b.paymentStatus)}</span>
                      </td>
                      <td className="admin-td admin-td-status">
                        <span className={`admin-badge ${statusColor(b.status)}`}>{dash(b.status)}</span>
                      </td>
                      <td className="admin-td admin-td-actions">
                        <div className="admin-actions">
                          <button disabled={String(b.status).toLowerCase().includes('approved') || !!actioning} onClick={() => act(b.ref, 'approve')} className="btn btn-primary btn-small admin-action-btn">
                            {actioning === b.ref + 'approve' && <span className="admin-spinner" />}
                            Approve
                          </button>
                          <button disabled={String(b.status).toLowerCase().includes('rejected') || !!actioning} onClick={() => setConfirm({ ref: b.ref, kind: 'reject' })} className="btn btn-secondary btn-small admin-action-btn">
                            {actioning === b.ref + 'reject' && <span className="admin-spinner admin-spinner-dark" />}
                            Reject
                          </button>
                          <button disabled={String(b.status).toLowerCase().includes('cancelled') || !!actioning} onClick={() => setConfirm({ ref: b.ref, kind: 'cancel' })} className="btn btn-secondary btn-small admin-action-btn admin-action-muted">
                            {actioning === b.ref + 'cancel' && <span className="admin-spinner admin-spinner-dark" />}
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="admin-mobile-list">
              {pageItems.map(b => (
                <div key={b.ref} className="admin-mobile-card">
                  <div className="admin-mobile-head">
                    <span className="admin-td-mono">{dash(b.ref)}</span>
                    <span className={`admin-badge ${statusColor(b.status)}`}>{dash(b.status)}</span>
                  </div>
                  <div className="admin-mobile-row">
                    <div className="admin-name">{dash(b.name)}</div>
                    <div className="admin-meta">{dash(b.email)}</div>
                    <div className="admin-meta">{dash(b.phone)}</div>
                  </div>
                  <div className="admin-mobile-row">
                    <div className="admin-meta"><strong>Service:</strong> {dash(b.service)}</div>
                    <div className="admin-meta"><strong>Date:</strong> {dash(b.date)} {dash(b.time)}</div>
                    <div className="admin-meta"><strong>Price:</strong> {priceText(b.price)} · <strong>Payment:</strong> {dash(b.paymentStatus)}</div>
                  </div>
                  <div className="admin-mobile-actions">
                    <button disabled={String(b.status).toLowerCase().includes('approved') || !!actioning} onClick={() => act(b.ref, 'approve')} className="btn btn-primary admin-action-btn">Approve</button>
                    <button disabled={String(b.status).toLowerCase().includes('rejected') || !!actioning} onClick={() => setConfirm({ ref: b.ref, kind: 'reject' })} className="btn btn-secondary admin-action-btn">Reject</button>
                    <button disabled={String(b.status).toLowerCase().includes('cancelled') || !!actioning} onClick={() => setConfirm({ ref: b.ref, kind: 'cancel' })} className="btn btn-secondary admin-action-btn admin-action-muted">Cancel</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* pagination */}
      {!loading && filteredSorted.length > 0 && (
        <div className="admin-pagination">
          <div className="admin-muted">Showing {start + 1}-{end} of {filteredSorted.length} bookings</div>
          <div className="admin-page-controls">
            <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className="admin-select admin-select-sm">
              {[10, 25, 50].map(n => <option key={n} value={n}>{n} / page</option>)}
            </select>
            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="btn btn-secondary btn-small" aria-label="Previous page">Prev</button>
            {Array.from({ length: totalPages }).map((_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1).map((p, idx, arr) => (
              <span key={p} className="admin-page-ellipsis">
                {idx > 0 && arr[idx - 1] !== p - 1 && <span className="admin-muted">…</span>}
                <button onClick={() => setPage(p)} aria-current={p === page ? 'page' : undefined} aria-label={`Page ${p}`} className={`btn btn-small ${p === page ? 'btn-page-active' : 'btn-page'}`}>{p}</button>
              </span>
            ))}
            <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="btn btn-secondary btn-small" aria-label="Next page">Next</button>
          </div>
        </div>
      )}

      <div className="admin-footer-note">
        <span>Last updated: {lastUpdated || '-'}</span>
        {bookings.length > 500 && <span>Older bookings may load slower.</span>}
      </div>

      {confirm && (
        <div className="admin-overlay">
          <div className="card admin-confirm">
            <h3 className="admin-confirm-title" style={{ fontFamily: 'var(--sb-serif)' }}>Confirm {confirm.kind}</h3>
            <p className="admin-confirm-text">Are you sure you want to {confirm.kind} booking {confirm.ref}?</p>
            <div className="admin-confirm-actions">
              <button onClick={() => setConfirm(null)} className="btn btn-secondary">Cancel</button>
              <button onClick={() => { const c = confirm; setConfirm(null); act(c.ref, c.kind); }} className="btn btn-primary">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
