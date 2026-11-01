import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import ImageGallery from './image-gallery';
import { money } from '../lib/money';
import { business, isWhatsAppOnlyService, SERVICE_IMAGE_PLACEHOLDER, services } from '../config';
import { createWhatsAppUrl } from '../lib/whatsapp';

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
        {s.gallery && (s.gallery.length > 1 || s.gallery[0] === SERVICE_IMAGE_PLACEHOLDER) ? (
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
        {isWhatsAppOnlyService(s.id) ? (
          <a
            className="btn btn-primary"
            href={createWhatsAppUrl(
              business.phone,
              `Hi StyledByC, I'm interested in ${s.name}. Please let me know how to book.`,
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            Book via WhatsApp <ArrowRight size={14} />
          </a>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => {
              onBook(s.id);
              navigate(`/book?service=${s.id}`);
            }}
          >
            Book this service <ArrowRight size={14} />
          </button>
        )}
      </div>
    </article>
  );
}
