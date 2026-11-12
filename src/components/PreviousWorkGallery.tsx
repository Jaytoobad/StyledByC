import { useEffect, useState } from 'react';
import ImageGallery from './image-gallery';
import { SectionHeading } from './SectionHeading';
import { useSiteImages } from '../lib/site-images';

export function PreviousWorkGallery() {
  const { galleries, loading } = useSiteImages();
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    if (loading) return;
    const imgs = galleries['previous-work'] || [];
    setImages(imgs);
  }, [galleries, loading]);

  return (
    <section className="previous-work">
      <div className="container">
        <SectionHeading eyebrow="Previous work">
          Real results, <em>real clients.</em>
        </SectionHeading>
        <p className="previous-work-intro">
          A selection of brow treatments completed at StyledByC. New work is added regularly.
        </p>
        {images.length === 0 ? (
          <div className="gallery-empty" role="status" aria-label="No previous work images available">
            <span className="gallery-mono">W</span>
            <div className="gallery-empty-label">Previous work gallery</div>
            <p>No previous work images have been uploaded yet. The gallery will appear here once the artist adds her photographs.</p>
          </div>
        ) : (
          <ImageGallery images={images} altBase="StyledByC previous work" className="previous-work-gallery" autoPlay={true} interval={5000} compact={true} />
        )}
      </div>
    </section>
  );
}
