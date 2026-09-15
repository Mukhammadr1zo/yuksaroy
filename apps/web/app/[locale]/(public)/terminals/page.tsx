import { Link } from '@/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { REGIONS, SERVICE_CODES, TERMINAL_KINDS, chipLabel, corridorRegions, parseQuery, type RegionCode, type SearchChip, type SearchLang } from '@yuksaroy/domain';
import { sapi, qs } from '@/lib/server-api';
import { pricePer } from '@/lib/format';
import type { Page, TerminalCard as T } from '@/lib/types';
import { TerminalCard } from '@/components/catalog/TerminalCard';
import { AuthOnly } from '@/components/site/AuthOnly';
import { RegionFilter } from '@/components/catalog/RegionFilter';
import { NearMeButton } from '@/components/catalog/NearMeButton';
import { RegionChips } from '@/components/catalog/RegionChips';
import { Impressions } from '@/components/catalog/Impressions';
import { alt } from '@/lib/seo';
import { MapTrifoldIcon } from '@phosphor-icons/react/dist/ssr';
import { Pagination } from '@/components/catalog/Pagination';

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
  const [sp, t, tf, tt, tn, tk, ts, th, tb, tl] = await Promise.all([searchParams, getTranslations('catalog'), getTranslations('filter'), getTranslations('terminals'), getTranslations('nav'), getTranslations('kind'), getTranslations('service'), getTranslations('hubs'), getTranslations('booking'), getTranslations('listing')]);
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
    : href({ near: '', radius: '' });

  const page = Number(one(sp.page)) || 1;
  const data = await sapi<Page<T>>(`/terminals${qs({ region, service, kind, near, radius, bookable: raw.bookable, q: base.q, sort: raw.sort, page, limit: 12 })}`, 60);
  const pages = Math.max(1, Math.ceil(data.total / data.limit));
  const s = data.summary;
  const decision = [
    t('decision.terminals', { count: data.total }),
    s && data.total ? t('decision.freeToday', { count: s.freeToday }) : null,
    s?.cheapestTiyin != null && s.cheapestUnit ? t('decision.cheapest', { price: pricePer(s.cheapestTiyin, s.cheapestUnit, locale) }) : null,
    s?.nearestKm != null ? t('decision.nearest', { km: Math.round(s.nearestKm) }) : null,
  ].filter(Boolean).join(t('decision.separator'));

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div>
        <h1 className="font-display text-3xl font-bold">{tn('terminals')}</h1>
        <p className="mt-2 text-muted">{tt('lead')}</p>
      </div>

      {/* Tur bu yerda yo'q: u quyidagi chiplar bilan tanlanadi. Ikkala boshqaruv qolsa
          ular bir-biriga zid ko'rinardi (chip "temir yo'l", ro'yxat esa "barcha turlar"). */}
      <form className="mt-6 grid gap-3 rounded-card border border-line bg-white p-4 md:grid-cols-[1.4fr_1.4fr_auto]" action="/terminals">
        {Object.entries({ region: base.region, service, kind, near, radius, corridor, bookable: raw.bookable }).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
        <RegionFilter value={region} />
        <Sel name="service" value={service} label={tf('service.all')} options={SERVICE_CODES.map((x) => [x, ts(x)])} />
        <div className="flex gap-2">
          {/* Reyting varianti faqat baholangan obyekt bo'lsa: aks holda ro'yxat aslida alifbo bo'yicha chiqadi */}
          <Sel name="sort" value={raw.sort} options={[['', th('sortDefault')], ...(s?.ratedCount ? [['rating', tf('sort.rating')] as const] : []), ['price', tf('sort.price')], ['name', tf('sort.name')], ...(near ? [['nearest', tl('filter.sort.nearest')] as const] : [])]} />
          <button className="rounded-xl bg-navy px-5 py-3 font-semibold text-white hover:bg-navy-2">{tf('apply')}</button>
        </div>
      </form>

      {/* Tur bo'yicha tez o'tish. Shahobcha yo'l alohida bo'lim emas, temir yo'l terminali:
          menyuda o'z bandi yo'q, shuning uchun bu yerda bir bosishda ochilishi kerak. */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href={href({ kind: '' })} aria-current={kind ? undefined : 'true'}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors duration-150 ${kind ? 'border border-line bg-white text-muted hover:border-teal hover:text-teal-ink' : 'bg-navy text-white'}`}>
          {tf('kind.all')}
        </Link>
        {TERMINAL_KINDS.map((k) => (
          <Link key={k} href={href({ kind: k })} aria-current={kind === k ? 'true' : undefined}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors duration-150 ${kind === k ? 'bg-navy text-white' : 'border border-line bg-white text-muted hover:border-teal hover:text-teal-ink'}`}>
            {tk(k)}
          </Link>
        ))}
      </div>

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
        {data.items.length ? <p className="font-mono text-sm text-navy tabular-nums">{decision}</p> : <span />}
        <Link href={mapHref} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-2 text-sm font-semibold text-navy transition-colors duration-150 hover:border-teal hover:text-teal-ink"><MapTrifoldIcon size={16} weight="duotone" className="text-teal" aria-hidden="true" />{th('viewOnMap')}</Link>
      </div>

      {data.items.length === 0 && data.total === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-line p-10 text-center text-muted">
          <p>{tt('empty.title')}</p>
          <Link href="/terminals" className="mt-3 inline-block text-sm font-semibold text-teal-ink underline">{tt('empty.reset')}</Link>
          <p className="mt-6 border-t border-line pt-5 text-sm">{tt('empty.owner')}</p>
          <AuthOnly guest={<Link href="/signup?next=%2Fdashboard%2Fterminals%2Fnew" className="mt-3 inline-block rounded-full bg-teal px-6 py-2.5 font-semibold text-white transition hover:bg-teal-ink active:scale-[0.98]">{tt('empty.ownerSignup')}</Link>}>
            <Link href="/dashboard/terminals/new" className="mt-3 inline-block rounded-full bg-teal px-6 py-2.5 font-semibold text-white transition hover:bg-teal-ink active:scale-[0.98]">{tt('empty.ownerCta')}</Link>
          </AuthOnly>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {data.items.map((x) => <TerminalCard key={x.id} t={x} />)}
          <Impressions kind="terminal" ids={data.items.map((x) => x.id)} surface="list" />
        </div>
      )}

      <Pagination page={data.page} pages={pages} href={(n) => href({ page: n })} />
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
