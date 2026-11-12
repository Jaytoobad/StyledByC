import { useMemo, useState } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ServiceListing } from '../components/ServiceListing';
import ImageGallery from '../components/image-gallery';
import { money } from '../lib/money';
import { SectionHeading } from '../components/SectionHeading';
import { services } from '../config';

type Svc = { id: string; name: string; category: string; description: string; price: number; duration: number; photoRequired?: boolean; tintGuideRequired?: boolean; image: string; gallery: string[]; active?: boolean };

const LAMINATION_SERVICE_ID = 'brow-lamination-hybrid-tint';

export function Services() {
  useEffect(() => {
    document.title = 'Services — StyledByC';
  }, []);
  const navigate = useNavigate();
  const [filter, setFilter] = useState('All');
  const [list, setList] = useState<Svc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/services')
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok || !data || !Array.isArray(data.services)) {
          throw new Error(typeof data?.error === 'string' ? data.error : 'Could not load services.');
        }
        return {
          ...data,
          services: data.services.filter((service: Svc) => service.category === 'Brows'),
        };
      })
      .then((d) => {
        if (!cancelled) setList(d.services);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load services.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(list.map((s) => s.category)))],
    [list]
  );
  const listed = useMemo(
    () => list.filter((s) => s.active !== false && (filter === 'All' || s.category === filter)),
    [list, filter]
  );

  const laminationService = services.find((s) => s.id === LAMINATION_SERVICE_ID);
  const laminationGallery = laminationService ? laminationService.gallery : [];

  return (
    <main className="services-page" id="content">
      <div className="container">
        <SectionHeading eyebrow="The service menu">
          Considered care.<br /><em>Beautiful detail.</em>
        </SectionHeading>
        <p style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto var(--sb-space-6)' }}>
          Explore the treatments and choose the one that feels right for you.
        </p>

        <div className="services-filters">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`filter-chip ${filter === cat ? 'active' : ''}`}
              onClick={() => setFilter(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading && <p role="status" style={{ textAlign: 'center' }}>Loading services…</p>}
        {!loading && loadError && <p role="alert" style={{ textAlign: 'center', color: '#b00020' }}>{loadError}</p>}
        {!loading && !loadError && <div className="services-grid">
          {listed.map((s) => (
            <ServiceListing
              key={s.id}
              s={s as any}
              onBook={(id) => navigate(`/book?service=${id}`)}
            />
          ))}
          {listed.length === 0 && (
            <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--sb-grey)' }}>
              No services in this category.
            </p>
          )}
        </div>}

        {laminationGallery.length > 0 && (
          <section className="services-previous-work" style={{ marginTop: 'var(--sb-space-8)' }}>
            <div className="container">
              <SectionHeading eyebrow="Previous work">
                Brow lamination &amp; hybrid tint transformations.
              </SectionHeading>
              <div style={{ marginBottom: 'var(--sb-space-6)' }}>
                <ImageGallery
                  images={laminationGallery}
                  altBase="Brow lamination &amp; hybrid tint"
                  emptyLabel="No previous work photos yet."
                  className="services-previous-work-gallery"
                  autoPlay={true}
                  interval={5000}
                  passport={true}
                  imageRotation={{
                    '/images/brow-lamination-hybrid-tint/01.jpg': 90,
                    '/images/brow-lamination-hybrid-tint/03.jpg': 90,
                  }}
                />
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
