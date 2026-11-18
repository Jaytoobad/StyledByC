import { useEffect, useState } from 'react';

export type SiteImageSlot = {
  slotKey: string;
  defaultSrc?: string;
  alt?: string;
};

export const SITE_IMAGE_SLOTS: SiteImageSlot[] = [
  { slotKey: 'previous-work', defaultSrc: '', alt: 'StyledByC previous work' },
];

export function useSiteImages() {
  const [map, setMap] = useState<Record<string, string>>({});
  const [galleries, setGalleries] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/site-images')
      .then(async (r) => {
        const data = await r.json().catch((error) => {
          console.error('[site-images] response was not valid JSON:', error);
          return {};
        });
        if (cancelled) return;
        if (data.ok && Array.isArray(data.images)) {
          const m: Record<string, string> = {};
          const g: Record<string, string[]> = {};
          for (const img of data.images) {
            if (img.slotKey && img.blobUrl) {
              m[img.slotKey] = img.blobUrl;
              if (!g[img.slotKey]) g[img.slotKey] = [];
              g[img.slotKey].push(img.blobUrl);
            }
          }
          for (const key of Object.keys(g)) {
            g[key].sort();
          }
          setMap(m);
          setGalleries(g);
        }
      })
      .catch((error) => {
        console.error('[site-images] could not load site images:', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { images: map, galleries, loading };
}

export function getGalleryImages(images: Record<string, string[]>, slotKey: string): string[] {
  return images[slotKey] || [];
}

export function getSiteImageSrc(
  images: Record<string, string>,
  slotKey: string,
  fallback?: string,
): string {
  if (images[slotKey]) return images[slotKey];
  if (fallback) return fallback;
  return '';
}

export function emptyImagePlaceholder(): string {
  // Return a simple SVG data URI as placeholder text - but we need to display text; components will handle
  return '';
}
