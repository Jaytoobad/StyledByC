import React from 'react';
import { Search } from 'lucide-react';
import {
  canApproveAdminBooking,
  canRejectOrCancelAdminBooking,
} from '../../lib/admin-booking-actions';

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
  payLink?: string;
  clearFilters: () => void;
  load: () => void;
  pageItems: any[];
  actioning: string | null;
  confirm?: { ref: string; kind: 'reject' | 'cancel' } | null;
  setConfirm: (v: { ref: string; kind: 'reject' | 'cancel' } | null) => void;
  act: (ref: string, kind: 'approve' | 'reject' | 'cancel') => void;
  dash: (v: any) => string;
  priceText: (p: any) => string;
  statusColor: (s: string) => string;
  paymentColor: (s: string) => string;
  page: number;
  pageSize: number;
  totalPages: number;
  start: number;
  end: number;
  filteredCount: number;
  setPage: (p: number | ((prev: number) => number)) => void;
  setPageSize: (n: number) => void;
  viewBooking: (ref: string) => void;
}

export function AdminBookings(props: AdminBookingsProps) {
  const {
    summary,
    summaryTone,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    paymentFilter,
    setPaymentFilter,
    sort,
    setSort,
    loading,
    error,
    toast,
    payLink,
    clearFilters,
    load,
    pageItems,
    actioning,
    confirm: _unusedConfirm,
    setConfirm,
    act,
    dash,
    priceText,
    statusColor,
    paymentColor,
    page,
    pageSize,
    totalPages,
    start,
    end,
    filteredCount,
    setPage,
    setPageSize,
    viewBooking,
  } = props;
  return (
    <>
      <div className="summary-grid">
        {[
          { label: 'Total bookings', value: summary.total },
          { label: 'Pending', value: summary.pending },
          { label: 'Approved', value: summary.approved },
          { label: 'Rejected/Cancelled', value: summary.rejectedCancelled },
        ].map((c) => (
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
            <label
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: 'hidden',
                clip: 'rect(0,0,0,0)',
                whiteSpace: 'nowrap',
                border: 0,
              }}
            >
              Search bookings
            </label>
            <input
              aria-label="Search name, email, phone or ref"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, phone or ref"
              className="admin-search"
            />
          </div>
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="admin-select"
          >
            <option value="all">All statuses</option>
            <option value="pending_approval">Pending</option>
            <option value="needs_info">Needs information</option>
            <option value="approved_awaiting_payment">Awaiting payment</option>
            <option value="confirmed">Confirmed</option>
            <option value="paid_needs_attention">Paid - owner review</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
          </select>
          <select
            aria-label="Filter by payment"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="admin-select"
          >
            <option value="all">All payments</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
          <select
            aria-label="Sort bookings"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="admin-select"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="appointment">Appointment date</option>
          </select>
          <button onClick={clearFilters} className="admin-link">
            Clear filters
          </button>
          <button onClick={load} disabled={loading} className="admin-refresh">
            {loading && <span className="admin-spinner" />}
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="admin-error">
          <span>{error}</span>
          <button onClick={load} className="admin-link">
            Retry
          </button>
        </div>
      )}
      {toast && <div className="admin-toast">{toast}</div>}
      {payLink && (
        <div className="admin-toast" role="status">
          Booking approved.{' '}
          <a href={payLink} target="_blank" rel="noopener noreferrer">
            Open the customer payment page
          </a>
        </div>
      )}

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
            {pageItems.map((b) => (
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
                  <span className={`admin-badge ${paymentColor(b.paymentStatus || '')}`}>
                    {dash(b.paymentStatus)}
                  </span>
                </td>
                <td className="admin-td admin-td-status">
                  <span className={`admin-badge ${statusColor(b.status)}`}>
                    {b.status === 'paid_needs_attention' ? 'PAID - OWNER REVIEW' : dash(b.status)}
                  </span>
                  {b.status === 'paid_needs_attention' && b.ownerNote && (
                    <div className="admin-meta" role="note">
                      {b.ownerNote}
                    </div>
                  )}
                </td>
                <td className="admin-td admin-td-actions">
                  <div className="admin-actions">
                    <button
                      onClick={() => viewBooking(b.ref)}
                      className="btn btn-secondary btn-small admin-action-btn"
                    >
                      Details
                    </button>
                    <button
                      disabled={!canApproveAdminBooking(b.status) || !!actioning}
                      onClick={() => act(b.ref, 'approve')}
                      className="btn btn-primary btn-small admin-action-btn"
                    >
                      {actioning === b.ref + 'approve' && <span className="admin-spinner" />}
                      Approve
                    </button>
                    <button
                      disabled={!canRejectOrCancelAdminBooking(b.status) || !!actioning}
                      onClick={() => setConfirm({ ref: b.ref, kind: 'reject' })}
                      className="btn btn-secondary btn-small admin-action-btn"
                    >
                      {actioning === b.ref + 'reject' && (
                        <span className="admin-spinner admin-spinner-dark" />
                      )}
                      Reject
                    </button>
                    <button
                      disabled={!canRejectOrCancelAdminBooking(b.status) || !!actioning}
                      title={
                        b.status === 'confirmed'
                          ? 'Confirmed bookings cannot be cancelled here.'
                          : undefined
                      }
                      onClick={() => setConfirm({ ref: b.ref, kind: 'cancel' })}
                      className="btn btn-secondary btn-small admin-action-btn admin-action-muted"
                    >
                      {actioning === b.ref + 'cancel' && (
                        <span className="admin-spinner admin-spinner-dark" />
                      )}
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
        {pageItems.map((b) => (
          <div key={b.ref} className="admin-mobile-card">
            <div className="admin-mobile-head">
              <span className="admin-td-mono">{dash(b.ref)}</span>
              <span className={`admin-badge ${statusColor(b.status)}`}>
                {b.status === 'paid_needs_attention' ? 'PAID - OWNER REVIEW' : dash(b.status)}
              </span>
            </div>
            <div className="admin-mobile-row">
              <div className="admin-name">{dash(b.name)}</div>
              <div className="admin-meta">{dash(b.email)}</div>
              <div className="admin-meta">{dash(b.phone)}</div>
            </div>
            {b.status === 'paid_needs_attention' && b.ownerNote && (
              <p className="admin-meta" role="note">
                <strong>Review reason:</strong> {b.ownerNote}
              </p>
            )}
            <div className="admin-mobile-row">
              <div className="admin-meta">
                <strong>Service:</strong> {dash(b.service)}
              </div>
              <div className="admin-meta">
                <strong>Date:</strong> {dash(b.date)} {dash(b.time)}
              </div>
              <div className="admin-meta">
                <strong>Price:</strong> {priceText(b.price)} <strong>Payment:</strong>{' '}
                {dash(b.paymentStatus)}
              </div>
            </div>
            <div className="admin-mobile-actions">
              <button
                onClick={() => viewBooking(b.ref)}
                className="btn btn-secondary admin-action-btn"
              >
                Details
              </button>
              <button
                disabled={!canApproveAdminBooking(b.status) || !!actioning}
                onClick={() => act(b.ref, 'approve')}
                className="btn btn-primary admin-action-btn"
              >
                Approve
              </button>
              <button
                disabled={!canRejectOrCancelAdminBooking(b.status) || !!actioning}
                onClick={() => setConfirm({ ref: b.ref, kind: 'reject' })}
                className="btn btn-secondary admin-action-btn"
              >
                Reject
              </button>
              <button
                disabled={!canRejectOrCancelAdminBooking(b.status) || !!actioning}
                title={
                  b.status === 'confirmed'
                    ? 'Confirmed bookings cannot be cancelled here.'
                    : undefined
                }
                onClick={() => setConfirm({ ref: b.ref, kind: 'cancel' })}
                className="btn btn-secondary admin-action-btn admin-action-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        ))}
      </div>
      {!loading && filteredCount > 0 && (
        <div className="admin-pagination">
          <div className="admin-muted">
            Showing {start + 1}-{end} of {filteredCount} bookings
          </div>
          <div className="admin-page-controls">
            <select
              aria-label="Bookings per page"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="admin-select admin-select-sm"
            >
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="btn btn-secondary btn-small"
              aria-label="Previous page"
            >
              Prev
            </button>
            {Array.from({ length: totalPages })
              .map((_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .map((p, idx, arr) => (
                <span key={p} className="admin-page-ellipsis">
                  {idx > 0 && arr[idx - 1] !== p - 1 && <span className="admin-muted">…</span>}
                  <button
                    onClick={() => setPage(p)}
                    aria-current={p === page ? 'page' : undefined}
                    aria-label={`Page ${p}`}
                    className={`btn btn-small ${p === page ? 'btn-page-active' : 'btn-page'}`}
                  >
                    {p}
                  </button>
                </span>
              ))}
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="btn btn-secondary btn-small"
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}
export default AdminBookings;
