import React, { useMemo } from 'react';

export interface AnalyticsProps {
  stats: any;
  bookings: any[];
}

export function AnalyticsDashboard({ stats, bookings }: AnalyticsProps) {
  const bookingsByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    const revenueByDate: Record<string, number> = {};
    for (const b of bookings || []) {
      const d = (b.date || '').slice(0, 10);
      counts[d] = (counts[d] || 0) + 1;
      revenueByDate[d] = (revenueByDate[d] || 0) + (Number(b.price) || 0);
    }
    const dates = Object.keys(counts).sort();
    return dates.map((d) => ({
      date: d,
      bookings: counts[d] || 0,
      revenue: revenueByDate[d] || 0,
    }));
  }, [bookings]);

  const serviceCounts: Record<string, number> = {};
  for (const b of bookings || []) {
    serviceCounts[b.service] = (serviceCounts[b.service] || 0) + 1;
  }
  const serviceData = Object.entries(serviceCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const statusCounts: Record<string, number> = {};
  for (const b of bookings || []) {
    statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
  }

  const total = bookings.length || 1;
  const paid = statusCounts.paid || statusCounts.successfulPayments || 0;
  const conversionRate = total > 0 ? Math.round((paid / total) * 100) : 0;

  const maxBookings =
    bookingsByDate.length > 0 ? Math.max(...bookingsByDate.map((d) => d.bookings)) : 1;
  const maxRevenue =
    bookingsByDate.length > 0 ? Math.max(...bookingsByDate.map((d) => d.revenue)) : 1;
  const maxCount =
    serviceData.length > 0 ? Math.max(...serviceData.map((s) => s.count)) : 1;

  return (
    <div className="admin-page">
      <div className="container admin-main">
        <div className="admin-header">
          <div>
            <h1 className="admin-title">Analytics &amp; Insights</h1>
            <p className="admin-subtitle">
              Booking trends, revenue, and service performance at a glance.
            </p>
          </div>
          <div className="admin-header-right">
            <span className="admin-header-date">
              {new Date().toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>

        <div className="admin-stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total bookings</div>
            <div className="stat-value">{stats?.total ?? bookings.length}</div>
            <div className="stat-comparison up">
              <span className="arrow">+</span>
              <span>+12% vs last period</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending approval</div>
            <div className="stat-value">
              {stats?.pendingApproval ??
                bookings.filter((b) =>
                  String(b.status).toLowerCase().includes('pending')
                ).length}
            </div>
            <div className="stat-comparison up">
              <span className="arrow">+</span>
              <span>+2 new</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Confirmed</div>
            <div className="stat-value">{stats?.confirmed ?? 0}</div>
            <div className="stat-comparison up">
              <span className="arrow">+</span>
              <span>+5 this week</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Conversion rate</div>
            <div className="stat-value">{conversionRate}%</div>
            <div className="stat-comparison up">
              <span className="arrow">+</span>
              <span>+3 pts vs month</span>
            </div>
          </div>
        </div>

        <div className="stats-row">
          <div className="chart-container">
            <h3 className="chart-title">Bookings over time</h3>
            <div className="sparkline-container">
              {bookingsByDate.map((d, i) => {
                const height = Math.max(10, Math.round((d.bookings / maxBookings) * 60));
                return (
                  <div
                    key={d.date}
                    className="sparkline-point"
                    style={{ bottom: 0, height: `${height}%` }}
                  />
                );
              })}
              {bookingsByDate.map((d, i) => (
                <span
                  key={`lbl-${i}`}
                  className="sparkline-label"
                  style={{ left: `${((i / Math.max(bookingsByDate.length - 1, 1)) * 100)}%` }}
                >
                  {d.date.slice(5)}
                </span>
              ))}
            </div>
            <div className="stat-badge">
              <strong>{bookingsByDate.length} days tracked</strong>
              <span>Peak: {maxBookings} bookings</span>
            </div>
          </div>
          <div className="chart-container">
            <h3 className="chart-title">Revenue over time</h3>
            <div className="sparkline-container">
              {bookingsByDate.map((d, i) => {
                const height = Math.max(10, Math.round((d.revenue / maxRevenue) * 60));
                return (
                  <div
                    key={d.date}
                    className="sparkline-point"
                    style={{ bottom: 0, height: `${height}%` }}
                  />
                );
              })}
              {bookingsByDate.map((d, i) => (
                <span
                  key={`lbl-${i}`}
                  className="sparkline-label"
                  style={{ left: `${((i / Math.max(bookingsByDate.length - 1, 1)) * 100)}%` }}
                >
                  {d.date.slice(5)}
                </span>
              ))}
            </div>
            <div className="stat-badge">
              <strong>
                GH₵{Math.max(...bookingsByDate.map((d) => d.revenue)).toFixed(0)}
              </strong>
              <span>peak day</span>
              <span>GH₵{bookingsByDate.reduce((sum, d) => sum + d.revenue, 0).toFixed(0)} total</span>
            </div>
          </div>
        </div>

        <div className="chart-container">
          <h3 className="chart-title">Service popularity</h3>
          <div className="services-grid">
            {serviceData.map((item) => {
              const pct = Math.round((item.count / maxCount) * 100);
              const height = Math.max(20, Math.round((item.count / maxCount) * 60));
              return (
                <div key={item.name} className="service-stat-row">
                  <div className="service-name">{item.name}</div>
                  <div className="service-bar-container">
                    <div className="service-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="service-count">{item.count} ({pct}%)</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="chart-container">
          <h3 className="chart-title">Booking status distribution</h3>
          <div className="status-distribution">
            {[['pending_approval', 'Pending approval'], ['approved', 'Confirmed'], ['rejected', 'Rejected'], ['cancelled', 'Cancelled']]
              .filter(([key]) => statusCounts[key] !== undefined)
              .map(([key, label]) => {
                const count = statusCounts[key] || 0;
                const pct = Math.round((count / total) * 100);
                const height = Math.max(20, Math.round((count / maxCount) * 60));
                return (
                  <div key={key} className="status-dist-row">
                    <div className="status-label">{label}</div>
                    <div className="status-bar-container">
                      <div className="status-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="status-count">{count} ({pct}%)</div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}