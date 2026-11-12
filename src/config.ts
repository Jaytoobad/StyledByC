// StyledByC — Single source of truth for services and business settings.
//
// The owner confirmed the current service catalogue and fixed reservation fee.

export const business = {
  name: 'StyledByC',
  descriptor: 'BROW ATELIER',
  email: 'freemancedil69@gmail.com',
  phone: '+233 20 565 7974',
  instagramUrl: 'https://www.instagram.com/styledbyc____/',
  // TODO(owner): confirm real working hours.
  location: 'Teshie Nungua Estate',
  hours: 'Mon–Sat 09:00–17:00 (by appointment)',
};

export const WHATSAPP_ONLY_SERVICE_ID = 'brow-shaping-blade';
export const SERVICE_IMAGE_PLACEHOLDER = '/images/admin-image-placeholder.svg';

export function isWhatsAppOnlyService(serviceId: string): boolean {
  return serviceId === WHATSAPP_ONLY_SERVICE_ID;
}

export type Service = {
  id: string;
  name: string;
  category: 'Brows';
  description: string;
  price: number;
  duration: number; // minutes
  photoRequired?: boolean;
  tintGuideRequired?: boolean;
  image: string; // fallback hero image used when no gallery photos exist
  gallery: string[]; // root-relative paths to real service photos
};

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
    image: '',
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
    image: '',
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
    image: '',
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
    image: '',
    gallery: [],
  },
];

// Business settings.
// openingDays: 1=Mon ... 6=Sat, 0=Sun (closed).
// Reservation fee is set to the fixed GH100 deposit used across the booking flow.
export const settings = {
  reservationFee: 100,
  feeCountsTowardTotal: false,
  openingDays: [1, 2, 3, 4, 5, 6],
  openingTime: '09:00',
  closingTime: '17:00',
  slotIntervalMinutes: 30,
  demoMode: false,
};

// PAYMENT CONFIGURATION (Paystack)
// ---------------------------------------------------------------------------
// Deposit settings: make it easy to change.
// Default: 50% of total, with optional minimum amount (in GHS).
export const paymentConfig = {
  // Percentage of total to pay as deposit (0-100). Default 50%.
  depositPercentage: 50,
  // Minimum deposit amount in GHS. If calculated deposit < this, use this amount (optional).
  // Set to 0 to disable minimum.
  minimumDepositAmount: 0,
  // Currency
  currency: 'GHS',
};

// Get Paystack public key from environment variable (NEVER put secret key here)
export function getPaystackPublicKey(): string {
  const env = (import.meta as any).env ?? {};
  return env.VITE_PAYSTACK_PUBLIC_KEY || env.PAYSTACK_PUBLIC_KEY || '';
}

// NOTE: Booking submissions are handled by the same-origin /api/bookings
// route (Vercel serverless function), which validates and records bookings
// directly (Neon + Vercel Blob). No frontend configuration is required.