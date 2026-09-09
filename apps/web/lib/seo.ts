// SEO: mutlaq URL, canonical + hreflang, JSON-LD. Bitta manba (sitemap.ts va robots.ts ham shu yerdan oladi).
import { createElement } from 'react';
import { routing } from '@/i18n/routing';
import { sapiOrNull } from '@/lib/server-api';
import type { ListingDetail } from '@/lib/types-listing';

export const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.WEB_ORIGIN ?? 'http://localhost:3000').replace(/\/$/, '');

/** Mutlaq URL; uz asosiy til, shuning uchun prefiksiz. */
export const url = (locale: string, path = '') => `${SITE}${locale === routing.defaultLocale ? '' : `/${locale}`}${path}`;

/** generateMetadata ichiga spread qilinadi: canonical + uchala til + x-default. Filtrli ro'yxatlarda path parametrsiz berilsin. */
export function alt(locale: string, path = '') {
  return {
    alternates: {
      canonical: url(locale, path),
      languages: { ...Object.fromEntries(routing.locales.map((l) => [l, url(l, path)])), 'x-default': url(routing.defaultLocale, path) },
    },
  };
}

/** JSON-LD tegi. JSON.stringify undefined maydonlarni tashlaydi, ya'ni yo'q ma'lumot chiqmaydi. */
export const Ld = ({ data }: { data: object }) =>
  createElement('script', { type: 'application/ld+json', dangerouslySetInnerHTML: { __html: JSON.stringify(data) } });

/** BreadcrumbList: [{ name, path }] ichki sahifa zanjiri (bosh sahifa avtomatik qo'shiladi). */
export const breadcrumbs = (locale: string, items: { name: string; path: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [{ name: 'YukSaroy', path: '' }, ...items].map((x, i) => ({
    '@type': 'ListItem', position: i + 1, name: x.name, item: url(locale, x.path),
  })),
});

/** E'lon (texnika/avtotransport): Product + Offer. Narx yo'q bo'lsa Offer ham yo'q. */
export async function listingLd(locale: string, section: 'equipment' | 'carriers', slug: string) {
  const l = await sapiOrNull<ListingDetail>(`/listings/${slug}`, 60);
  if (!l) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: l.title,
    description: l.description ?? undefined,
    image: l.photos.length ? l.photos : undefined,
    url: url(locale, `/${section}/${l.slug}`),
    brand: l.org ? { '@type': 'Organization', name: l.org.name } : undefined,
    offers: l.priceTiyin
      ? { '@type': 'Offer', price: (l.priceTiyin / 100).toFixed(0), priceCurrency: 'UZS', availability: 'https://schema.org/InStock', url: url(locale, `/${section}/${l.slug}`) }
      : undefined,
  };
}
