import { Link } from '@/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { REGIONS, SERVICE_CODES, TERMINAL_KINDS, chipLabel, corridorRegions, parseQuery, type RegionCode, type SearchChip, type SearchLang } from '@yuksaroy/domain';
import { sapi, qs } from '@/lib/server-api';
import { pricePer } from '@/lib/format';
import type { Page, TerminalCard as T } from '@/lib/types';
import { TerminalCard } from '@/components/catalog/TerminalCard';
import { RegionFilter } from '@/components/catalog/RegionFilter';
import { NearMeButton } from '@/components/catalog/NearMeButton';
import { RegionChips } from '@/components/catalog/RegionChips';
import { Impressions } from '@/components/catalog/Impressions';
import { alt } from '@/lib/seo';

export const revalidate = 60;
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta.terminals' });
  return { title: t('title'), description: t('description'), ...alt(locale, '/terminals') };
}

type SP = Record<string, string | string[] | undefined>;
// Formada yashirin input va select bir nomda keladi: oxirgi bo'sh bo'lmagan qiymat g'olib (select tanlovi ustun)
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v.filter(Boolean).at(-1) : v) ?? '';
const isRegion = (s: string): s is RegionCode => (REGIONS as readonly string[]).includes(s);
const without = (list: string, v: string) => list.split(',').filter((x) => x !== v).join(',');
const chip = (type: SearchChip['type'], value: string): SearchChip => ({ type, key: `${type}:${value}`, value });

