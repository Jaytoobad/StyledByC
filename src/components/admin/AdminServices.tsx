import React from 'react';
import { Plus } from 'lucide-react';

export interface AdminServicesProps {
  services: any[];
  servicesLoading: boolean;
  servicesError: string;
  servicesSuccess: string;
  servicesTab: string;
  setServicesTab: (v: string) => void;
  editingService: any;
  actioningServiceId: string | null;
  serviceForm: any;
  setServiceForm: (v: any) => void;
  resetServiceForm: () => void;
  startEdit: (s: any) => void;
  saveService: () => void;
  toggleServiceActive: (s: any, next: boolean) => void;
  removeService: (id: string) => void;
  adminUploadServiceImage: (f: File) => Promise<any>;
}

export function AdminServices(props: AdminServicesProps) {
  const { services, servicesLoading, servicesError, servicesSuccess, servicesTab, setServicesTab, editingService, actioningServiceId, serviceForm, setServiceForm, resetServiceForm, startEdit, saveService, toggleServiceActive, removeService, adminUploadServiceImage } = props;
  return (
    <div className="card admin-card" style={{ marginTop: 32, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontFamily: 'var(--sb-serif)' }}>Service catalogue</h2>
          <p style={{ margin: 4, fontSize: 13, color: 'var(--sb-grey)' }}>Create, edit or retire services. Prices are stored in the database and used at booking time.</p>
        </div>
        <button onClick={resetServiceForm} disabled={servicesLoading} className="btn btn-primary" style={{ padding: '8px 14px', fontSize: 13 }}>
          <Plus size={14} /> Add service
        </button>
      </div>

      {servicesError && <div style={{ color: 'var(--sb-danger)', marginBottom: 10, fontSize: 13 }}>{servicesError}</div>}
      {servicesSuccess && <div style={{ color: 'var(--sb-success, #16a34a)', marginBottom: 10, fontSize: 13, fontWeight: 600 }}>{servicesSuccess}</div>}

      {servicesTab === 'list' ? (
        <>
          {servicesLoading ? (
            <div style={{ padding: 20, color: 'var(--sb-grey)' }}>Loading services…</div>
          ) : services.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--sb-grey)', textAlign: 'center' }}>No services yet. Add one to get started.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--sb-border)', color: 'var(--sb-grey)' }}>
                    <th style={{ padding: '10px 8px' }}>Service</th>
                    <th style={{ padding: '10px 8px' }}>Category</th>
                    <th style={{ padding: '10px 8px' }}>Description</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Price</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center' }}>Active</th>
                    <th style={{ padding: '10px 8px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--sb-border)' }}>
                      <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 600 }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--sb-grey)', fontFamily: 'monospace' }}>{s.id}</div>
                      </td>
                      <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>{s.category}</td>
                      <td style={{ padding: '10px 8px', verticalAlign: 'top', maxWidth: 220 }}>
                        <div style={{ color: 'var(--sb-grey)', fontSize: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.description}</div>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>GH₵{Number(s.price || 0).toFixed(2)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: s.active ? 'rgba(22,163,74,0.12)' : 'rgba(148,163,184,0.25)', color: s.active ? '#16a34a' : '#64748b' }}>
                          {s.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                        <button onClick={() => startEdit(s)} className="btn btn-secondary btn-small" style={{ marginRight: 6 }} disabled={!!actioningServiceId}>Edit</button>
                        <button
                          disabled={!!actioningServiceId}
                          onClick={() => toggleServiceActive(s, !s.active)}
                          className="btn btn-secondary btn-small"
                          style={{ marginRight: 6, color: s.active ? 'var(--sb-danger)' : 'var(--sb-success, #16a34a)' }}
                        >
                          {actioningServiceId === s.id ? (s.active ? '…' : '…') : (s.active ? 'Deactivate' : 'Activate')}
                        </button>
                        <button onClick={() => removeService(s.id)} className="btn btn-secondary btn-small admin-action-muted" style={{ color: 'var(--sb-danger)' }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div style={{ maxWidth: 560 }}>
          <h3 style={{ marginTop: 0, fontSize: 16, marginBottom: 12 }}>{editingService ? 'Edit service' : 'New service'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--sb-grey)', marginBottom: 4 }}>Service ID</label>
              <input value={serviceForm.id} onChange={e => setServiceForm({ ...serviceForm, id: e.target.value })} placeholder="e.g. brow-shaping-blade" className="admin-input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--sb-grey)', marginBottom: 4 }}>Name</label>
              <input value={serviceForm.name} onChange={e => setServiceForm({ ...serviceForm, name: e.target.value })} className="admin-input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--sb-grey)', marginBottom: 4 }}>Category</label>
              <input value={serviceForm.category} onChange={e => setServiceForm({ ...serviceForm, category: e.target.value })} placeholder="Brows / Lashes" className="admin-input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--sb-grey)', marginBottom: 4 }}>Description</label>
              <textarea value={serviceForm.description} onChange={e => setServiceForm({ ...serviceForm, description: e.target.value })} rows={2} className="admin-input" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--sb-grey)', marginBottom: 4 }}>Price (GH₵)</label>
                <input type="number" value={serviceForm.price} onChange={e => setServiceForm({ ...serviceForm, price: Number(e.target.value) || 0 })} className="admin-input" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--sb-grey)', marginBottom: 4 }}>Duration (min)</label>
                <input type="number" value={serviceForm.duration} onChange={e => setServiceForm({ ...serviceForm, duration: Number(e.target.value) || 30 })} className="admin-input" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'end' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={serviceForm.photoRequired} onChange={e => setServiceForm({ ...serviceForm, photoRequired: e.target.checked })} /> <span style={{ fontSize: 12 }}>Photo required</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={serviceForm.tintGuideRequired} onChange={e => setServiceForm({ ...serviceForm, tintGuideRequired: e.target.checked })} /> <span style={{ fontSize: 12 }}>Tint guide required</span>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--sb-grey)', marginBottom: 4 }}>Image path</label>
              <input value={serviceForm.image} onChange={e => setServiceForm({ ...serviceForm, image: e.target.value })} placeholder="/images/.../01.jpg" className="admin-input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--sb-grey)', marginBottom: 4 }}>Primary image upload</label>
              <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const r = await adminUploadServiceImage(f); if (r.ok && r.url) setServiceForm((prev: any) => ({...prev, image: r.url as string})); }} />
              {serviceForm.image && <img src={serviceForm.image} alt="preview" style={{ width: 120, marginTop: 8, borderRadius: 8 }} />}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--sb-grey)', marginBottom: 4 }}>Display order</label>
              <input type="number" value={serviceForm.sortOrder} onChange={e => setServiceForm({ ...serviceForm, sortOrder: Number(e.target.value) || 0 })} className="admin-input" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--sb-grey)', marginBottom: 4 }}>Gallery images</label>
              <input type="file" accept="image/*" multiple onChange={async (e) => { const fs = Array.from(e.target.files || []); for (const f of fs) { const r = await adminUploadServiceImage(f); if (r.ok && r.url) setServiceForm((prev: any) => ({...prev, gallery: [...prev.gallery, r.url as string]})); } }} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {serviceForm.gallery.map((g: string, i: number) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={g} alt="gallery" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6 }} />
                    <button type="button" onClick={() => setServiceForm((prev: any) => ({...prev, gallery: prev.gallery.filter((_: any, j: number) => j !== i)}))} style={{ position: 'absolute', top: 2, right: 2 }}>x</button>
                    <button type="button" onClick={() => setServiceForm((prev: any) => ({...prev, image: g, gallery: prev.gallery.filter((_: any, j: number) => j !== i)}))} style={{ display: 'block', fontSize: 10 }}>Make primary</button>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'end', gap: 8 }}>
              <button onClick={saveService} disabled={servicesLoading} className="btn btn-primary">Save</button>
              <button onClick={resetServiceForm} className="btn btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default AdminServices;
