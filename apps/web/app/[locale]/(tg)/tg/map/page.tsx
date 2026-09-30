import type { ReactNode } from 'react';
import { getLocale, setRequestLocale } from 'next-intl/server';
import type { SearchLang } from '@yuksaroy/domain';
import { MapView } from '@/components/map/MapView';
import { parseState } from '@/components/map/state';
import { ListingRow, TerminalRow } from '@/components/tg/bits';
import { sapi } from '@/lib/server-api';
import type { Page, TerminalCard } from '@/lib/types';
import type { ListingPage } from '@/lib/types-listing';

// /tg/map: to'liq balandlikdagi interaktiv xarita, ro'yxat pastki panelda (MapView'ning mobil paneli). Kartalar Mini App qatorlari (/tg havolalari).
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v.filter(Boolean).at(-1) : v) ?? '';

export default async function TgMapPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = (await getLocale()) as SearchLang;
  const sp = await searchParams;
  const initial = parseState((k) => one(sp[k]));
  const [terms, lists] = await Promise.all([
    sapi<Page<TerminalCard>>('/terminals?limit=50', 60).catch(() => null),
    sapi<ListingPage>('/listings?limit=50', 60).catch(() => null),
  ]);
  const cards: Record<string, ReactNode> = {};
  // key: MapView kartalarni massivda chizadi
  for (const x of terms?.items ?? []) cards[`terminal:${x.id}`] = <TerminalRow key={x.id} t={x} lang={lang} />;
  for (const l of lists?.items ?? []) cards[`${l.kind === 'TRUCK' ? 'truck' : 'equipment'}:${l.id}`] = <ListingRow key={l.id} l={l} lang={lang} />;
  return (
    <main id="main" className="flex h-[var(--tg-vh,100dvh)] flex-col">
      <MapView initial={initial} cards={cards} />
    </main>
  );
}
