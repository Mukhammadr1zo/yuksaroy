import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { sapi } from '@/lib/server-api';
import type { Page, Siding } from '@/lib/types';
import { SidingsTable } from '@/components/catalog/SidingsTable';
import { HUB_PARAMS, RegionHub, isRegion } from '@/components/catalog/RegionHub';
import { alt } from '@/lib/seo';

export const revalidate = 300;
export const generateStaticParams = HUB_PARAMS;
type Params = { params: Promise<{ locale: string; code: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, code } = await params;
  if (!isRegion(code)) return {};
  const [t, tr, data] = await Promise.all([getTranslations({ locale, namespace: 'hubs.sidings' }), getTranslations({ locale, namespace: 'region' }), sapi<Page<Siding>>(`/sidings?region=${code}&limit=1`, 300)]);
  // Bo'sh viloyat hubi indekslanmaydi (ichki havolalar uchun follow qoladi)
  return { title: t('title', { region: tr(code) }), description: t('description', { region: tr(code), count: data.total }), ...alt(locale, `/sidings/region/${code}`), ...(data.total === 0 ? { robots: { index: false, follow: true } } : {}) };
}

/** Viloyat hubi: shahobcha yo'llar (100 tagacha). Pinlar stansiya bo'yicha, bir xil koordinata bir marta. */
export default async function SidingsRegionPage({ params }: Params) {
  const { locale, code } = await params;
  if (!isRegion(code)) notFound();
  setRequestLocale(locale);
  const data = await sapi<Page<Siding>>(`/sidings?region=${code}&limit=100`, 300);
  const seen = new Set<string>();
  const pins = data.items.filter((s) => s.lat != null && s.lng != null && !seen.has(`${s.lat},${s.lng}`) && seen.add(`${s.lat},${s.lng}`)).map((s) => ({ lat: s.lat!, lng: s.lng!, color: '#077F84' }));
  return (
    <RegionHub cat="sidings" code={code} count={data.total} shown={data.items.length} pins={pins}>
      <SidingsTable items={data.items} />
    </RegionHub>
  );
}
