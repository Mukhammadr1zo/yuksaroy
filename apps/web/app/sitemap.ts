import type { MetadataRoute } from 'next';
import { REGIONS } from '@yuksaroy/domain';
import { routing } from '@/i18n/routing';
import { sapi } from '@/lib/server-api';
import { url } from '@/lib/seo';
import { POSTS } from '@/components/marketing/posts';

// /sitemap.xml: statik yo'llar, obyekti bor viloyat hublari, tafsilot sahifalari (terminal, e'lon, kompaniya), uch til (uz prefiksiz).
// Temir yo'l terminallarining cuid manzillari bu yerda yo'q: faqat viloyat hublari; sahifalarning o'zi indekslanaveradi.
const STATIC = ['', '/terminals', '/equipment', '/carriers', '/companies', '/standards', '/quote', '/map', '/booking', '/for-shippers', '/for-providers', '/urgent', '/cargo', '/services', '/wagon', '/help', '/pricing', '/features', '/features/assistant', '/about', '/contact', '/blog', '/terms', '/privacy', ...POSTS.map((p) => `/blog/${p.slug}`)];
/** Viloyat hublari: obyekti bor viloyatlar; ro'yxat bo'sh bo'lsa (API yo'q) hammasi qoladi. */
const hubs = (cat: string, rows: { regionCode: string | null; serviceRegions?: string[] }[]) => {
  const has = new Set(rows.flatMap((r) => [r.regionCode, ...(r.serviceRegions ?? [])]).filter((x): x is string => x !== null));
  return REGIONS.filter((r) => has.size === 0 || has.has(r)).map((r) => `/${cat}/region/${r}`);
};

/** Ochiq ro'yxatni oxirigacha varaqlaydi (limit 50, API maksimumi); API yo'q bo'lsa bo'sh. */
async function all<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= 200; page++) {
    const d = await sapi<{ items: T[]; total: number }>(`${path}${path.includes('?') ? '&' : '?'}page=${page}&limit=50`, 3600).catch(() => null);
    if (!d) break;
    out.push(...d.items);
    if (page * 50 >= d.total || d.items.length === 0) break;
  }
  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // lastModified: faqat haqiqiy sana bor yo'llarda (ochiq API'da e'lon publishedAt beradi, terminal va kompaniya bermaydi)
  const seen = new Map<string, string>();
  const [terminals, listings, companies] = await Promise.all([
    all<{ slug: string; regionCode: string | null }>('/terminals'),
    all<{ slug: string; kind: string; publishedAt: string | null; regionCode: string | null; serviceRegions: string[] }>('/listings'),
    all<{ slug: string | null; id: string }>('/companies'),
  ]);
  const listingPaths = listings.map((l) => {
    const p = `${l.kind === 'TRUCK' ? '/carriers' : '/equipment'}/${l.slug}`;
    if (l.publishedAt) seen.set(p, l.publishedAt);
    return p;
  });
  // Bo'sh hublar sitemapda yo'q; sonlar yuqoridagi ro'yxatlardan olinadi, qo'shimcha so'rov yo'q.
  // Shahobcha hublari yo'q: ular endi /terminals?kind=RAIL filtri, alohida sahifa emas.
  const HUBS = [
    ...hubs('terminals', terminals),
    ...hubs('equipment', listings.filter((l) => l.kind !== 'TRUCK')),
    ...hubs('carriers', listings.filter((l) => l.kind === 'TRUCK')),
  ];
  // /k/<slug> do'koni sitemap'da yo'q: u /companies/<slug> ga canonical qilingan
  const paths = [...STATIC, ...HUBS, ...terminals.map((t) => `/terminals/${t.slug}`), ...listingPaths, ...companies.map((c) => `/companies/${c.slug ?? c.id}`)];
  return paths.flatMap((p) => routing.locales.map((l) => ({
    url: url(l, p),
    alternates: { languages: Object.fromEntries(routing.locales.map((x) => [x, url(x, p)])) },
    ...(seen.has(p) ? { lastModified: new Date(seen.get(p)!) } : {}),
    changeFrequency: 'daily' as const,
    priority: p === '' ? 1 : STATIC.includes(p) ? 0.8 : 0.6,
  })));
}
