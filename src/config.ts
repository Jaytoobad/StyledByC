// StyledByC — Single source of truth for services and business settings.
//
// IMPORTANT: prices, durations, reservation fee, hours and the Instagram URL
// below are sample/demo values. Confirm all of them with the client before
// launch. Do not invent prices, hours or policies — use the placeholders and
// TODO flags so the owner can supply real content.

export const business = {
  name: 'StyledByC',
  descriptor: 'LASH & BROW ATELIER',
  email: 'freemancedil69@gmail.com',
  phone: '+233 20 565 7974',
  // TODO(owner): supply the real Instagram URL. The footer link stays hidden
  // until this is set to a non-empty value.
  instagramUrl: '',
  // TODO(owner): supply real working hours and location text.
  location: 'Teshie Nungua Estates, 37 Coffee Street, Accra, Ghana',
  hours: 'Monâ€“Sat 09:00â€“17:00 (by appointment)',
};

export type Service = {
  id: string;
  name: string;
  category: 'Brows' | 'Lashes';
  description: string;
  price: number;
  duration: number; // minutes — CONFIRM WITH CLIENT before launch
  photoRequired?: boolean;
  tintGuideRequired?: boolean;
  image: string; // fallback hero image used when no gallery photos exist
  gallery: string[]; // root-relative paths to real service photos
};

// TODO(owner): service durations are sensible defaults — confirm before launch.
const DURATION_BROW_SHAPE = 30;
const DURATION_BROW_WAX = 20;
const DURATION_LAMINATION_TINT = 60;
const DURATION_LAMINATION_ONLY = 45;
const DURATION_TINT_ALONE = 30;

// TODO(owner): prices below are sample values — verify with the client.
export const services: Service[] = [
  {
    id: 'brow-shaping-blade',
    name: 'Brow Shaping (Blade)',
    category: 'Brows',
    description:
      'Shape, define and clean up your brows with precision blade technique for a sharp, natural look.',
    price: 60,
    duration: DURATION_BROW_SHAPE,
    photoRequired: true,
    image: '/images/brow-shaping-blade/01.jpg',
    gallery: ['/images/brow-shaping-blade/01.jpg', '/images/brow-shaping-blade/02.jpg'],
  },
  {
    id: 'brow-wax',
    name: 'Brow Wax',
    category: 'Brows',
    description:
      'Remove unwanted hairs and clean up the shape for smooth, polished brows.',
    price: 100,
    duration: DURATION_BROW_WAX,
    image: '/images/brow wax/01.jpg',
    gallery: ['/images/brow wax/01.jpg', '/images/brow wax/02.jpg'],
  },
  {
    id: 'brow-lamination-hybrid-tint',
    name: 'Brow Lamination & Hybrid Tint',
    category: 'Brows',
    description:
      'The ultimate brow transformation â€” lamination lifts and sets your brows, while tint adds depth and definition for a fuller, flawless finish.',
    price: 290,
    duration: DURATION_LAMINATION_TINT,
    photoRequired: true,
    tintGuideRequired: true,
    image: '/images/brow-lamination-hybrid-tint/01.jpg',
    gallery: [
      '/images/brow-lamination-hybrid-tint/01.jpg',
      '/images/brow-lamination-hybrid-tint/02.jpg',
      '/images/brow-lamination-hybrid-tint/03.jpg',
      '/images/brow-lamination-hybrid-tint/04.jpg',
      '/images/brow-lamination-hybrid-tint/06.jpg',
    ],
  },
  {
    id: 'lamination-only',
    name: 'Lamination Only',
    category: 'Brows',
    description:
      'Lamination lifts and sets your natural brows in place, creating a fuller, fluffier, well-groomed look.',
    price: 250,
    duration: DURATION_LAMINATION_ONLY,
    image: '/images/lamination only/01.jpg',
    gallery: ['/images/lamination only/01.jpg', '/images/lamination only/02.jpg'],
  },
  {
    id: 'hybrid-tint-alone',
    name: 'Hybrid Tint Alone',
    category: 'Brows',
    description:
      'Tint adds color and definition to your brows, enhancing their shape and making them look fuller and more defined.',
    price: 150,
    duration: DURATION_TINT_ALONE,
    tintGuideRequired: true,
    image: '/images/hybrid-tint-alone/01.jpg',
    gallery: ['/images/hybrid-tint-alone/01.jpg', '/images/hybrid-tint-alone/02.jpg'],
  },
];

// Business settings.
// openingDays: 1=Mon ... 6=Sat, 0=Sun (closed).
// TODO(owner): reservation fee is a sample value — confirm before launch.
export const settings = {
  reservationFee: 0,
  feeCountsTowardTotal: false,
  openingDays: [1, 2, 3, 4, 5, 6],
  openingTime: '09:00',
  closingTime: '17:00',
  slotIntervalMinutes: 30,
  demoMode: true,
};

// NOTE: Booking submissions are handled by the same-origin /api/bookings
// route (Vercel serverless function). That function forwards the payload to
// the Google Apps Script web app using the server-side APPS_SCRIPT_URL
// environment variable. No frontend configuration is required here.
