import React, { useState, useMemo } from 'react';
import { AdminPagination } from './AdminPagination';

export interface AdminCustomersProps {
  bookings: any[];
}

export function AdminCustomers({ bookings }: AdminCustomersProps) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const customers = useMemo(() => {
    const map = new Map();
    for (const b of bookings) {
      const key = (b.email || b.phone || b.name || '').toLowerCase();
      if (!key) continue;
      if (!map.has(key))
        map.set(key, {
          name: b.name,
          email: b.email,
          phone: b.phone,
          bookings: [],
          last: b.createdAt,
        });
      const c = map.get(key);
      c.bookings.push(b);
      if (String(b.createdAt || '') > String(c.last || '')) c.last = b.createdAt;
    }
    return Array.from(map.values());
  }, [bookings]);
  const filtered = customers.filter((c) => {
    const query = q.trim().toLowerCase();
    if (!query) return true;
    return (
      String(c.name || '')
        .toLowerCase()
        .includes(query) ||
      String(c.email || '')
        .toLowerCase()
        .includes(query) ||
      String(c.phone || '')
        .toLowerCase()
        .includes(query)
    );
  });
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return (
    <div className="card admin-card" style={{ padding: 20 }}>
      <h2 style={{ margin: 0, fontSize: 18, fontFamily: 'var(--sb-serif)' }}>Customers</h2>
      <div style={{ marginTop: 12 }}>
        <input
          aria-label="Search customers"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Search customers"
          className="admin-search"
        />
      </div>
      <div style={{ marginTop: 16, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr
              style={{
                textAlign: 'left',
                borderBottom: '1px solid var(--sb-border)',
                color: 'var(--sb-grey)',
              }}
            >
              <th style={{ padding: '10px 8px' }}>Name</th>
              <th style={{ padding: '10px 8px' }}>Email</th>
              <th style={{ padding: '10px 8px' }}>Phone</th>
              <th style={{ padding: '10px 8px', textAlign: 'center' }}>Bookings</th>
              <th style={{ padding: '10px 8px' }}>Last booking</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((c, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--sb-border)' }}>
                <td style={{ padding: '10px 8px' }}>{c.name}</td>
                <td style={{ padding: '10px 8px' }}>{c.email}</td>
                <td style={{ padding: '10px 8px' }}>{c.phone}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center' }}>{c.bookings.length}</td>
                <td style={{ padding: '10px 8px' }}>{c.last}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AdminPagination
        page={currentPage}
        pageSize={pageSize}
        totalItems={filtered.length}
        itemLabel="customers"
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPage(1);
          setPageSize(size);
        }}
      />
      {filtered.length === 0 && (
        <div style={{ padding: 20, color: 'var(--sb-grey)' }}>No customers found.</div>
      )}
    </div>
  );
}
export default AdminCustomers;
