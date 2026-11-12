import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import ImageGallery from './image-gallery';
import { money } from '../lib/money';
import { business, isWhatsAppOnlyService, SERVICE_IMAGE_PLACEHOLDER } from '../config';
import { createWhatsAppUrl } from '../lib/whatsapp';

export type Service = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  duration: number;
  photoRequired?: boolean;
  tintGuideRequired?: boolean;
  image: string;
  gallery: string[];
  active?: boolean;
};

interface Props {
  s: Service;
  onBook: (id: string) => void;
}
export function ServiceCard({ s, onBook }: Props) {
  const navigate = useNavigate();

  return (
    <article className="card">
      <div className="card-image">
        {s.gallery && (s.gallery.length > 1 || s.gallery.some((image) => image === SERVICE_IMAGE_PLACEHOLDER)) ? (
          <ImageGallery
            images={s.gallery}
            altBase={s.name}
            emptyLabel="Admin Will Add An Image Soon"
            className="card-gallery"
          />
        ) : (
          <img
            src={s.image}
            alt={s.name}
            loading="lazy"
            width={400}
            height={500}
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = SERVICE_IMAGE_PLACEHOLDER; }}
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
