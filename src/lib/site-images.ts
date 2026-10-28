import { useEffect, useState } from 'react';

export type SiteImageSlot = {
  slotKey: string;
  defaultSrc?: string;
  alt?: string;
};

export const SITE_IMAGE_SLOTS: SiteImageSlot[] = [
  { slotKey: 'home-hero', defaultSrc: '/images/Hero%20Section/001.jpg', alt: 'StyledByC brow lamination and hybrid tint result' },
  { slotKey: 'home-guide-teaser', defaultSrc: '/images/Guide%20Teaser/001.jpg', alt: 'StyledByC pre-appointment brow care' },
  { slotKey: 'service-slideshow-default', defaultSrc: '/images/brow-shaping-blade/placeholder.svg', alt: 'StyledByC service' },
];

export function useSiteImages() {
  const [map, setMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/site-images')
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (data.ok && Array.isArray(data.images)) {
          const m: Record<string, string> = {};
          for (const img of data.images) {
            if (img.slotKey && img.blobUrl) m[img.slotKey] = img.blobUrl;
          }
          setMap(m);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { images: map, loading };
}

export function getSiteImageSrc(images: Record<string, string>, slotKey: string, fallback?: string): string {
  if (images[slotKey]) return images[slotKey];
  if (fallback) return fallback;
  return '';
}

export function emptyImagePlaceholder(): string {
  // Return a simple SVG data URI as placeholder text - but we need to display text; components will handle
  return '';
}
