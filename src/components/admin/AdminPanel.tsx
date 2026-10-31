import { useEffect, useMemo, useState } from 'react';
import { Search, FileText, LogOut, Edit2, Trash2, Plus, Save, X } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import SiteImagesManager from './SiteImagesManager';
import { AdminLayout } from './AdminLayout';
import { AdminBookings } from './AdminBookings';
import { AdminServices } from './AdminServices';
import { AdminPayments } from './AdminPayments';
import { AdminOverview } from './AdminOverview';
import { AdminCustomers } from './AdminCustomers';
import { AdminSettings } from './AdminSettings';
import { adminApproveBooking, adminCancelBooking, adminListBookings, adminRejectBooking, adminGetStats, adminLogin, adminLogout, adminMe, type AdminBooking, adminListServices, adminUpsertService, adminDeleteService, adminToggleServiceActive, adminUploadServiceImage, type ServiceRow, type ServiceUpsertInput } from '../../lib/api';

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
  const { section } = useParams();
  const activeSection = section || 'overview';
  const navigate = useNavigate();
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
  const [stats, setStats] = useState<any>(null);
  const [statsRange, setStatsRange] = useState('all');
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
    <AdminLayout activeSection={activeSection} onNavigate={(s) => navigate(`/admin/${s}`)} user={user} onLogout={handleLogout}>
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

        {activeSection === 'bookings' && (
        <AdminBookings
          summary={summary}
          summaryTone={summaryTone}
          search={search}
          setSearch={setSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          paymentFilter={paymentFilter}
          setPaymentFilter={setPaymentFilter}
          sort={sort}
          setSort={setSort}
          loading={loading}
          error={error}
          toast={toast}
          clearFilters={clearFilters}
          load={load}
          pageItems={pageItems}
          actioning={actioning}
          confirm={confirm}
          setConfirm={setConfirm}
          act={act}
          dash={dash}
          priceText={priceText}
          statusColor={statusColor}
          paymentColor={paymentColor}
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          start={start}
          end={end}
          filteredCount={filteredSorted.length}
          setPage={setPage}
          setPageSize={setPageSize}
        />
        )}

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
          null
        )}
      </div>

      {activeSection === 'images' && <SiteImagesManager />}
      {activeSection === 'customers' && <AdminCustomers bookings={bookings} />}
      {activeSection === 'payments' && <AdminPayments stats={stats} bookings={bookings} />}
      {activeSection === 'settings' && <AdminSettings user={user} onLogout={handleLogout} />}
      <div className="admin-footer-note">
        <span>Last updated: {lastUpdated || '-'}</span>
        {bookings.length > 500 && <span>Older bookings may load slower.</span>}
      </div>

      {activeSection === 'overview' && <AdminOverview stats={stats} bookings={bookings} />}
      {activeSection === 'services' && (
      <AdminServices
        services={services}
        servicesLoading={servicesLoading}
        servicesError={servicesError}
        servicesSuccess={servicesSuccess}
        servicesTab={servicesTab}
        setServicesTab={setServicesTab}
        editingService={editingService}
        actioningServiceId={actioningServiceId}
        serviceForm={serviceForm}
        setServiceForm={setServiceForm}
        resetServiceForm={resetServiceForm}
        startEdit={startEdit}
        saveService={saveService}
        toggleServiceActive={toggleServiceActive}
        removeService={removeService}
        adminUploadServiceImage={adminUploadServiceImage}
      />

      )}
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
    </AdminLayout>
  );
}
