import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import ImageGallery from './image-gallery';
import { money } from '../lib/money';
import { services } from '../config';

export type Service = (typeof services)[number];

interface Props {
  s: Service;
  onBook: (id: string) => void;
}
export function ServiceCard({ s, onBook }: Props) {
  const navigate = useNavigate();

  return (
    <article className="card">
      <div className="card-image">
        {s.gallery && s.gallery.length > 1 ? (
          <ImageGallery
            images={s.gallery}
            altBase={s.name}
            className="card-gallery"
          />
        ) : (
          <img
            src={s.image}
            alt={s.name}
            loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/images/brow-shaping-blade/placeholder.svg'; }}
          />
        )}
      </div>
      <div className="card-body">
        <div className="card-meta">
          <span className="card-category">{s.category}</span>
          <span className="card-duration">{s.duration} min</span>
        </div>
        <h3>{s.name}</h3>
        <div className="card-price">{money(s.price)}</div>
        <p>{s.description}</p>
        <button
          className="btn btn-primary"
          onClick={() => {
            onBook(s.id);
            navigate(`/book?service=${s.id}`);
          }}
        >
          Book this service <ArrowRight size={14} />
        </button>
      </div>
    </article>
  );
}
