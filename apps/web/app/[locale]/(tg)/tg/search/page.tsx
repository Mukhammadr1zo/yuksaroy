import { getTranslations, setRequestLocale } from 'next-intl/server';
import { XIcon } from '@phosphor-icons/react/dist/ssr';
import { DEAL_KINDS, EQUIPMENT_KINDS, REGIONS, SERVICE_CODES, TERMINAL_KINDS, catalogSearch, chipLabel, corridorRegions, parseQuery, type RegionCode, type SearchCategory, type SearchChip, type SearchFilters, type SearchLang } from '@yuksaroy/domain';
import { Link, redirect } from '@/i18n/navigation';
import { qs, sapi } from '@/lib/server-api';
import { pricePer } from '@/lib/format';
import type { Page, TerminalCard } from '@/lib/types';
import type { ListingPage } from '@/lib/types-listing';
import { ListingRow, TerminalRow } from '@/components/tg/bits';
import { listingPrice, regionName } from '@/components/tg/labels';
import { Browse, toBrowse, type BrowseData, type BrowseFeature } from '@/components/tg/Browse';
import { MoreRows } from '@/components/tg/MoreRows';
import { SearchBox } from '@/components/tg/SearchBox';

// /tg/search: /terminals bilan bir xil server mantiq (q -> parseQuery -> filtrlar), toifa bo'yicha terminal, texnika yoki avto ro'yxati. Ixcham qatorlar.
// Filtrlar URL da aniq paramlar bilan turadi (region, station, service, kind, equipment, deal, near, radius, bookable, corridor):
// xarita (components/map/state.ts) bilan bir xil nomlar. q ga yozilgan filtr so'zlari shu paramlarga ko'chiriladi, q da faqat erkin matn qoladi.
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v.filter(Boolean).at(-1) : v) ?? '';
const list = (v: string | string[] | undefined) => one(v).split(',').filter(Boolean);
const isRegion = (s: string): s is RegionCode => (REGIONS as readonly string[]).includes(s);
const CATS: SearchCategory[] = ['terminal', 'equipment', 'truck'];
const PAGE = 20;
const chip = (type: SearchChip['type'], value: string): SearchChip => ({ type, key: `${type}:${value}`, value });
const pick = <T extends string>(all: readonly T[], v: string): T | '' => ((all as readonly string[]).includes(v) ? (v as T) : '');

interface F {
  cat: SearchCategory; q: string; region: RegionCode[]; corridor: string; station: string; service: string[]; kind: string;
  equipment: string; deal: string; near: string; radius: string; bookable: boolean;
}

/** Boshqa toifaga tegishli filtr natijaga ta'sir qilmaydi: ko'rsatilmaydi ham, URL da ham qolmaydi. */
function forCat(f: F, cat: SearchCategory): F {
  const g: F = { ...f, cat };
  if (cat === 'terminal') { g.equipment = ''; g.deal = ''; } else { g.station = ''; g.service = []; g.kind = ''; g.bookable = false; }
  if (cat === 'truck') g.equipment = '';
  return g;
}

/** URL paramlari + (bor bo'lsa) q tahlili -> bitta filtr to'plami. Aniq param tahlildan ustun (xarita qoidasi). */
function build(sp: SP, p: SearchFilters | null, q: string): F {
  const cat = pick(CATS, one(sp.cat)) || p?.category || 'terminal';
  const exRegion = list(sp.region).filter(isRegion);
  const pc = p?.corridor ? `${p.corridor.from}>${p.corridor.to}` : '';
  const ec = one(sp.corridor).split('>').filter(isRegion);
  // Aniq viloyat tanlangan bo'lsa koridor o'chadi (xaritadagi qoida)
  const corridor = exRegion.length ? '' : ec.length === 2 ? ec.join('>') : pc;
  const region = exRegion.length ? exRegion : corridor ? [] : p?.regions ?? [];
  const exNear = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(one(sp.near)) ? one(sp.near) : '';
  const near = exNear || (p?.near ? `${p.near.lng},${p.near.lat}` : '');
  const exService = list(sp.service).filter((s) => (SERVICE_CODES as readonly string[]).includes(s));
  return forCat({
    cat, q, region, corridor, near,
    radius: near ? (Number(one(sp.radius)) > 0 ? one(sp.radius) : exNear ? '25' : String(p?.near?.radiusKm ?? 25)) : '',
    station: /^[A-Za-z0-9]{5,40}$/.test(one(sp.station)) ? one(sp.station) : '',
    service: exService.length ? exService : p?.services ?? [],
    kind: pick(TERMINAL_KINDS, one(sp.kind)) || p?.kind || '',
    equipment: pick(EQUIPMENT_KINDS, one(sp.equipment)) || p?.equipment || '',
    deal: pick(DEAL_KINDS, one(sp.deal)) || p?.deal || '',
    bookable: one(sp.bookable) === '1' || p?.bookable === true,
  }, cat);
}

