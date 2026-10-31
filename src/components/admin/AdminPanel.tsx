import { useEffect, useMemo, useState } from 'react';
import { Search, FileText, LogOut, Edit2, Trash2, Plus, Save, X } from 'lucide-react';
import SiteImagesManager from './SiteImagesManager';
import { adminApproveBooking, adminCancelBooking, adminListBookings, adminRejectBooking, adminLogin, adminLogout, adminMe, type AdminBooking, adminListServices, adminUpsertService, adminDeleteService, adminToggleServiceActive, type ServiceRow, type ServiceUpsertInput } from '../../lib/api';

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
  return `GH?${Number(p).toFixed(2)}`;
}
function dash(v: any) { const t = String(v ?? '').trim(); return t ? t : '-'; }

function paginate<T>(items: T[], page: number, pageSize: number): { pageItems: T[]; totalPages: number; start: number; end: number } {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(Math.max(1, page), totalPages);
  const start = (p - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  return { pageItems: items.slice(start, end), totalPages, start, end };
}

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
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

  // Service catalogue state
  const [servicesTab, setServicesTab] = useState('list'); // 'list' | 'edit'
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState('');
  const [servicesSuccess, setServicesSuccess] = useState('');
  const [editingService, setEditingService] = useState<ServiceRow | null>(null);
  const [actioningServiceId, setActioningServiceId] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState<{ id: string; name: string; category: string; description: string; price: number; duration: number; photoRequired: boolean; tintGuideRequired: boolean; image: string; gallery: string[]; active: boolean; sortOrder: number }>({
    id: '', name: '', category: '', description: '', price: 0, duration: 30, photoRequired: false, tintGuideRequired: false, image: '', gallery: [], active: true, sortOrder: 0,
  });

  async function loadServices() {
    setServicesLoading(true); setServicesError('');
    try {
      const res = await adminListServices();
      if (!res.ok) { setServicesError(res.error || 'Failed to load services'); setServices([]); return; }
      setServices(res.services || []);
    } catch { setServicesError('Unexpected error loading services'); } finally { setServicesLoading(false); }
  }

  useEffect(() => {
    if (authenticated) loadServices();
  }, [authenticated]);

  function resetServiceForm() {
    setServiceForm({ id: '', name: '', category: '', description: '', price: 0, duration: 30, photoRequired: false, tintGuideRequired: false, image: '', gallery: [], active: true, sortOrder: 0 });
    setEditingService(null);
  }

  function startEdit(s: ServiceRow) {
    setEditingService(s);
    setServiceForm({ id: s.id, name: s.name, category: s.category, description: s.description, price: s.price, duration: s.duration, photoRequired: !!s.photoRequired, tintGuideRequired: !!s.tintGuideRequired, image: s.image, gallery: Array.isArray(s.gallery) ? s.gallery : [], active: s.active !== false, sortOrder: typeof s.sortOrder === 'number' ? s.sortOrder : 0 });
    setServicesTab('edit');
  }

  async function saveService() {
    setServicesError(''); setServicesSuccess('');
    const input: ServiceUpsertInput = { action: 'upsert', id: serviceForm.id.trim(), name: serviceForm.name.trim(), category: serviceForm.category.trim(), description: serviceForm.description.trim(), price: Number(serviceForm.price), duration: Number(serviceForm.duration), photoRequired: serviceForm.photoRequired, tintGuideRequired: serviceForm.tintGuideRequired, image: serviceForm.image.trim(), gallery: serviceForm.gallery, active: serviceForm.active, sortOrder: Number(serviceForm.sortOrder) || 0 };
    if (!input.id || !input.name || !input.category || !input.description) { setServicesError('Id, name, category and description are required.'); return; }
    if (!Number.isFinite(input.price!) || input.price! < 0) { setServicesError('Invalid price.'); return; }
    if (!Number.isFinite(input.duration!) || input.duration! <= 0) { setServicesError('Invalid duration.'); return; }
    try {
      const res = await adminUpsertService(input);
      if (!res.ok) { setServicesError(res.error || 'Save failed'); return; }
      setServicesSuccess(editingService ? 'Service updated.' : 'Service created.');
      resetServiceForm();
      setServicesTab('list');
      await loadServices();
      setTimeout(() => setServicesSuccess(''), 3000);
    } catch { setServicesError('Unexpected error saving service.'); }
  }

  async function toggleServiceActive(s: ServiceRow, nextActive: boolean) {
    setServicesError(''); setServicesSuccess('');
    setActioningServiceId(s.id);
    try {
      const res = await adminToggleServiceActive(s.id, nextActive);
      if (!res.ok) { setServicesError(res.error || 'Failed to update service status'); return; }
      setServicesSuccess(nextActive ? 'Service activated.' : 'Service deactivated.');
      await loadServices();
      setTimeout(() => setServicesSuccess(''), 3000);
    } catch { setServicesError('Unexpected error updating service status.'); }
    finally { setActioningServiceId(null); }
  }

  async function removeService(id: string) {
    if (!window.confirm('Delete this service?')) return;
    setServicesError('');
    try {
      const res = await adminDeleteService(id);
      if (!res.ok) { setServicesError(res.error || 'Delete failed'); return; }
      await loadServices();
    } catch { setServicesError('Unexpected error deleting service.'); }
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('page', String(page));
    window.history.replaceState({}, '', url.toString());
  }, [page]);

  async function checkSession() {
    setCheckingSession(true);
    try {
      const res = await adminMe();
      if (res.ok && res.user) {
        setAuthenticated(true);
        setUser(res.user);
      } else {
        setAuthenticated(false);
        setUser(null);
      }
    } catch {
      setAuthenticated(false);
      setUser(null);
    }
    setCheckingSession(false);
  }

  useEffect(() => {
    checkSession();
  }, []);

  async function load() {
    if (!authenticated) { setError('Please sign in to continue.'); return; }
    try { setLoading(true); setError(''); } catch {}
    const res = await adminListBookings();
    setLoading(false);
    if (!res.ok) { setError(res.error || 'Failed to load'); setBookings([]); return; }
    const rows = (res.rows || []).map(sanitizeBooking);
    setBookings(rows);
    setLastUpdated(new Date().toLocaleString());
  }

  useEffect(() => {
    if (import.meta.env.DEV && !authenticated) {
      const rows = DEMO_BOOKINGS.map(sanitizeBooking);
      setBookings(rows);
      setLastUpdated(new Date().toLocaleString());
      return;
    }
    if (authenticated) load();
    /* eslint-disable-next-line */
  }, [authenticated]);

  async function handleLogin() {
    setLoginError(''); setLoggingIn(true);
    try {
      const res = await adminLogin(email.trim(), password);
      if (!res.ok) { setLoginError(res.error || 'Login failed.'); return; }
      setAuthenticated(true);
      const me = await adminMe();
      if (me.ok && me.user) setUser(me.user);
    } catch {
      setLoginError('Login failed.');
    }
    setLoggingIn(false);
  }

  async function handleLogout() {
    await adminLogout();
    setAuthenticated(false);
    setUser(null);
    setBookings([]);
    setError('');
    setToast('');
  }

  async function act(ref: string, kind: 'approve' | 'reject' | 'cancel') {
    setActioning(ref + kind); setError('');
    let res: any;
    if (kind === 'approve') res = await adminApproveBooking(ref);
    else if (kind === 'reject') res = await adminRejectBooking(ref);
    else res = await adminCancelBooking(ref);
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

  if (checkingSession) {
    return (
      <div className="admin-page" style={{ fontFamily: 'var(--sb-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div className="card admin-login-card">
          <h1 className="admin-title">Booking Admin</h1>
          <p className="admin-subtitle">Checking session...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    if (import.meta.env.DEV) {
      return (
        <div className="admin-page" style={{ fontFamily: 'var(--sb-sans)' }}>
          <div className="container admin-login">
            <div className="card admin-login-card">
              <h1 className="admin-title">Booking Admin</h1>
              <p className="admin-subtitle">Sign in to manage bookings, or use demo mode.</p>
              {loginError && <div className="admin-error-inline">{loginError}</div>}
              <div className="admin-token-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@example.com" className="admin-input" />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="admin-input" />
                </div>
              </div>
              <button onClick={handleLogin} disabled={loggingIn} className="btn btn-primary admin-full-btn">
                {loggingIn ? 'Signing in...' : 'Sign in'}
              </button>
              <p style={{ marginTop: 12, fontSize: 13, color: 'var(--sb-grey)' }}>
                Or <button onClick={() => { setAuthenticated(true); load(); }} className="btn-link">use demo data</button>
              </p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="admin-page" style={{ fontFamily: 'var(--sb-sans)' }}>
        <div className="container admin-login">
          <div className="card admin-login-card">
            <h1 className="admin-title">Booking Admin</h1>
            <p className="admin-subtitle">Sign in to manage bookings.</p>
            {loginError && <div className="admin-error-inline">{loginError}</div>}
            <div className="admin-token-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@example.com" className="admin-input" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="admin-input" />
              </div>
            </div>
            <button onClick={handleLogin} disabled={loggingIn} className="btn btn-primary admin-full-btn">
              {loggingIn ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--sb-grey)' }}>{user?.email}</span>
            <button onClick={handleLogout} className="btn btn-secondary admin-close">
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </header>

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
                    <div className="admin-meta"><strong>Price:</strong> {priceText(b.price)} � <strong>Payment:</strong> {dash(b.paymentStatus)}</div>
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
                {idx > 0 && arr[idx - 1] !== p - 1 && <span className="admin-muted">�</span>}
                <button onClick={() => setPage(p)} aria-current={p === page ? 'page' : undefined} aria-label={`Page ${p}`} className={`btn btn-small ${p === page ? 'btn-page-active' : 'btn-page'}`}>{p}</button>
              </span>
            ))}
            <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="btn btn-secondary btn-small" aria-label="Next page">Next</button>
          </div>
        </div>
      )}

      <div className="card admin-card" style={{ marginTop: 32, padding: 20 }}>
        <SiteImagesManager />
      </div>
      <div className="admin-footer-note">
        <span>Last updated: {lastUpdated || '-'}</span>
        {bookings.length > 500 && <span>Older bookings may load slower.</span>}
      </div>

      {/* Service catalogue management */}
      <div className="card admin-card" style={{ marginTop: 32, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontFamily: 'var(--sb-serif)' }}>Service catalogue</h2>
            <p style={{ margin: 4, fontSize: 13, color: 'var(--sb-grey)' }}>Create, edit or retire services. Prices are stored in the database and used at booking time.</p>
          </div>
          <button onClick={resetServiceForm} disabled={servicesLoading} className="btn btn-primary" style={{ padding: '8px 14px', fontSize: 13 }}>
            <Plus size={14} /> Add service
          </button>
        </div>

        {servicesError && <div style={{ color: 'var(--sb-danger)', marginBottom: 10, fontSize: 13 }}>{servicesError}</div>}
        {servicesSuccess && <div style={{ color: 'var(--sb-success, #16a34a)', marginBottom: 10, fontSize: 13, fontWeight: 600 }}>{servicesSuccess}</div>}

        {servicesTab === 'list' ? (
          <>
            {servicesLoading ? (
              <div style={{ padding: 20, color: 'var(--sb-grey)' }}>Loading services�</div>
            ) : services.length === 0 ? (
              <div style={{ padding: 24, color: 'var(--sb-grey)', textAlign: 'center' }}>No services yet. Add one to get started.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--sb-border)', color: 'var(--sb-grey)' }}>
                      <th style={{ padding: '10px 8px' }}>Service</th>
                      <th style={{ padding: '10px 8px' }}>Category</th>
                      <th style={{ padding: '10px 8px' }}>Description</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right' }}>Price</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>Active</th>
                      <th style={{ padding: '10px 8px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--sb-border)' }}>
                        <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 600 }}>{s.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--sb-grey)', fontFamily: 'monospace' }}>{s.id}</div>
                        </td>
                        <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>{s.category}</td>
                        <td style={{ padding: '10px 8px', verticalAlign: 'top', maxWidth: 220 }}>
                          <div style={{ color: 'var(--sb-grey)', fontSize: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.description}</div>
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>GH?{Number(s.price || 0).toFixed(2)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: s.active ? 'rgba(22,163,74,0.12)' : 'rgba(148,163,184,0.25)', color: s.active ? '#16a34a' : '#64748b' }}>
                            {s.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                          <button onClick={() => startEdit(s)} className="btn btn-secondary btn-small" style={{ marginRight: 6 }} disabled={!!actioningServiceId}>Edit</button>
                          <button
                            disabled={!!actioningServiceId}
                            onClick={() => toggleServiceActive(s, !s.active)}
                            className="btn btn-secondary btn-small"
                            style={{ marginRight: 6, color: s.active ? 'var(--sb-danger)' : 'var(--sb-success, #16a34a)' }}
                          >
                            {actioningServiceId === s.id ? (s.active ? '�' : '�') : (s.active ? 'Deactivate' : 'Activate')}
                          </button>
                          <button onClick={() => removeService(s.id)} className="btn btn-secondary btn-small admin-action-muted" style={{ color: 'var(--sb-danger)' }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div style={{ maxWidth: 560 }}>
            <h3 style={{ marginTop: 0, fontSize: 16, marginBottom: 12 }}>{editingService ? 'Edit service' : 'New service'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--sb-grey)', marginBottom: 4 }}>Service ID</label>
                <input value={serviceForm.id} onChange={e => setServiceForm({ ...serviceForm, id: e.target.value })} placeholder="e.g. brow-shaping-blade" className="admin-input" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--sb-grey)', marginBottom: 4 }}>Name</label>
                <input value={serviceForm.name} onChange={e => setServiceForm({ ...serviceForm, name: e.target.value })} className="admin-input" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--sb-grey)', marginBottom: 4 }}>Category</label>
                <input value={serviceForm.category} onChange={e => setServiceForm({ ...serviceForm, category: e.target.value })} placeholder="Brows / Lashes" className="admin-input" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--sb-grey)', marginBottom: 4 }}>Description</label>
                <textarea value={serviceForm.description} onChange={e => setServiceForm({ ...serviceForm, description: e.target.value })} rows={2} className="admin-input" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--sb-grey)', marginBottom: 4 }}>Price (GH?)</label>
                  <input type="number" value={serviceForm.price} onChange={e => setServiceForm({ ...serviceForm, price: Number(e.target.value) || 0 })} className="admin-input" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--sb-grey)', marginBottom: 4 }}>Duration (min)</label>
                  <input type="number" value={serviceForm.duration} onChange={e => setServiceForm({ ...serviceForm, duration: Number(e.target.value) || 30 })} className="admin-input" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'end' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={serviceForm.photoRequired} onChange={e => setServiceForm({ ...serviceForm, photoRequired: e.target.checked })} /> <span style={{ fontSize: 12 }}>Photo required</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={serviceForm.tintGuideRequired} onChange={e => setServiceForm({ ...serviceForm, tintGuideRequired: e.target.checked })} /> <span style={{ fontSize: 12 }}>Tint guide required</span>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--sb-grey)', marginBottom: 4 }}>Image path</label>
                <input value={serviceForm.image} onChange={e => setServiceForm({ ...serviceForm, image: e.target.value })} placeholder="/images/.../01.jpg" className="admin-input" />
              </div>
              <div style={{ display: 'flex', alignItems: 'end', gap: 8 }}>
                <button onClick={saveService} disabled={servicesLoading} className="btn btn-primary">Save</button>
                <button onClick={resetServiceForm} className="btn btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        )}
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
