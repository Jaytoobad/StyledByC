import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Nav } from './components/Nav';
import { Footer } from './components/Footer';

const Home = lazy(() => import('./pages/Home').then((module) => ({ default: module.Home })));
const Services = lazy(() =>
  import('./pages/Services').then((module) => ({ default: module.Services })),
);
const Guide = lazy(() => import('./pages/Guide').then((module) => ({ default: module.Guide })));
const BookingFlow = lazy(() =>
  import('./components/BookingFlow').then((module) => ({ default: module.BookingFlow })),
);
const Confirmation = lazy(() =>
  import('./pages/Confirmation').then((module) => ({ default: module.Confirmation })),
);
const Admin = lazy(() => import('./pages/Admin').then((module) => ({ default: module.Admin })));
const Pay = lazy(() => import('./pages/Pay').then((module) => ({ default: module.Pay })));
const MyBookings = lazy(() =>
  import('./pages/MyBookings').then((module) => ({ default: module.MyBookings })),
);
const NotFound = lazy(() =>
  import('./pages/NotFound').then((module) => ({ default: module.NotFound })),
);
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    let meta = document.querySelector('meta[name="robots"]');

    if (
      pathname === '/admin' ||
      pathname.startsWith('/admin') ||
      pathname.startsWith('/pay') ||
      pathname.startsWith('/checkout')
    ) {
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'robots');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', 'noindex,nofollow');
    } else if (meta) {
      meta.remove();
    }

    // Set canonical URL for the current route
    const publicRoutes: Record<string, string> = {
      '/': 'https://www.styledbyc.beauty/',
      '/services': 'https://www.styledbyc.beauty/services',
      '/guide': 'https://www.styledbyc.beauty/guide',
      '/book': 'https://www.styledbyc.beauty/book',
      '/my-bookings': 'https://www.styledbyc.beauty/my-bookings',
      '/booking-confirmation': 'https://www.styledbyc.beauty/booking-confirmation',
    };
    let canonicalUrl: string | undefined;
    if (publicRoutes[pathname]) {
      canonicalUrl = publicRoutes[pathname];
    } else if (pathname.startsWith('/book/')) {
      canonicalUrl = `https://www.styledbyc.beauty${pathname}`;
    } else if (pathname.startsWith('/pay/')) {
      canonicalUrl = `https://www.styledbyc.beauty${pathname}`;
    } else if (pathname.startsWith('/checkout/')) {
      canonicalUrl = `https://www.styledbyc.beauty${pathname}`;
    }
    if (canonicalUrl) {
      let link = document.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', canonicalUrl);
    }
  }, [pathname]);
  return null;
}

function AppShell() {
  const { pathname } = useLocation();
  const hideFooter =
    pathname === '/admin' ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/pay') ||
    pathname.startsWith('/checkout');

  return (
    <>
      <ScrollToTop />
      <Nav />
      <Suspense
        fallback={
          <div className="route-loading" role="status">
            Loading page…
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/services" element={<Services />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/book" element={<BookingFlow />} />
          <Route path="/book/:serviceId" element={<BookingFlow />} />
          <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />
          <Route path="/admin/:section" element={<Admin />} />
          <Route path="/pay/:ref" element={<Pay />} />
          <Route path="/checkout/:ref" element={<Pay />} />
          <Route path="/my-bookings" element={<MyBookings />} />
          <Route path="/booking-confirmation" element={<Confirmation />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      {!hideFooter && <Footer />}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