const hrefOf = (f: F) => `/tg/search${qs({
  cat: f.cat === 'terminal' ? '' : f.cat, q: f.q, region: f.region.join(','), corridor: f.corridor, station: f.station, service: f.service.join(','),
  kind: f.kind, equipment: f.equipment, deal: f.deal, near: f.near, radius: f.radius, bookable: f.bookable ? '1' : '',
})}`;

export default async function TgSearchPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = locale as SearchLang;
  const [sp, t, tc, tl, th, tg] = await Promise.all([searchParams, getTranslations('tg.search'), getTranslations('catalog'), getTranslations('listing.decision'), getTranslations('tg.home.cats'), getTranslations('tg.common')]);
  const q = one(sp.q);
  const p = q ? parseQuery(q, { lang }) : null;
  const words = catalogSearch(q, p, (p?.chips.length ?? 0) > 0).q;
  const f = build(sp, p, words);
  // q dagi filtr so'zlari paramlarga ko'chadi (bir marta): havola o'zgargan bo'lsa yo'naltiramiz
  if (hrefOf(f) !== hrefOf(build(sp, null, q))) redirect({ href: hrefOf(f), locale });
  const { cat } = f;
  const region = f.region.join(',');
  const hasFilter = !!(region || f.corridor || f.station || f.service.length || f.kind || f.equipment || f.deal || f.near || f.bookable);
  const onlyRegion = f.region.length === 1 && !(f.corridor || f.station || f.service.length || f.kind || f.near || f.bookable);
  const browse = cat === 'terminal' && !f.q && !hasFilter;
  const browseStations = cat === 'terminal' && !f.q && onlyRegion;

  // Ko'rish bo'limi va stansiya nomi xarita keshidan (5 daqiqa); xato bo'lsa faqat shular tushib qoladi, ro'yxat ishlayveradi
  const geo = browse || browseStations || (cat === 'terminal' && f.station) ? await sapi<{ features: BrowseFeature[] }>('/map-objects.geojson?cat=terminal', 300).catch(() => null) : null;
  const data: BrowseData | null = geo ? toBrowse(geo.features) : null;
  const stationName = data?.stations.find((s) => s.id === f.station)?.name ?? t('station');

  const [cFrom, cTo] = f.corridor.split('>');
  const apiRegion = f.corridor ? corridorRegions(cFrom as RegionCode, cTo as RegionCode).join(',') : region;
  const mapHref = `/tg/map${qs({ cat, region, corridor: f.corridor, near: f.near, radius: f.radius, free: f.bookable ? '1' : '', q: f.q })}`;
  const without = (patch: Partial<F>) => hrefOf({ ...f, ...patch });
  // Viloyat q dagi shahar so'zidan kelgan bo'lsa (Bekobod), chip olib tashlanganda so'z ham ketadi: aks holda yo'naltirish chipni qaytarardi (saytdagi withoutRegion).
  // Boshqa filtr so'zlari (xizmat, tur, texnika...) yo'naltirishda q dan chiqib ketgan, shuning uchun ularda bu muammo yo'q.
  const regionOff = (r: string) => {
    const rest = f.region.filter((x) => x !== r);
    return without({ region: rest, q: !rest.length && p?.regions.length ? catalogSearch(q, p, true).withoutRegion : f.q });
  };

  // Filtr belgilari: har biri olib tashlanadigan havola; tartib: hudud, stansiya, qolganlari, oxirida erkin matn
  const chips: { key: string; label: string; href: string }[] = [
    ...(f.corridor ? [{ key: 'corridor', label: chipLabel(chip('corridor', f.corridor), lang), href: without({ corridor: '' }) }]
      : f.region.map((r) => ({ key: `region:${r}`, label: regionName(r, lang), href: regionOff(r) }))),
    ...(f.station ? [{ key: 'station', label: stationName, href: without({ station: '' }) }] : []),
    ...f.service.map((s) => ({ key: `service:${s}`, label: chipLabel(chip('service', s), lang), href: without({ service: f.service.filter((x) => x !== s) }) })),
    ...(f.kind ? [{ key: 'kind', label: chipLabel(chip('kind', f.kind), lang), href: without({ kind: '' }) }] : []),
    ...(f.equipment ? [{ key: 'equipment', label: chipLabel(chip('equipment', f.equipment), lang), href: without({ equipment: '' }) }] : []),
    ...(f.deal ? [{ key: 'deal', label: chipLabel(chip('deal', f.deal), lang), href: without({ deal: '' }) }] : []),
    ...(f.near ? [{ key: 'near', label: chipLabel(chip('near', f.radius), lang), href: without({ near: '', radius: '' }) }] : []),
    ...(f.bookable ? [{ key: 'bookable', label: chipLabel(chip('bookable', '1'), lang), href: without({ bookable: false }) }] : []),
  ];
  if (chips.length && f.q) chips.push({ key: 'q', label: `"${f.q}"`, href: without({ q: '' }) });

  // Toifa bo'yicha ro'yxat va qaror satri; API javob bermasa ro'yxat o'rniga xato matni
  let decision = '';
  let rows: React.ReactNode = null;
  let more: React.ReactNode = null;
  let fellBack = false;
  let shown = 0, failed = false;
  try {
  if (cat === 'terminal') {
    // So'z bilan 0 chiqsa faqat filtr bilan qayta so'raladi (egasi qarori 2026-10-07)
    const path = (w: string) => `/terminals${qs({ region: apiRegion, station: f.station, service: f.service.join(','), kind: f.kind, near: f.near, radius: f.radius, bookable: f.bookable ? '1' : '', q: w, sort: 'rating' })}`;
    const first = await sapi<Page<TerminalCard>>(`${path(f.q)}&limit=${PAGE}`, 60);
    fellBack = hasFilter && f.q !== '' && first.total === 0;
    // used: birinchi sahifa aynan shu so'rov bilan olingan; MoreRows keyingi sahifalarni shu bilan so'raydi
    const used = fellBack ? path('') : path(f.q);
    const d = fellBack ? await sapi<Page<TerminalCard>>(`${used}&limit=${PAGE}`, 60) : first;
    const s = d.summary;
    shown = d.items.length;
    // /terminals bilan bir xil: sonlar namunasiz (total - demo), nol sanoq chizilmaydi (egasi qarori 2026-10-07)
    const real = d.total - (s?.demo ?? 0);
    decision = [
      real > 0 ? tc('decision.terminals', { count: real }) : null,
      s?.freeToday ? tc('decision.freeToday', { count: s.freeToday }) : null,
      s?.cheapestTiyin != null && s.cheapestUnit ? tc('decision.cheapest', { price: pricePer(s.cheapestTiyin, s.cheapestUnit, locale) }) : null,
      s?.nearestKm != null ? tc('decision.nearest', { km: Math.round(s.nearestKm) }) : null,
    ].filter(Boolean).join(tc('decision.separator'));
    rows = d.items.map((x) => <TerminalRow key={x.id} t={x} lang={lang} />);
    if (d.total > shown) more = <MoreRows key={used} path={used} kind="terminal" lang={lang} loaded={shown} total={d.total} demo={s?.demo ?? 0} shown={d.items.filter((x) => !x.isDemo).length} />;
  } else {
    const kind = cat === 'truck' ? 'TRUCK' : f.equipment || EQUIPMENT_KINDS.join(',');
    // Texnika va avto: erkin matn e'lonlar qidiruviga q sifatida ketadi;
    const path = (w: string) => `/listings${qs({ kind, deal: f.deal, region: apiRegion, near: f.near, radius: f.radius, corridor: f.corridor, q: w, sort: f.near ? 'nearest' : 'new' })}`;
    const first = await sapi<ListingPage>(`${path(f.q)}&limit=${PAGE}`, 60);
    fellBack = hasFilter && f.q !== '' && first.total === 0;
    const used = fellBack ? path('') : path(f.q);
    const d = fellBack ? await sapi<ListingPage>(`${used}&limit=${PAGE}`, 60) : first;
    const s = d.summary;
    shown = d.items.length;
    // Namunasiz son: summary.demo butun filtrlangan to'plamdagi namunalar; nol bo'lsa qator chizilmaydi
    const real = d.total - (s.demo ?? 0);
    decision = [
      real > 0 ? tl('count', { count: real }) : null,
      s.onRequest ? tl('onRequest', { count: s.onRequest }) : null,
      s.cheapestTiyin != null ? tl('cheapest', { price: listingPrice(s.cheapestTiyin, s.cheapestUnit, lang) }) : null,
      s.nearestKm != null ? tl('nearest', { km: Math.round(s.nearestKm) }) : null,
    ].filter(Boolean).join(tl('separator'));
    rows = d.items.map((l) => <ListingRow key={l.id} l={l} lang={lang} />);
    if (d.total > shown) more = <MoreRows key={used} path={used} kind="listing" lang={lang} loaded={shown} total={d.total} demo={s.demo ?? 0} shown={d.items.filter((x) => !x.isDemo).length} />;
  }
  } catch { failed = true; }

  const unresolved = p?.unresolved.length ? p.unresolved : fellBack ? [f.q] : [];
  const action = 'flex min-h-11 w-full items-center justify-center rounded-full border border-line bg-white px-5 font-semibold text-ink active:bg-sand';
  const cleared = hrefOf({ ...f, q: '', region: [], corridor: '', station: '', service: [], kind: '', equipment: '', deal: '', near: '', radius: '', bookable: false });

  return (
    <main id="main" className="mx-auto max-w-md px-4 pb-8 pt-4">
      <h1 className="font-display text-xl font-bold">{t('title')}</h1>
      {/* key=q: orqaga qaytganda ham joriy havoladagi so'rov maydonda ko'rinadi */}
      <div className="mt-3"><SearchBox key={q} initial={q} cat={cat === 'terminal' ? undefined : cat} /></div>

      {/* Uch tugma qatorni to'ldiradi va 360 px ekranga ham sig'adi (son tugmada emas, pastdagi qaror satrida); undan tor ekranda qator o'zi suriladi */}
      <nav className="mt-3 flex gap-1.5 overflow-x-auto [scrollbar-width:none]" aria-label={t('title')}>
        {CATS.map((c) => (
          <Link key={c} href={hrefOf(forCat(f, c))} aria-current={c === cat ? 'page' : undefined} className={`inline-flex min-h-11 flex-auto items-center justify-center whitespace-nowrap rounded-full px-2.5 text-sm font-semibold ${c === cat ? 'bg-navy text-white' : 'border border-line bg-white text-ink'}`}>
            {th(c)}
          </Link>
        ))}
      </nav>

      {chips.length || unresolved.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <span key={c.key} className="inline-flex min-h-11 items-center rounded-full bg-teal-soft pl-3.5 text-sm font-semibold text-teal-ink">
              <span className="min-w-0 max-w-[60vw] truncate">{c.label}</span>
              <Link data-chip-remove href={c.href} aria-label={t('removeFilter', { name: c.label })} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"><XIcon size={14} weight="bold" aria-hidden="true" /></Link>
            </span>
          ))}
          {unresolved.length ? <span className="text-xs text-muted">{t('unresolved', { words: unresolved.join(', ') })}</span> : null}
        </div>
      ) : null}

      {data && browse ? <Browse data={data} lang={lang} /> : null}
      {data && browseStations ? <Browse data={data} lang={lang} region={region} /> : null}

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="font-mono text-xs text-navy tabular-nums">{decision}</p>
        <Link href={mapHref} className="-mr-2 inline-flex min-h-11 shrink-0 items-center px-2 text-xs font-semibold text-teal-ink underline decoration-dotted">{t('map')}</Link>
      </div>

      <div className="mt-1 space-y-2">
        {failed ? <p role="alert" className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{tg('loadFailed')}</p>
          : shown === 0 ? (
            <div className="rounded-card border border-dashed border-line p-6 text-center text-sm text-muted">
              <p>{t('empty')}</p>
              <div className="mt-4 space-y-2">
                {hasFilter || f.q ? <Link href={cleared} className={action}>{t('clear')}</Link> : null}
                <Link href={mapHref} className={action}>{t('toMap')}</Link>
              </div>
            </div>
          ) : rows}
      </div>
      {more}
    </main>
  );
}
