import React, { useEffect, useState } from 'react';
import { adminListSiteImages, adminUploadSiteImage, adminDeleteSiteImage, type SiteImageRow } from '../../lib/api';

const SLOTS = [
  { key: 'home-hero', label: 'Homepage Hero Image', fallback: '/images/Hero%20Section/001.jpg' },
  { key: 'home-guide-teaser', label: 'Guide Teaser Image', fallback: '/images/Guide%20Teaser/001.jpg' },
];

export default function SiteImagesManager() {
  const [images, setImages] = useState<Record<string, SiteImageRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true); setError('');
    const res = await adminListSiteImages();
    if (!res.ok) { setError(res.error || 'Failed to load images'); setLoading(false); return; }
    const map: Record<string, SiteImageRow> = {};
    for (const img of res.images || []) map[img.slotKey] = img;
    setImages(map);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function onFile(slot: string, file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please select an image file.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Image must be under 10 MB.'); return; }
    setFiles(prev => ({ ...prev, [slot]: file }));
    const url = URL.createObjectURL(file);
    setPreviews(prev => ({ ...prev, [slot]: url }));
    setError('');
  }

  async function save(slot: string) {
    const file = files[slot];
    if (!file) return;
    setSaving(prev => ({ ...prev, [slot]: true })); setError(''); setSuccess('');
    const res = await adminUploadSiteImage(slot, file);
    setSaving(prev => ({ ...prev, [slot]: false }));
    if (!res.ok) { setError(res.error || 'Upload failed'); return; }
    if (res.image) setImages(prev => ({ ...prev, [slot]: res.image as SiteImageRow }));
    setFiles(prev => ({ ...prev, [slot]: null }));
    setPreviews(prev => { const n = { ...prev }; delete n[slot]; return n; });
    setSuccess('Image saved.');
    await load();
  }

  async function restore(slot: string) {
    setSaving(prev => ({ ...prev, [slot]: true })); setError(''); setSuccess('');
    const res = await adminDeleteSiteImage(slot);
    setSaving(prev => ({ ...prev, [slot]: false }));
    if (!res.ok) { setError(res.error || 'Restore failed'); return; }
    setImages(prev => { const n = { ...prev }; delete n[slot]; return n; });
    setSuccess('Restored default image.');
    await load();
  }

  if (loading) return <div className="admin-card">Loading images...</div>;

  return (
    <div className="admin-card">
      <h2>Website Images</h2>
      {error && <div className="admin-error-inline">{error}</div>}
      {success && <div className="admin-success-inline">{success}</div>}
      {SLOTS.map(slot => {
        const current = images[slot.key];
        const src = previews[slot.key] || (current ? current.blobUrl : slot.fallback);
        return (
          <div key={slot.key} className="site-image-slot" style={{ marginBottom: 24 }}>
            <h3>{slot.label}</h3>
            <div style={{ maxWidth: 320, marginBottom: 8 }}>
              <img src={src} alt={slot.label} style={{ width: '100%', height: 'auto', borderRadius: 8 }} />
            </div>
            <input type="file" accept="image/*" onChange={e => onFile(slot.key, e.target.files?.[0] || null)} />
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" disabled={!files[slot.key] || saving[slot.key]} onClick={() => save(slot.key)}>
                {saving[slot.key] ? 'Saving...' : 'Save'}
              </button>
              <button className="btn btn-secondary" disabled={saving[slot.key]} onClick={() => restore(slot.key)}>
                Restore default
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
