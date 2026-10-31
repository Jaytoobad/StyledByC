import React from 'react';

export interface AdminPaymentsProps {
  stats: any;
  bookings: any[];
}

export function AdminPayments({ stats, bookings }: AdminPaymentsProps) {
  return (
    <div className="card admin-card" style={{ padding: 20 }}>
      <h2 style={{ margin: 0, fontSize: 18, fontFamily: 'var(--sb-serif)' }}>Payments</h2>
      <p style={{ margin: 4, fontSize: 13, color: 'var(--sb-grey)' }}>Reservation-fee payment records and summary.</p>
      {stats ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginTop: 12 }}>
          <div>Successful payments: {stats.successfulPayments}</div>
          <div>Pending payments: {stats.pendingPayments}</div>
          <div>Expired payments: {stats.expiredPayments}</div>
          <div>Reservation fees collected: {stats.reservationFeesCollected}</div>
        </div>
      ) : <div>Loading stats...</div>}
      <div style={{ marginTop: 16, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--sb-border)', color: 'var(--sb-grey)' }}>
              <th style={{ padding: '10px 8px' }}>Ref</th>
              <th style={{ padding: '10px 8px' }}>Customer</th>
              <th style={{ padding: '10px 8px', textAlign: 'right' }}>Amount</th>
              <th style={{ padding: '10px 8px' }}>Payment Status</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map(b => (
              <tr key={b.ref} style={{ borderBottom: '1px solid var(--sb-border)' }}>
                <td style={{ padding: '10px 8px' }}>{b.ref}</td>
                <td style={{ padding: '10px 8px' }}>{b.name}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>GH₵{Number(b.price || 0).toFixed(2)}</td>
                <td style={{ padding: '10px 8px' }}>{b.paymentStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export default AdminPayments;