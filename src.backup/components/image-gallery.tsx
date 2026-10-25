import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type TouchEvent,
} from 'react';
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';

type Props = {
  images: string[];
  altBase: string;
  emptyLabel?: string;
  emptySublabel?: string;
};

/**
 * Reusable, accessible, touch-friendly image gallery.
 *
 * - Multiple images with prev/next arrows and dot indicators.
 * - Keyboard accessible (arrow keys, tabbable controls).
 * - Touch / swipe support on mobile.
 * - Graceful empty state and broken-image fallback.
 * - Uses root-relative paths (Vite public assets).
 *
 * To add more photos later: append the path to the service's `gallery`
 * array in src/config.ts. No component redesign needed.
 */
export default function ImageGallery({
  images,
  altBase,
  emptyLabel = 'No service photos yet',
  emptySublabel = 'Client photos will be added here soon.',
}: Props) {
  const [index, setIndex] = useState(0);
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const touchStart = useRef<number | null>(null);
  const list = images.filter((src) => src && !broken.has(src));

  const prev = useCallback(() => {
    setIndex((i) => (list.length ? (i - 1 + list.length) % list.length : 0));
  }, [list.length]);

  const next = useCallback(() => {
    setIndex((i) => (list.length ? (i + 1) % list.length : 0));
  }, [list.length]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
  };

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStart.current = e.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStart.current == null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStart.current;
    const delta = touchStart.current - endX;
    if (delta > 50) next();
    if (delta < -50) prev();
    touchStart.current = null;
  };

  // Reset index when the usable list shrinks (e.g. broken image removed).
  useEffect(() => {
    if (index >= list.length) setIndex(0);
  }, [list.length, index]);

  if (list.length === 0) {
    return (
      <div className="gallery-empty" role="status">
        <ImageOff size={28} />
        <div>
          <h3>{emptyLabel}</h3>
          <p>{emptySublabel}</p>
        </div>
      </div>
    );
  }

  const src = list[index];
  const alt = `${altBase} — image ${index + 1} of ${list.length}`;

  return (
    <div
      className="gallery"
      role="region"
      aria-label={`${altBase} image gallery`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="gallery-stage">
        <img
          className="gallery-img"
          src={src}
          alt={alt}
          loading={index === 0 ? 'eager' : 'lazy'}
          onError={() => setBroken((b) => new Set(b).add(src))}
        />
      </div>

      {list.length > 1 && (
        <>
          <button
            type="button"
            className="gallery-nav prev"
            aria-label="Previous image"
            onClick={prev}
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            className="gallery-nav next"
            aria-label="Next image"
            onClick={next}
          >
            <ChevronRight size={22} />
          </button>

          <div className="gallery-dots" role="tablist" aria-label="Image selector">
            {list.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Image ${i + 1}`}
                className={i === index ? 'dot active' : 'dot'}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}