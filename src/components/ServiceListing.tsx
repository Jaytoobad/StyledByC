import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { money } from '../lib/money';
import { business, isWhatsAppOnlyService, WHATSAPP_ONLY_SERVICE_ID } from '../config';
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
  active?: boolean;
};

interface Props {
  s: Service;
  onBook: (id: string) => void;
}

export function ServiceListing({ s, onBook }: Props) {
  const navigate = useNavigate();

  const handleBook = () => {
    onBook(s.id);
    navigate(`/book?service=${s.id}`);
  };

  return (
    <article className="service-listing">
      <div className="service-listing-body">
        <div className="service-listing-meta">
          <span className="service-listing-category">{s.category}</span>
          <span className="service-listing-duration">{s.duration} min</span>
        </div>
        <h3 className="service-listing-name">{s.name}</h3>
        <p className="service-listing-description">{s.description}</p>
        <div className="service-listing-price">{money(s.price)}</div>
        {s.id === WHATSAPP_ONLY_SERVICE_ID ? (
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
          <button className="btn btn-primary" type="button" onClick={handleBook}>
            Book now <ArrowRight size={14} />
          </button>
        )}
      </div>
    </article>
  );
}
