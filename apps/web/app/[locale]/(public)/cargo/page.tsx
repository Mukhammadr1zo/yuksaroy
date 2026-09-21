import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LISTING_LABELS, REGIONS, SEARCH_LABELS, TRUCK_TYPES, type SearchLang } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { qs, sapi } from '@/lib/server-api';
import type { MarketRequest, Paged } from '@/lib/types-market';
import { alt } from '@/lib/seo';
import { Sel } from '@/components/catalog/Sel';
import { Pagination } from '@/components/catalog/Pagination';
import { RequestCard } from '@/components/market/RequestCard';

export const revalidate = 60;
type Params = { params: Promise<{ locale: string }> };
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v.at(-1) : v) ?? '';
const pick = (list: readonly string[], v: string) => (list.includes(v) ? v : '');

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'cargo.meta' });
  return { title: t('title'), description: t('description'), ...alt(locale, '/cargo') };
}

/** Yuk bozori: ochiq yuklar, yo'nalish va kuzov filtri, katta "Yuk e'lon qilish" tugmasi. */
export default async function CargoPage({ params, searchParams }: Params & { searchParams: Promise<SP> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = (['uz', 'ru', 'en'].includes(locale) ? locale : 'uz') as SearchLang;
  const [sp, t] = await Promise.all([searchParams, getTranslations('cargo')]);
  const from = pick(REGIONS, one(sp.from));
  const to = pick(REGIONS, one(sp.to));
  const truckType = pick(TRUCK_TYPES, one(sp.truckType));
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const limit = 18;
  const data = await sapi<Paged<MarketRequest>>(`/market/requests${qs({ board: 'CARGO', from, to, truckType, page, limit })}`, 60);
  const pages = Math.max(1, Math.ceil(data.total / limit));
  const regionOpts = REGIONS.map((r) => [r, SEARCH_LABELS[lang].region[r]] as const);
  const truckOpts = TRUCK_TYPES.map((x) => [x, LISTING_LABELS[lang].truckType[x]] as const);
  const filtered = !!(from || to || truckType);

  return (
    <>
      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
          <p className="font-mono text-xs uppercase tracking-wide text-teal-ink">{t('hero.eyebrow')}</p>
          <h1 className="font-display mt-3 max-w-[22ch] text-3xl font-bold text-navy md:text-5xl">{t('hero.title')}</h1>
          <p className="mt-4 max-w-[62ch] text-lg text-muted">{t('hero.lead')}</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/cargo/new" className="rounded-full bg-teal px-7 py-3 font-semibold text-white transition hover:bg-teal-ink active:scale-[0.98]">{t('hero.cta')}</Link>
            <span className="text-sm text-muted">{t('hero.ctaNote')}</span>
          </div>
          <p className="mt-4 text-sm text-muted">{t('hero.forCarriers')}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <form method="get" className="grid gap-3 rounded-card border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <Sel name="from" value={from} label={`${t('filter.from')}: ${t('filter.any')}`} aria={t('filter.from')} options={regionOpts} />
          <Sel name="to" value={to} label={`${t('filter.to')}: ${t('filter.any')}`} aria={t('filter.to')} options={regionOpts} />
          <Sel name="truckType" value={truckType} label={`${t('filter.truck')}: ${t('filter.any')}`} aria={t('filter.truck')} options={truckOpts} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white transition hover:bg-navy-2">{t('filter.apply')}</button>
            {filtered ? <Link href="/cargo" className="text-sm font-semibold text-teal-ink hover:text-navy">{t('filter.reset')}</Link> : null}
          </div>
        </form>

        <div className="mt-8 flex flex-wrap items-baseline gap-3">
          <h2 className="font-display text-2xl font-bold text-navy">{t('board.title')}</h2>
          <span className="font-mono text-sm text-muted tabular-nums">{t('board.count', { count: data.total })}</span>
        </div>
        {data.items.length === 0 ? (
          <p className="mt-6 rounded-card border border-dashed border-line bg-white p-10 text-center text-muted">{t('board.empty')}</p>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.items.map((r) => <RequestCard key={r.id} r={r} />)}
          </div>
        )}
        <Pagination page={page} pages={pages} href={(p) => `/cargo${qs({ from, to, truckType, page: p > 1 ? p : '' })}`} />
      </section>
    </>
  );
}
