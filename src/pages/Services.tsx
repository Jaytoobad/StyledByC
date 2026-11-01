import { useMemo, useState } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ServiceCard } from '../components/ServiceCard';
import { money } from '../lib/money';
import { SectionHeading } from '../components/SectionHeading';

type Svc = { id: string; name: string; category: string; description: string; price: number; duration: number; photoRequired?: boolean; tintGuideRequired?: boolean; image: string; gallery: string[]; active?: boolean };

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
        return data;
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
            <ServiceCard
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
      </div>
    </main>
  );
}
