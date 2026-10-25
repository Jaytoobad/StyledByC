import { useMemo, useState } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { services } from '../config';
import { ServiceCard } from '../components/ServiceCard';
import { money } from '../lib/money';

export function Services() {
  useEffect(() => {
    document.title = 'Services — StyledByC';
  }, []);
  const navigate = useNavigate();
  const [filter, setFilter] = useState('All');

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(services.map((s) => s.category)))],
    []
  );
  const listed = useMemo(
    () =>
      services.filter((s) => filter === 'All' || s.category === filter),
    [filter]
  );

  return (
    <main className="services-page" id="content">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">The service menu</div>
          <h2>Considered care.<br /><em>Beautiful detail.</em></h2>
          <p>
            Explore the treatments and choose the one that feels right for you.
          </p>
        </div>

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

        <div className="services-grid">
          {listed.map((s) => (
            <ServiceCard
              key={s.id}
              s={s}
              onBook={(id) => navigate(`/book?service=${id}`)}
            />
          ))}
          {listed.length === 0 && (
            <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#6d665e' }}>
              No services in this category.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
