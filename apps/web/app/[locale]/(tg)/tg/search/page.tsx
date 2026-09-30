import { getTranslations, setRequestLocale } from 'next-intl/server';
import { EQUIPMENT_KINDS, REGIONS, chipLabel, corridorRegions, parseQuery, type RegionCode, type SearchCategory, type SearchChip, type SearchLang } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { qs, sapi } from '@/lib/server-api';
import { pricePer } from '@/lib/format';
import type { Page, TerminalCard } from '@/lib/types';
import type { ListingPage } from '@/lib/types-listing';
import { ListingRow, TerminalRow } from '@/components/tg/bits';
import { listingPrice, regionName } from '@/components/tg/labels';
import { SearchBox } from '@/components/tg/SearchBox';

// /tg/search: /terminals bilan bir xil server mantiq (q -> parseQuery -> filtrlar), toifa bo'yicha terminal, texnika yoki avto ro'yxati. Ixcham qatorlar.
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v.filter(Boolean).at(-1) : v) ?? '';
const isRegion = (s: string): s is RegionCode => (REGIONS as readonly string[]).includes(s);
const CATS: SearchCategory[] = ['terminal', 'equipment', 'truck'];
const chip = (type: SearchChip['type'], value: string): SearchChip => ({ type, key: `${type}:${value}`, value });

export default async function TgSearchPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = locale as SearchLang;
  const [sp, t, tc, tl, th, tg] = await Promise.all([searchParams, getTranslations('tg.search'), getTranslations('catalog'), getTranslations('listing.decision'), getTranslations('tg.home.cats'), getTranslations('tg.common')]);
  const q = one(sp.q);
  const p = q ? parseQuery(q, { lang }) : null;
  const cat: SearchCategory = (CATS as string[]).includes(one(sp.cat)) ? (one(sp.cat) as SearchCategory) : p?.category ?? 'terminal';
  const [cFrom, cTo] = (p?.corridor ? `${p.corridor.from}>${p.corridor.to}` : '').split('>').filter(isRegion);
  const region = one(sp.region) || (cFrom && cTo ? corridorRegions(cFrom, cTo).join(',') : p?.regions.join(',') ?? '');
  const near = p?.near ? `${p.near.lng},${p.near.lat}` : '';
  const radius = p?.near ? String(p.near.radiusKm) : '';
  const chips: SearchChip[] = [
    ...(cFrom && cTo ? [chip('corridor', `${cFrom}>${cTo}`)] : region.split(',').filter(Boolean).map((v) => chip('region', v))),
    ...(p?.services ?? []).map((v) => chip('service', v)),
    ...(p?.kind ? [chip('kind', p.kind)] : []),
    ...(p?.equipment ? [chip('equipment', p.equipment)] : []),
    ...(p?.deal ? [chip('deal', p.deal)] : []),
    ...(near ? [chip('near', radius)] : []),
    ...(p?.qty?.wagons ? [chip('qty', `wagons=${p.qty.wagons}`)] : []),
  ];
  const catHref = (c: SearchCategory) => `/tg/search${qs({ q, cat: c })}`;
  const mapHref = `/tg/map${qs({ cat, region, corridor: cFrom && cTo ? `${cFrom}>${cTo}` : '', near, radius, q })}`;

  // Toifa bo'yicha ro'yxat va qaror satri; API javob bermasa ro'yxat o'rniga xato matni
  let decision = '';
  let list: React.ReactNode = null;
  let total = 0, shown = 0, failed = false;
  try {
  if (cat === 'terminal') {
    const d = await sapi<Page<TerminalCard>>(`/terminals${qs({ region, service: p?.services.join(','), kind: p?.kind, near, radius, bookable: p?.bookable ? '1' : '', sort: 'rating', limit: 20 })}`, 60);
    const s = d.summary;
    total = d.total; shown = d.items.length;
    decision = [
      tc('decision.terminals', { count: d.total }),
      s && d.total ? tc('decision.freeToday', { count: s.freeToday }) : null,
      s?.cheapestTiyin != null && s.cheapestUnit ? tc('decision.cheapest', { price: pricePer(s.cheapestTiyin, s.cheapestUnit, locale) }) : null,
      s?.nearestKm != null ? tc('decision.nearest', { km: Math.round(s.nearestKm) }) : null,
    ].filter(Boolean).join(tc('decision.separator'));
    list = d.items.map((x) => <TerminalRow key={x.id} t={x} lang={lang} />);
  } else {
    const kind = cat === 'truck' ? 'TRUCK' : p?.equipment ?? EQUIPMENT_KINDS.join(',');
    const d = await sapi<ListingPage>(`/listings${qs({ kind, deal: p?.deal, region, near, radius, corridor: cFrom && cTo ? `${cFrom}>${cTo}` : '', sort: near ? 'nearest' : 'new', limit: 20 })}`, 60);
    const s = d.summary;
    total = d.total; shown = d.items.length;
    decision = [
      tl('count', { count: d.total }),
      s.onRequest ? tl('onRequest', { count: s.onRequest }) : null,
      s.cheapestTiyin != null ? tl('cheapest', { price: listingPrice(s.cheapestTiyin, s.cheapestUnit, lang) }) : null,
      s.nearestKm != null ? tl('nearest', { km: Math.round(s.nearestKm) }) : null,
    ].filter(Boolean).join(tl('separator'));
    list = d.items.map((l) => <ListingRow key={l.id} l={l} lang={lang} />);
  }
  } catch { failed = true; }

  return (
    <main id="main" className="mx-auto max-w-md px-4 pb-8 pt-4">
      <h1 className="font-display text-xl font-bold">{t('title')}</h1>
      <div className="mt-3"><SearchBox initial={q} cat={cat} placeholder={t('ph')} /></div>

      <div className="tg-strip -mx-4 mt-3 px-4" role="tablist">
        {CATS.map((c) => (
          <Link key={c} href={catHref(c)} role="tab" aria-selected={c === cat} className={`min-h-10 rounded-full px-4 py-2 text-sm font-semibold ${c === cat ? 'bg-navy text-white' : 'border border-line bg-white text-ink'}`}>{th(c)}</Link>
        ))}
      </div>

      {chips.length || p?.unresolved.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {chips.map((c) => <span key={c.key} className="rounded-full bg-teal-soft px-3 py-1 text-xs font-semibold text-teal-ink">{chipLabel(c, lang)}</span>)}
          {p?.unresolved.length ? <span className="text-xs text-muted">{t('unresolved', { words: p.unresolved.join(', ') })}</span> : null}
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="font-mono text-xs text-navy tabular-nums">{decision}</p>
        <Link href={mapHref} className="shrink-0 text-xs font-semibold text-teal-ink underline decoration-dotted">{t('map')}</Link>
      </div>

      <div className="mt-3 space-y-2">{failed ? <p role="alert" className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{tg('loadFailed')}</p> : shown === 0 ? <div className="rounded-card border border-dashed border-line p-6 text-center text-sm text-muted">{t('empty')}</div> : list}</div>
      {total > shown ? <p className="mt-3 text-center font-mono text-xs text-muted">{t('more', { shown, total })}</p> : null}
    </main>
  );
}
