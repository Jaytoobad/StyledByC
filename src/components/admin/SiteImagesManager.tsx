import React, { useEffect, useState } from 'react';
import { adminListSiteImages, adminUploadSiteImage, adminAddSiteImage, adminDeleteSiteImage, type SiteImageRow } from '../../lib/api';

const SINGLE_SLOTS = [
  { key: 'home-hero', label: 'Homepage Hero Image', fallback: '/images/Hero%20Section/001.jpg' },
  { key: 'home-guide-teaser', label: 'Guide Teaser Image', fallback: '/images/Guide%20Teaser/001.jpg' },
];

const GALLERY_SLOTS = [
  { key: 'previous-work', label: 'Previous Work Gallery', fallback: '' },
];

export default function SiteImagesManager() {
  const [images, setImages] = useState<Record<string, SiteImageRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [galleryFiles, setGalleryFiles] = useState<Record<string, File[]>>({});
  const [galleryPreviews, setGalleryPreviews] = useState<Record<string, string[]>>({});
  const [gallerySaving, setGallerySaving] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true); setError('');
    const res = await adminListSiteImages();
    if (!res.ok) { setError(res.error || 'Failed to load images'); setLoading(false); return; }
    const map: Record<string, SiteImageRow[]> = {};
    for (const img of res.images || []) {
      if (!map[img.slotKey]) map[img.slotKey] = [];
      map[img.slotKey].push(img);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.position || 0) - (b.position || 0));
    }
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
    if (res.image) setImages(prev => ({ ...prev, [slot]: [res.image as SiteImageRow] }));
    setFiles(prev => ({ ...prev, [slot]: null }));
    setPreviews(prev => { const n = { ...prev }; delete n[slot]; return n; });
    setSuccess('Image saved.');
    await load();
  }

  async function restore(slot: string) {
    setSaving(prev => ({ ...prev, [slot]: true })); setError(''); setSuccess('');
    const rows = images[slot] || [];
    for (const row of rows) {
      await adminDeleteSiteImage(row.slotKey);
    }
    setSaving(prev => ({ ...prev, [slot]: false }));
    setImages(prev => { const n = { ...prev }; delete n[slot]; return n; });
    setSuccess('Restored default image.');
    await load();
  }

  function onGalleryFile(slot: string, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 10 * 1024 * 1024) continue;
      setGalleryFiles(prev => ({ ...prev, [slot]: [...(prev[slot] || []), file] }));
      const url = URL.createObjectURL(file);
      setGalleryPreviews(prev => ({ ...prev, [slot]: [...(prev[slot] || []), url] }));
    }
  }

  async function saveGallery(slot: string) {
    const slotFiles = galleryFiles[slot] || [];
    if (slotFiles.length === 0) return;
    setGallerySaving(prev => ({ ...prev, [slot]: true })); setError(''); setSuccess('');
    try {
      let position = (images[slot] || []).length;
      for (const file of slotFiles) {
        const res = await adminAddSiteImage(slot, file, position);
        if (!res.ok) { setError(res.error || 'Upload failed'); setGallerySaving(prev => ({ ...prev, [slot]: false })); return; }
        position += 1;
      }
      setGalleryFiles(prev => ({ ...prev, [slot]: [] }));
      setGalleryPreviews(prev => ({ ...prev, [slot]: [] }));
      setSuccess('Gallery images added.');
    } finally {
      setGallerySaving(prev => ({ ...prev, [slot]: false }));
    }
    await load();
  }

  async function removeGalleryImage(slot: string, rowId: string) {
    if (!window.confirm('Remove this image from the gallery?')) return;
    setError(''); setSuccess('');
    const res = await adminDeleteSiteImage(rowId);
    if (!res.ok) { setError(res.error || 'Remove failed'); return; }
    setSuccess('Image removed.');
    await load();
  }

  if (loading) return <div className="admin-card">Loading images...</div>;

  return (
    <div className="admin-card">
      <h2>Website Images</h2>
      {error && <div className="admin-error-inline">{error}</div>}
      {success && <div className="admin-success-inline">{success}</div>}

      <h3 style={{ marginTop: 32, marginBottom: 16, fontSize: 16, color: 'var(--sb-grey)', textTransform: 'uppercase', letterSpacing: '1px' }}>Single images</h3>
      {SINGLE_SLOTS.map(slot => {
        const current = (images[slot.key] || [])[0];
        const src = previews[slot.key] || (current ? current.blobUrl : slot.fallback);
        return (
          <div key={slot.key} className="site-image-slot" style={{ marginBottom: 24 }}>
            <h3>{slot.label}</h3>
            <div style={{ maxWidth: 320, marginBottom: 8 }}>
              <img src={src} alt={slot.label} style={{ width: '100%', height: 'auto', borderRadius: 8 }} />
            </div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }} htmlFor={`site-image-${slot.key}`}>{slot.label}</label>
            <input id={`site-image-${slot.key}`} type="file" accept="image/*" onChange={e => onFile(slot.key, e.target.files?.[0] || null)} />
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

      <h3 style={{ marginTop: 40, marginBottom: 16, fontSize: 16, color: 'var(--sb-grey)', textTransform: 'uppercase', letterSpacing: '1px' }}>Galleries</h3>
      {GALLERY_SLOTS.map(slot => {
        const current = images[slot.key] || [];
        return (
          <div key={slot.key} className="site-image-slot" style={{ marginBottom: 24 }}>
            <h3>{slot.label}</h3>
            <p style={{ fontSize: 13, color: 'var(--sb-grey)', marginBottom: 12 }}>Upload photos of completed work. They will appear in the swipeable Previous Work gallery on the homepage.</p>
            {current.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--sb-grey)', border: '1px solid var(--sb-border)', borderRadius: 8, background: '#faf7f3' }}>
                No images yet. Upload photos to build the previous work gallery.
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {current.map((row, idx) => {
                const preview = previews[slot.key]?.[idx] || row.blobUrl;
                return (
                  <div key={row.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <img src={preview} alt={`Previous work ${idx + 1}`} style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--sb-border)' }} />
                    <button
                      type="button"
                      onClick={() => removeGalleryImage(slot.key, row.id)}
                      style={{ fontSize: 11, color: 'var(--sb-danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }} htmlFor={`gallery-image-${slot.key}`}>Add photos</label>
            <input id={`gallery-image-${slot.key}`} type="file" accept="image/*" multiple onChange={e => onGalleryFile(slot.key, e.target.files)} />
            {galleryPreviews[slot.key]?.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {galleryPreviews[slot.key].map((url, idx) => (
                  <div key={idx} style={{ position: 'relative', width: 80, height: 80 }}>
                    <img src={url} alt={`Preview ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                    <button
                      type="button"
                      onClick={() => {
                        setGalleryFiles(prev => { const n = { ...prev }; n[slot.key] = (n[slot.key] || []).filter((_, i) => i !== idx); return n; });
                        setGalleryPreviews(prev => { const n = { ...prev }; n[slot.key] = (n[slot.key] || []).filter((_, i) => i !== idx); return n; });
                      }}
                      style={{ position: 'absolute', top: 2, right: 2, fontSize: 10, color: '#b00020', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" disabled={galleryFiles[slot.key]?.length === 0 || gallerySaving[slot.key]} onClick={() => saveGallery(slot.key)}>
                {gallerySaving[slot.key] ? 'Adding...' : 'Add to gallery'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
