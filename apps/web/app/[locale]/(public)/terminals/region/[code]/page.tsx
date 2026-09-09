import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { sapi } from '@/lib/server-api';
import type { Page, TerminalCard as T } from '@/lib/types';
import { TerminalCard } from '@/components/catalog/TerminalCard';
import { HUB_PARAMS, RegionHub, isRegion } from '@/components/catalog/RegionHub';
import { alt } from '@/lib/seo';

export const revalidate = 300;
export const generateStaticParams = HUB_PARAMS;
type Params = { params: Promise<{ locale: string; code: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, code } = await params;
  if (!isRegion(code)) return {};
  const [t, tr, data] = await Promise.all([getTranslations({ locale, namespace: 'hubs.terminals' }), getTranslations({ locale, namespace: 'region' }), sapi<Page<T>>(`/terminals?region=${code}&limit=1`, 300)]);
  // Bo'sh viloyat hubi indekslanmaydi (ichki havolalar uchun follow qoladi)
  return { title: t('title', { region: tr(code) }), description: t('description', { region: tr(code), count: data.total }), ...alt(locale, `/terminals/region/${code}`), ...(data.total === 0 ? { robots: { index: false, follow: true } } : {}) };
}

/** Viloyat hubi: terminallar. ponytail: 50 tagacha, ko'pi filtrli katalogga havola bilan. */
export default async function TerminalsRegionPage({ params }: Params) {
  const { locale, code } = await params;
  if (!isRegion(code)) notFound();
  setRequestLocale(locale);
  const data = await sapi<Page<T>>(`/terminals?region=${code}&limit=50`, 300);
  const pins = data.items.filter((x) => x.lat != null && x.lng != null).map((x) => ({ lat: x.lat!, lng: x.lng! }));
  return (
    <RegionHub cat="terminals" code={code} count={data.total} shown={data.items.length} pins={pins}>
      <div className="grid gap-4 md:grid-cols-2">{data.items.map((x) => <TerminalCard key={x.id} t={x} />)}</div>
    </RegionHub>
  );
}
