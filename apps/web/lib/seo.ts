// SEO: mutlaq URL, canonical + hreflang, JSON-LD. Bitta manba (sitemap.ts va robots.ts ham shu yerdan oladi).
import { createElement } from 'react';
import { getTranslations } from 'next-intl/server';
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

/** og:locale uchun til kodi. Layout va pageMeta bir xil jadvaldan oladi. */
export const OG_LOCALE: Record<string, string> = { uz: 'uz_UZ', ru: 'ru_RU', en: 'en_US' };

/**
 * Sahifaning o'z sarlavhasi, tavsifi, canonical/hreflang va og teglari.
 *
 * Nega kerak: Next metadata'ni maydon bo'yicha ALMASHTIRADI, qo'shmaydi. Sahifa faqat
 * title va description bergan bo'lsa, openGraph layout'dan meros qoladi, ya'ni har bir
 * ichki sahifa bosh sahifaning og:url va og:title ini ko'rsatardi. Ulashilgan havola
 * ham, og:url ni canonical belgisi deb o'qiydigan qidiruv tizimi ham shuni ko'radi.
 *
 * Shuning uchun layout'da og:url umuman yo'q: noto'g'ri qiymatdan ko'ra yo'qligi yaxshi.
 * To'g'ri qiymat kerak bo'lgan sahifa shu funksiyani ishlatadi.
 */
export async function pageMeta(
  locale: string,
  path: string,
  m: { title: string; description: string; images?: string[] },
) {
  const ts = await getTranslations({ locale, namespace: 'seo2' });
  return {
    title: m.title,
    description: m.description,
    ...alt(locale, path),
    openGraph: {
      type: 'website' as const,
      siteName: ts('siteName'),
      title: m.title,
      description: m.description,
      url: url(locale, path),
      locale: OG_LOCALE[locale],
      ...(m.images ? { images: m.images } : {}),
    },
    twitter: { card: 'summary_large_image' as const, title: m.title, description: m.description },
  };
}

/** JSON-LD tegi. JSON.stringify undefined maydonlarni tashlaydi, ya'ni yo'q ma'lumot chiqmaydi. */
/** JSON-LD ni <script> ichiga xavfsiz joylash. JSON.stringify < > & belgilarini qochirmaydi,
 * shuning uchun e'lon sarlavhasidagi "</script>" tegdan chiqib ketardi (saqlangan XSS).
 * Bu uchta belgi to'g'ri JSON escape'iga o'giriladi: hujjat buzilmaydi, teg ochilmaydi. */
const ldSafe = (data: object) =>
  JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

export const Ld = ({ data }: { data: object }) =>
  createElement('script', { type: 'application/ld+json', dangerouslySetInnerHTML: { __html: ldSafe(data) } });

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
