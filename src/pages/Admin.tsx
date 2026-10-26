import { useEffect } from 'react';
import { AdminPanel } from '../components/admin/AdminPanel';

export function Admin() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);
  return <AdminPanel onClose={() => { window.location.href = '/'; }} />;
}