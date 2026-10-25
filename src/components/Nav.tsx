import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Menu, X, ArrowRight, Mail, Phone, Instagram, Shield } from 'lucide-react';
import { AdminPanel } from './admin/AdminPanel';
import { business } from '../config';
const LINKS = [

  { to: '/', label: 'Home' },

  { to: '/services', label: 'Services' },

  { to: '/guide', label: 'Pre-appointment guide' },

];



export function Nav() {

  const location = useLocation();

  const navigate = useNavigate();

  const [open, setOpen] = useState(false);

  const [showAdmin, setShowAdmin] = useState(false);



  const close = () => setOpen(false);



  useEffect(() => {

    const handleKey = (e: KeyboardEvent) => {

      if (e.key === 'Escape') close();

    };

    window.addEventListener('keydown', handleKey);

    return () => window.removeEventListener('keydown', handleKey);

  }, [close]);



  return (

    <>

      <a href="#content" className="skip-link">

        Skip to content

      </a>



      <header className="header" aria-label="Site header">

        <div className="header-inner">

          <Link

            to="/"

            className="header-brand"

            onClick={() => {

              navigate('/');

              close();

            }}

            aria-label="StyledByC home"

          >

            <img src="/styledbyC.png" alt="StyledByC" />

          </Link>



          <nav className="header-nav" aria-label="Main navigation">

            {LINKS.map((link) => (

              <Link

                key={link.to}

                to={link.to}

                aria-current={location.pathname === link.to ? 'page' : undefined}

                onClick={close}

              >

                {link.label}

              </Link>

            ))}

          </nav>



          <button



            aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}

            aria-expanded={open}

            aria-controls="mobile-nav"

            onClick={() => setOpen((p) => !p)}

          >

            {open ? <X size={22} /> : <Menu size={22} />}

          </button>

        </div>

      </header>



      <nav className={`mobile-nav ${open ? 'open' : ''}`} id="mobile-nav">

        <button

          className="mobile-nav-close"

          aria-label="Close navigation menu"

          onClick={close}

        >

          <X size={22} />

        </button>

        <nav aria-label="Mobile navigation">

          {LINKS.map((link) => (

            <Link

              key={link.to}

              to={link.to}

              aria-current={location.pathname === link.to ? 'page' : undefined}

              onClick={close}

            >

              {link.label}

            </Link>

          ))}

        </nav>

        <div className="mobile-nav-book">

          <a href={`mailto:${business.email}`} className="btn-link">

            <Mail size={14} /> Contact us

          </a>

          <Link to="/book" className="btn btn-primary" onClick={close}>

            Book an appointment <ArrowRight size={15} />

          </Link>

          {business.instagramUrl && (

            <a

              href={business.instagramUrl}

              target="_blank"

              rel="noopener noreferrer"

              className="btn-link"

              style={{ marginTop: 12, display: 'inline-flex' }}

            >

              <Instagram size={14} /> Instagram

            </a>

          )}

          <a

            href={`tel:${business.phone.replace(/\s/g, '')}`}

            className="btn-link"

            style={{ marginTop: 8, display: 'inline-flex' }}

          >

            <Phone size={14} /> Call us

          </a>

        </div>

      </nav>





      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}

    </>

  );

}



