import React from 'react';
import { LogOut } from 'lucide-react';

export interface AdminSettingsProps {
  user: { email: string } | null;
  onLogout: () => void;
}

export function AdminSettings({ user, onLogout }: AdminSettingsProps) {
  return (
    <div className="card admin-card" style={{ padding: 20, maxWidth: 480 }}>
      <h2 style={{ margin: 0, fontSize: 18, fontFamily: 'var(--sb-serif)' }}>Settings</h2>
      <p style={{ margin: 4, fontSize: 13, color: 'var(--sb-grey)' }}>Administrator account information.</p>
      <div style={{ marginTop: 16 }}>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--sb-grey)', marginBottom: 4 }}>Email</label>
        <div style={{ fontSize: 15 }}>{user?.email || '-'}</div>
      </div>
      <div style={{ marginTop: 16 }}>
        <button onClick={onLogout} className="btn btn-secondary admin-close"><LogOut size={14} /> Sign out</button>
      </div>
    </div>
  );
}
export default AdminSettings;