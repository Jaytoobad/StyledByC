import React, { useState } from 'react';
import { LogOut } from 'lucide-react';

const NAV = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'bookings', label: 'Bookings', icon: '📅' },
  { id: 'services', label: 'Services', icon: '✨' },
  { id: 'images', label: 'Website Images', icon: '🖼️' },
  { id: 'payments', label: 'Payments', icon: '💳' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export function AdminLayout({ children, activeSection, onNavigate, user, onLogout }: { children: React.ReactNode; activeSection: string; onNavigate: (s: string) => void; user: { email: string } | null; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="admin-shell" style={{ fontFamily: 'var(--sb-sans)' }}>
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">StyledByC</div>
        <nav className="admin-sidebar-nav">
          {NAV.map(n => (
            <button key={n.id} className={`admin-nav-item ${activeSection === n.id ? 'active' : ''}`} onClick={() => onNavigate(n.id)}>
              <span className="admin-nav-icon">{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <span style={{ fontSize: 13, color: 'var(--sb-grey)' }}>{user?.email}</span>
          <button onClick={onLogout} className="btn btn-secondary admin-close"><LogOut size={14} /> Sign out</button>
        </div>
      </aside>

      <div className="admin-mobile-header">
        <button className="admin-menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">☰</button>
        <div className="admin-mobile-brand">StyledByC</div>
      </div>
      {open && (
        <div className="admin-drawer-overlay" onClick={() => setOpen(false)}>
          <div className="admin-drawer" onClick={e => e.stopPropagation()}>
            <div className="admin-drawer-brand">StyledByC</div>
            {NAV.map(n => (
              <button key={n.id} className={`admin-nav-item ${activeSection === n.id ? 'active' : ''}`} onClick={() => { onNavigate(n.id); setOpen(false); }}>
                <span className="admin-nav-icon">{n.icon}</span>
                <span>{n.label}</span>
              </button>
            ))}
            <div style={{ marginTop: 'auto', padding: 16 }}>
              <button onClick={onLogout} className="btn btn-secondary admin-close" style={{ width: '100%' }}><LogOut size={14} /> Sign out</button>
            </div>
          </div>
        </div>
      )}

      <main className="admin-content">{children}</main>
    </div>
  );
}
export default AdminLayout;