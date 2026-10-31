import { useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  Navigate,
} from 'react-router-dom';
import { Nav } from './components/Nav';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
import { Services } from './pages/Services';
import { Guide } from './pages/Guide';
import { BookingFlow } from './components/BookingFlow';
import { Confirmation } from './pages/Confirmation';
import { Admin } from './pages/Admin';
import { Pay } from './pages/Pay';
import { NotFound } from './pages/NotFound';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    let meta = document.querySelector('meta[name="robots"]');
      if (pathname === '/admin' || pathname.startsWith('/admin') || pathname.startsWith('/pay')) {
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'robots');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', 'noindex,nofollow');
    } else if (meta) {
      meta.remove();
    }
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/services" element={<Services />} />
        <Route path="/guide" element={<Guide />} />
        <Route path="/book" element={<BookingFlow />} />
        <Route path="/book/:serviceId" element={<BookingFlow />} />
        <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />
        <Route path="/admin/:section" element={<Admin />} />
        <Route path="/pay/:ref" element={<Pay />} />
        <Route path="/booking-confirmation" element={<Confirmation />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  );
}
