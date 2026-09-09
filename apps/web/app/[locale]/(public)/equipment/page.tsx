import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { EQUIPMENT_KINDS, REGIONS, chipLabel, corridorRegions, parseQuery, type RegionCode, type SearchChip, type SearchLang } from '@yuksaroy/domain';
import { sapi, qs } from '@/lib/server-api';
import type { ListingPage } from '@/lib/types-listing';
import { ListingCard, listingPrice } from '@/components/catalog/ListingCard';
import { RegionFilter } from '@/components/catalog/RegionFilter';
import { NearMeButton } from '@/components/catalog/NearMeButton';
import { Sel } from '@/components/catalog/Sel';
import { RegionChips } from '@/components/catalog/RegionChips';
import { Impressions } from '@/components/catalog/Impressions';
import { alt } from '@/lib/seo';

export const revalidate = 60;
type Params = { params: Promise<{ locale: string }> };
type SP = Record<string, string | string[] | undefined>;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta.texnika' });
  return { title: t('title'), description: t('description'), ...alt(locale, '/equipment') };
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v.filter(Boolean).at(-1) : v) ?? '';
const isRegion = (s: string): s is RegionCode => (REGIONS as readonly string[]).includes(s);
const isKind = (s: string) => (EQUIPMENT_KINDS as readonly string[]).includes(s);
const without = (list: string, v: string) => list.split(',').filter((x) => x !== v).join(',');
const chip = (type: SearchChip['type'], value: string): SearchChip => ({ type, key: `${type}:${value}`, value });
const pill = (on: boolean) => `rounded-full px-4 py-2 text-sm font-semibold transition ${on ? 'bg-navy text-white' : 'border border-line bg-white text-ink/80 hover:border-teal hover:text-teal-ink'}`;

