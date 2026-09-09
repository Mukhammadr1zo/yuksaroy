import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { sapi } from '@/lib/server-api';
import type { ListingPage } from '@/lib/types-listing';
import { ListingCard } from '@/components/catalog/ListingCard';
import { HUB_PARAMS, RegionHub, isRegion } from '@/components/catalog/RegionHub';
import { alt } from '@/lib/seo';

export const revalidate = 300;
export const generateStaticParams = HUB_PARAMS;
type Params = { params: Promise<{ locale: string; code: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, code } = await params;
  if (!isRegion(code)) return {};
  const [t, tr, data] = await Promise.all([getTranslations({ locale, namespace: 'hubs.carriers' }), getTranslations({ locale, namespace: 'region' }), sapi<ListingPage>(`/listings?kind=TRUCK&region=${code}&limit=1`, 300)]);
  // Bo'sh viloyat hubi indekslanmaydi (ichki havolalar uchun follow qoladi)
  return { title: t('title', { region: tr(code) }), description: t('description', { region: tr(code), count: data.total }), ...alt(locale, `/carriers/region/${code}`), ...(data.total === 0 ? { robots: { index: false, follow: true } } : {}) };
}

/** Viloyat hubi: avtotransport. API region filtri bazaviy viloyat YOKI xizmat hududiga mos keladi. */
export default async function CarriersRegionPage({ params }: Params) {
  const { locale, code } = await params;
  if (!isRegion(code)) notFound();
  setRequestLocale(locale);
  const data = await sapi<ListingPage>(`/listings?kind=TRUCK&region=${code}&limit=50&sort=new`, 300);
  const pins = data.items.filter((x) => x.lat != null && x.lng != null).map((x) => ({ lat: x.lat!, lng: x.lng! }));
  return (
    <RegionHub cat="carriers" code={code} count={data.total} shown={data.items.length} pins={pins}>
      <div className="grid gap-4 md:grid-cols-2">{data.items.map((x) => <ListingCard key={x.id} l={x} />)}</div>
    </RegionHub>
  );
}
