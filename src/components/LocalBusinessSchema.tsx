import { business } from '../config';

export function LocalBusinessSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': 'https://www.styledbyc.beauty/#business',
    name: business.name,
    image: 'https://www.styledbyc.beauty/styledbyC.png',
    description:
      'Considered brow treatments designed to complement your natural features. Book your appointment online.',
    telephone: business.phone,
    email: business.email,
    priceRange: 'GHS 100\u2013GHS 400',
    url: 'https://www.styledbyc.beauty/',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Teshie Nungua Estate',
      addressRegion: 'Greater Accra',
      addressCountry: 'GH',
    },
    geo: {
      '@type': 'GeoCoordinates',
    },
    openingHours: 'Mo,Tu,We,Th,Fr,Sa 09:00\u201317:00',
    serviceType: 'Brow treatments',
    areaServed: {
      '@type': 'City',
      name: 'Accra',
    },
    sameAs: [business.instagramUrl],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
