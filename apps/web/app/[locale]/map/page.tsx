import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/site/Header';
import { MapView } from '@/components/map/MapView';
import { parseState } from '@/components/map/state';
import { TerminalCard } from '@/components/catalog/TerminalCard';
import { ListingCard } from '@/components/catalog/ListingCard';
import { Impressions } from '@/components/catalog/Impressions';
import { sapi } from '@/lib/server-api';
import type { Page, TerminalCard as T } from '@/lib/types';
import type { ListingPage } from '@/lib/types-listing';
import { alt } from '@/lib/seo';

export const revalidate = 60;
type Params = { params: Promise<{ locale: string }> };
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v.filter(Boolean).at(-1) : v) ?? '';

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'map.meta' });
  return { title: t('title'), description: t('description'), ...alt(locale, '/map') };
}

/**
 * /map: Header ostida to'liq balandlikdagi xarita, Footer yo'q (shuning uchun (public) guruhidan tashqarida).
 * Kartalar server'da tayyorlanadi (TerminalCard, ListingCard), MapView ularni ko'rinish va filtr bo'yicha tanlab ko'rsatadi.
 * Xarita nuqtalari mijozda /v1/map-objects.geojson dan olinadi.
 */
export default async function MapPage({ params, searchParams }: Params & { searchParams: Promise<SP> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const initial = parseState((k) => one(sp[k]));
  // ponytail: 50 tadan ortiq obyektga karta tayyorlanmaydi, MapView qisqa qator ko'rsatadi; ko'payganda sahifalab olinadi
  const [terms, lists] = await Promise.all([
    sapi<Page<T>>('/terminals?limit=50', 60).catch(() => null),
    sapi<ListingPage>('/listings?limit=50', 60).catch(() => null),
  ]);
  const cards: Record<string, ReactNode> = {};
  // Mayoq karta bilan birga o'rnatiladi: MapView faqat ko'rinishdagi kartalarni chizadi, shuning uchun sanoq aniq
  for (const x of terms?.items ?? []) cards[`terminal:${x.id}`] = <><TerminalCard t={x} /><Impressions kind="terminal" ids={[x.id]} surface="map" /></>;
  for (const l of lists?.items ?? []) cards[`${l.kind === 'TRUCK' ? 'truck' : 'equipment'}:${l.id}`] = <><ListingCard l={l} /><Impressions kind="listing" ids={[l.id]} surface="map" /></>;

  return (
    <div className="flex h-dvh flex-col">
      <Header />
      <MapView initial={initial} cards={cards} />
    </div>
  );
}