export default async function TerminalsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = locale as SearchLang;
  const [sp, t, tf, tt, tn, tk, ts, tp, th, tb, tl] = await Promise.all([searchParams, getTranslations('catalog'), getTranslations('filter'), getTranslations('terminals'), getTranslations('nav'), getTranslations('kind'), getTranslations('service'), getTranslations('pagination'), getTranslations('hubs'), getTranslations('booking'), getTranslations('listing')]);
  const raw = { region: one(sp.region), kind: one(sp.kind), service: one(sp.service), q: one(sp.q), near: one(sp.near), radius: one(sp.radius), corridor: one(sp.corridor), sort: one(sp.sort), bookable: one(sp.bookable) === '1' ? '1' : '' };

  // Yordamchi: q lug'at orqali filtrlarga aylanadi; aniq URL parametrlari parse natijasidan ustun
  const [nLng, nLat] = raw.near.split(',').map(Number);
  const p = raw.q ? parseQuery(raw.q, { lang, near: raw.near && Number.isFinite(nLat) ? { lat: nLat!, lng: nLng! } : undefined }) : null;
  // Koridor alohida param: boshqa chip olib tashlanganda ham "A → B" yorlig'i saqlanadi
  const [cFrom, cTo] = (raw.region ? '' : raw.corridor || (p?.corridor ? `${p.corridor.from}>${p.corridor.to}` : '')).split('>').filter(isRegion);
  const corridor = cFrom && cTo ? `${cFrom}>${cTo}` : '';
  const region = raw.region || (cFrom && cTo ? corridorRegions(cFrom, cTo).join(',') : p?.regions.join(',') ?? '');
  const service = raw.service || p?.services.join(',') || '';
  const kind = raw.kind || p?.kind || '';
  const near = raw.near || (p?.near ? `${p.near.lng},${p.near.lat}` : '');
  const radius = raw.radius || (p?.near ? String(p.near.radiusKm) : '');

  const chips: SearchChip[] = [
    ...(corridor ? [chip('corridor', corridor)] : region.split(',').filter(Boolean).map((v) => chip('region', v))),
    ...service.split(',').filter(Boolean).map((v) => chip('service', v)),
    ...(kind ? [chip('kind', kind)] : []),
    ...(near ? [chip('near', radius || '25')] : []),
  ];
  // Chiplar bor bo'lsa q tashlanadi: filtrlar aniq paramlarga aylangan, olib tashlash deterministik
  const base = { region: corridor ? '' : region, service, kind, near, radius, corridor, bookable: raw.bookable, sort: raw.sort, q: chips.length ? '' : raw.q };
  const href = (over: Partial<typeof base> & { page?: number }) => `/terminals${qs({ ...base, ...over })}`;
  // Xarita sahifasiga joriy filtrlar bilan
  const mapHref = `/map${qs({ cat: 'terminal', region: base.region, service, corridor, near, radius, q: base.q })}`;
  const remove = (c: SearchChip) =>
    c.type === 'corridor' ? href({ corridor: '' })
    : c.type === 'region' ? href({ region: without(region, c.value) })
    : c.type === 'service' ? href({ service: without(service, c.value) })
    : c.type === 'kind' ? href({ kind: '' })
    : href({ near: '', radius: '' });

  const page = Number(one(sp.page)) || 1;
  const data = await sapi<Page<T>>(`/terminals${qs({ region, service, kind, near, radius, bookable: raw.bookable, q: base.q, sort: raw.sort, page, limit: 12 })}`, 60);
  const pages = Math.max(1, Math.ceil(data.total / data.limit));
  const s = data.summary;
  const decision = [
    t('decision.terminals', { count: data.total }),
    s && data.total ? t('decision.freeToday', { count: s.freeToday }) : null,
    s?.cheapestTiyin != null && s.cheapestUnit ? t('decision.cheapest', { price: pricePer(s.cheapestTiyin, s.cheapestUnit) }) : null,
    s?.nearestKm != null ? t('decision.nearest', { km: Math.round(s.nearestKm) }) : null,
  ].filter(Boolean).join(t('decision.separator'));

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div>
        <h1 className="font-display text-3xl font-bold">{tn('terminals')}</h1>
        <p className="mt-2 text-muted">{tt('lead')}</p>
      </div>

      <form className="mt-6 grid gap-3 rounded-card border border-line bg-white p-4 md:grid-cols-[1.2fr_1fr_1fr_auto]" action="/terminals">
        {Object.entries({ region: base.region, service, kind, near, radius, corridor, bookable: raw.bookable }).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
        <RegionFilter value={region} />
        <Sel name="kind" value={kind} label={tf('kind.all')} options={TERMINAL_KINDS.map((k) => [k, tk(k)])} />
        <Sel name="service" value={service} label={tf('service.all')} options={SERVICE_CODES.map((x) => [x, ts(x)])} />
        <div className="flex gap-2">
          {/* Reyting varianti faqat baholangan obyekt bo'lsa: aks holda ro'yxat aslida alifbo bo'yicha chiqadi */}
          <Sel name="sort" value={raw.sort} options={[['', th('sortDefault')], ...(s?.ratedCount ? [['rating', tf('sort.rating')] as const] : []), ['price', tf('sort.price')], ['name', tf('sort.name')], ...(near ? [['nearest', tl('filter.sort.nearest')] as const] : [])]} />
          <button className="rounded-xl bg-navy px-5 py-3 font-semibold text-white hover:bg-navy-2">{tf('apply')}</button>
        </div>
      </form>

      <div className="mt-3"><NearMeButton path="/terminals" /></div>

      {chips.length || raw.bookable || p?.unresolved.length ? (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {chips.map((c) => {
            const label = chipLabel(c, lang);
            return (
              <span key={c.key} className="inline-flex items-center gap-1 rounded-full bg-teal-soft py-1 pl-3 pr-1.5 text-sm font-semibold text-teal-ink">
                {label}
                <Link href={remove(c)} aria-label={t('chips.remove', { label })} className="rounded-full px-1.5 leading-none hover:bg-teal/15">×</Link>
              </span>
            );
          })}
          {/* bookable=1: /booking sahifasidan; chip kabi olib tashlanadi */}
          {raw.bookable ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-soft py-1 pl-3 pr-1.5 text-sm font-semibold text-teal-ink">
              {tb('chip')}
              <Link href={href({ bookable: '' })} aria-label={t('chips.remove', { label: tb('chip') })} className="rounded-full px-1.5 leading-none hover:bg-teal/15">×</Link>
            </span>
          ) : null}
          {p?.unresolved.length ? <span className="text-xs text-muted">{t('chips.unresolved', { words: p.unresolved.join(', ') })}</span> : null}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="font-mono text-sm text-navy tabular-nums">{decision}</p>
        <Link href={mapHref} className="text-xs font-semibold text-teal-ink underline decoration-dotted hover:text-navy">{th('viewOnMap')}</Link>
      </div>

      {data.items.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-line p-10 text-center text-muted">
          <p>{tt('empty.title')}</p>
          <Link href="/terminals" className="mt-3 inline-block text-sm font-semibold text-teal-ink underline">{tt('empty.reset')}</Link>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {data.items.map((x) => <TerminalCard key={x.id} t={x} />)}
          <Impressions kind="terminal" ids={data.items.map((x) => x.id)} surface="list" />
        </div>
      )}

      {pages > 1 && (
        <nav aria-label={tp('aria')} className="mt-8 flex justify-center gap-2 font-mono text-sm">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link key={n} href={href({ page: n })} aria-current={n === data.page ? 'page' : undefined} className={`rounded-full px-3 py-1 ${n === data.page ? 'bg-navy text-white' : 'border border-line bg-white hover:bg-sand'}`}>{n}</Link>
          ))}
        </nav>
      )}
      <RegionChips base="/terminals" />
    </div>
  );
}

function Sel({ name, value, label, options }: { name: string; value: string; label?: string; options: (readonly [string, string])[] }) {
  return (
    <select name={name} defaultValue={value} aria-label={label ?? name} className="w-full rounded-xl border border-line bg-white px-3 py-3 text-sm">
      {label ? <option value="">{label}</option> : null}
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