/** Temir yo'l texnikasi: terminallar sahifasi naqshi (q -> chip, aniq param ustun), tur tablari, ijara/sotuv, viloyat, yonimda. */
export default async function TexnikaPage({ params, searchParams }: Params & { searchParams: Promise<SP> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = locale as SearchLang;
  const [sp, t, tc, tf, tp, th] = await Promise.all([searchParams, getTranslations('listing'), getTranslations('catalog'), getTranslations('filter'), getTranslations('pagination'), getTranslations('hubs')]);
  const raw = { region: one(sp.region), kind: one(sp.kind), deal: one(sp.deal), q: one(sp.q), near: one(sp.near), radius: one(sp.radius), corridor: one(sp.corridor), sort: one(sp.sort) };

  const [nLng, nLat] = raw.near.split(',').map(Number);
  const p = raw.q ? parseQuery(raw.q, { lang, near: raw.near && Number.isFinite(nLat) ? { lat: nLat!, lng: nLng! } : undefined }) : null;
  const [cFrom, cTo] = (raw.region ? '' : raw.corridor || (p?.corridor ? `${p.corridor.from}>${p.corridor.to}` : '')).split('>').filter(isRegion);
  const corridor = cFrom && cTo ? `${cFrom}>${cTo}` : '';
  const region = raw.region || (corridor ? '' : p?.regions.join(',') ?? '');
  const kind = isKind(raw.kind) ? raw.kind : p?.equipment ?? '';
  const deal = raw.deal === 'RENT' || raw.deal === 'SALE' ? raw.deal : p?.deal ?? '';
  const near = raw.near || (p?.near ? `${p.near.lng},${p.near.lat}` : '');
  const radius = raw.radius || (p?.near ? String(p.near.radiusKm) : '');

  const chips: SearchChip[] = [
    ...(corridor ? [chip('corridor', corridor)] : region.split(',').filter(Boolean).map((v) => chip('region', v))),
    ...(kind ? [chip('equipment', kind)] : []),
    ...(deal ? [chip('deal', deal)] : []),
    ...(p?.qty ? Object.entries(p.qty).map(([k, v]) => chip('qty', `${k}=${v}`)) : []),
    ...(near ? [chip('near', radius || '25')] : []),
  ];
  const base = { region, kind, deal, near, radius, corridor, sort: raw.sort, q: chips.length ? '' : raw.q };
  const href = (over: Partial<typeof base> & { page?: number }) => `/equipment${qs({ ...base, ...over })}`;
  const mapHref = `/map${qs({ cat: 'equipment', region, corridor, near, radius, q: base.q })}`;
  const remove = (c: SearchChip) =>
    c.type === 'corridor' ? href({ corridor: '' })
    : c.type === 'region' ? href({ region: without(region, c.value) })
    : c.type === 'equipment' ? href({ kind: '' })
    : c.type === 'deal' ? href({ deal: '' })
    : c.type === 'qty' ? href({})
    : href({ near: '', radius: '' });

  const page = Number(one(sp.page)) || 1;
  const data = await sapi<ListingPage>(`/listings${qs({ kind: kind || EQUIPMENT_KINDS.join(','), deal, region: corridor ? corridorRegions(cFrom!, cTo!).join(',') : region, near, radius, corridor, q: base.q, sort: raw.sort || 'new', page, limit: 12 })}`, 60);
  const pages = Math.max(1, Math.ceil(data.total / data.limit));
  const s = data.summary;
  const decision = [
    t('decision.count', { count: data.total }),
    data.total && s.onRequest ? t('decision.onRequest', { count: s.onRequest }) : null,
    s.cheapestTiyin != null ? t('decision.cheapest', { price: listingPrice(s.cheapestTiyin, s.cheapestUnit, lang) }) : null,
    s.nearestKm != null ? t('decision.nearest', { km: Math.round(s.nearestKm) }) : null,
  ].filter(Boolean).join(t('decision.separator'));
  const filtered = chips.length > 0 || !!raw.q;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy sm:text-3xl">{t('rail.title')}</h1>
          <p className="mt-2 max-w-[64ch] text-muted">{t('rail.lead')}</p>
        </div>
        <Link href="/standards" className="text-sm font-semibold text-teal-ink underline decoration-dotted hover:text-navy">{t('empty.standard')}</Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Link href={href({ kind: '', page: undefined })} className={pill(!kind)}>{t('tab.all')}</Link>
        {EQUIPMENT_KINDS.map((k) => <Link key={k} href={href({ kind: k })} className={pill(kind === k)}>{t(`tab.${k}`)}</Link>)}
        <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
        <Link href={href({ deal: '' })} className={pill(!deal)}>{t('deal.all')}</Link>
        <Link href={href({ deal: 'RENT' })} className={pill(deal === 'RENT')}>{t('deal.RENT')}</Link>
        <Link href={href({ deal: 'SALE' })} className={pill(deal === 'SALE')}>{t('deal.SALE')}</Link>
      </div>

      <form className="mt-4 grid gap-3 rounded-card border border-line bg-white p-4 md:grid-cols-[1fr_1.3fr_auto]" action="/equipment">
        {Object.entries({ kind, deal, near, radius, corridor }).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
        <RegionFilter value={region} />
        <input name="q" defaultValue={raw.q} placeholder={t('filter.q')} className="rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/25" />
        <div className="flex gap-2">
          <Sel name="sort" value={raw.sort || 'new'} options={[['new', t('filter.sort.new')], ['price', t('filter.sort.price')], ...(near ? [['nearest', t('filter.sort.nearest')] as const] : [])]} />
          <button className="rounded-xl bg-navy px-5 py-3 font-semibold text-white hover:bg-navy-2">{tf('apply')}</button>
        </div>
      </form>
      <div className="mt-3"><NearMeButton path="/equipment" /></div>

      {chips.length || p?.unresolved.length ? (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {chips.map((c) => {
            const label = chipLabel(c, lang);
            return (
              <span key={c.key} className="inline-flex items-center gap-1 rounded-full bg-teal-soft py-1 pl-3 pr-1.5 text-sm font-semibold text-teal-ink">
                {label}
                <Link href={remove(c)} aria-label={tc('chips.remove', { label })} className="rounded-full px-1.5 leading-none hover:bg-teal/15">×</Link>
              </span>
            );
          })}
          {p?.unresolved.length ? <span className="text-xs text-muted">{tc('chips.unresolved', { words: p.unresolved.join(', ') })}</span> : null}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="font-mono text-sm text-navy tabular-nums">{decision}</p>
        <Link href={mapHref} className="text-xs font-semibold text-teal-ink underline decoration-dotted hover:text-navy">{th('viewOnMap')}</Link>
      </div>

      {data.items.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-line bg-white p-10 text-center">
          <p className="font-display text-lg font-bold text-navy">{t('empty.title')}</p>
          <p className="mx-auto mt-2 max-w-[52ch] text-muted">{t('empty.body')}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/dashboard/listings/new" className="rounded-full bg-teal px-6 py-3 font-semibold text-white transition hover:bg-teal-ink active:scale-[0.98]">{t('empty.cta')}</Link>
            {filtered ? <Link href="/equipment" className="text-sm font-semibold text-teal-ink underline">{t('empty.reset')}</Link> : null}
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {data.items.map((x) => <ListingCard key={x.id} l={x} />)}
          <Impressions kind="listing" ids={data.items.map((x) => x.id)} surface="list" />
        </div>
      )}

      {pages > 1 && (
        <nav aria-label={tp('aria')} className="mt-8 flex justify-center gap-2 font-mono text-sm">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link key={n} href={href({ page: n })} aria-current={n === data.page ? 'page' : undefined} className={`rounded-full px-3 py-1 ${n === data.page ? 'bg-navy text-white' : 'border border-line bg-white hover:bg-sand'}`}>{n}</Link>
          ))}
        </nav>
      )}
      <RegionChips base="/equipment" />
    </div>
  );
}
