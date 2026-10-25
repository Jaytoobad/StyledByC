import { AdminPanel } from '../components/admin/AdminPanel';

export function Admin() {
  return <AdminPanel onClose={() => { window.location.href = '/'; }} />;
}