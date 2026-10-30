import { useNavigate } from 'react-router-dom';
import { Mail, Phone, Instagram } from 'lucide-react';
import { business } from '../config';

const YEAR = new Date().getFullYear();

export function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="footer" aria-label="Site footer">
      <div className="container">
        <div className="footer-cols">
          <div className="footer-col footer-brand">
            <button
              type="button"
              className="footer-brand-btn"
              onClick={() => navigate('/')}
            >
              <img
                src="/styledbyC.png"
                alt="StyledByC"
                loading="lazy"
              />
            </button>
            <span className="footer-descriptor">{business.descriptor}</span>
          </div>

          <div className="footer-col">
            <h4>Explore</h4>
            <ul>
              <li>
                <a
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/services');
                  }}
                >
                  Services
                </a>
              </li>
                <li>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/book');
                    }}
                    className="footer-link"
                  >
                    Book an appointment
                  </button>
                </li>
              <li>
                <a
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/guide');
                  }}
                >
                  Pre-appointment guide
                </a>
              </li>
            </ul>
          </div>

          <div className="footer-col footer-contact">
            <h4>Contact</h4>
            <p>
              <a href={`mailto:${business.email}`}>
                <Mail size={14} /> {business.email}
              </a>
            </p>
            <p>
              <a href={`tel:${business.phone.replace(/\s/g, '')}`}>
                <Phone size={14} /> {business.phone}
              </a>
            </p>
            {business.instagramUrl && (
              <p>
                <a
                  href={business.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Instagram size={14} /> Instagram
                </a>
              </p>
            )}
          </div>

          <div className="footer-col">
            <h4>Visit</h4>
            <p>{business.location}</p>
            <p>{business.hours}</p>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="footer-bottom-left">
            &copy; {YEAR} {business.name}
          </div>
          <div className="footer-bottom-right">
            {business.instagramUrl && (
              <a
                href={business.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
