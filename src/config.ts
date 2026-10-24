// StyledByC — Single source of truth for services and business settings.
// Prices below are the client-approved values. Do not edit without client confirmation.

export const business = {
  name: 'StyledByC',
  descriptor: 'LASH & BROW ATELIER',
  email: 'freemancedil8@gmail.com',
  phone: '+233 20 565 7974',
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

// Service durations are NOT confirmed by the client. They are set to sensible
// defaults so the booking UI can function. Flag for client approval before launch.
const DURATION_BROW_SHAPE = 30;
const DURATION_BROW_WAX = 20;
const DURATION_LAMINATION_TINT = 60;
const DURATION_LAMINATION_ONLY = 45;
const DURATION_TINT_ALONE = 30;

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
    image: '/images/brow-shaping-blade/placeholder.svg',
    gallery: [],
  },
  {
    id: 'brow-wax',
    name: 'Brow Wax',
    category: 'Brows',
    description:
      'Remove unwanted hairs and clean up the shape for smooth, polished brows.',
    price: 100,
    duration: DURATION_BROW_WAX,
    image: '/images/brow-wax/placeholder.svg',
    gallery: [],
  },
  {
    id: 'brow-lamination-hybrid-tint',
    name: 'Brow Lamination & Hybrid Tint',
    category: 'Brows',
    description:
      'The ultimate brow transformation — lamination lifts and sets your brows, while tint adds depth and definition for a fuller, flawless finish.',
    price: 290,
    duration: DURATION_LAMINATION_TINT,
    photoRequired: true,
    tintGuideRequired: true,
    image: '/images/brow lamination hybrid tint/01.jpg.jpeg',
    gallery: [
      '/images/brow lamination hybrid tint/01.jpg.jpeg',
      '/images/brow lamination hybrid tint/02.jpg.jpeg',
      '/images/brow lamination hybrid tint/03.jpg.jpeg',
      '/images/brow lamination hybrid tint/04.jpg.jpeg',
      '/images/brow lamination hybrid tint/05.jpg.jpeg',
      '/images/brow lamination hybrid tint/06.jpg.jpeg',
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
    image: '/images/lamination-only/placeholder.svg',
    gallery: [],
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
    image: '/images/hybrid-tint-alone/placeholder.svg',
    gallery: [],
  },
];

// Business settings.
// openingDays: 1=Mon ... 6=Sat, 0=Sun (closed).
// reservationFee: NOT confirmed by the client. Flag for approval before launch.
export const settings = {
  reservationFee: 0,
  feeCountsTowardTotal: false,
  openingDays: [1, 2, 3, 4, 5, 6],
  openingTime: '09:00',
  closingTime: '17:00',
  slotIntervalMinutes: 30,
  demoMode: true,
};

// Backend endpoint. Leave empty until the Google Apps Script web app is deployed.
// Set via VITE_BOOKING_API_URL env or update this string before production build.
export const API_URL = '';