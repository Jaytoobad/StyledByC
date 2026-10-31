import React from 'react';
import { Search } from 'lucide-react';

export interface AdminBookingsProps {
  summary: { total: number; pending: number; approved: number; rejectedCancelled: number };
  summaryTone: (label: string) => string;
  search: string;
  setSearch: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  paymentFilter: string;
  setPaymentFilter: (v: string) => void;
  sort: string;
  setSort: (v: string) => void;
  loading: boolean;
  error: string;
  toast: string;
  clearFilters: () => void;
  load: () => void;
  pageItems: any[];
  actioning: string | null;
  confirm: { ref: string; kind: 'reject' | 'cancel' } | null;
  setConfirm: (v: { ref: string; kind: 'reject' | 'cancel' } | null) => void;
  act: (ref: string, kind: 'approve' | 'reject' | 'cancel') => void;
  dash: (v: any) => string;
  priceText: (p: any) => string;
  statusColor: (s: string) => string;
  paymentColor: (s: string) => string;
}

export function AdminBookings(props: AdminBookingsProps) {
  const { summary, summaryTone, search, setSearch, statusFilter, setStatusFilter, paymentFilter, setPaymentFilter, sort, setSort, loading, error, toast, clearFilters, load, pageItems, actioning, confirm, setConfirm, act, dash, priceText, statusColor, paymentColor } = props;
  return (
    <>
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

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th className="admin-th admin-th-ref">Ref</th>
              <th className="admin-th admin-th-customer">Customer</th>
              <th className="admin-th admin-th-service">Service</th>
              <th className="admin-th admin-th-date">Date &amp; Time</th>
              <th className="admin-th admin-th-price">Price</th>
              <th className="admin-th admin-th-payment">Payment</th>
              <th className="admin-th admin-th-status">Status</th>
              <th className="admin-th admin-th-actions">Actions</th>
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
    </>
  );
}
export default AdminBookings;