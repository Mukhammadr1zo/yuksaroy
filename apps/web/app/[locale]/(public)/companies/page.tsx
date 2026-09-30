import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ORG_KINDS, type OrgKind, type SearchLang } from '@yuksaroy/domain';
import { sapi, qs } from '@/lib/server-api';
import type { CompanyCard } from '@/lib/types-listing';
import type { Page } from '@/lib/types';
import { DemoBadge, regionName } from '@/components/catalog/ListingCard';
import { KycBadge } from '@/components/catalog/KycBadge';
import { RegionFilter } from '@/components/catalog/RegionFilter';
import { Sel } from '@/components/catalog/Sel';
import { alt } from '@/lib/seo';
import { Pagination } from '@/components/catalog/Pagination';

export const revalidate = 60;
type Params = { params: Promise<{ locale: string }> };
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v.filter(Boolean).at(-1) : v) ?? '';
const KINDS = ORG_KINDS.filter((k) => k !== 'PLATFORM');

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'companies' });
  return { ...{ title: `${t('title')} · YukSaroy`, description: t('lead') }, ...alt(locale, '/companies') };
}

/** Kompaniyalar ro'yxati: tur, viloyat, nom bo'yicha filtr; karta: nom, KYC, turlar, obyekt sonlari. */
export default async function CompaniesPage({ params, searchParams }: Params & { searchParams: Promise<SP> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = locale as SearchLang;
  const [sp, t, tk, tf] = await Promise.all([searchParams, getTranslations('companies'), getTranslations('orgKind'), getTranslations('filter')]);
  const f = { kind: one(sp.kind), region: one(sp.region), q: one(sp.q) };
  const page = Number(one(sp.page)) || 1;
  const data = await sapi<Page<CompanyCard>>(`/companies${qs({ ...f, page, limit: 20 })}`, 60);
  const pages = Math.max(1, Math.ceil(data.total / data.limit));
  const filtered = !!(f.kind || f.region || f.q);
  const href = (n: number) => `/companies${qs({ ...f, page: n })}`;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-display text-3xl font-bold text-navy">{t('title')}</h1>
      <p className="mt-2 max-w-[64ch] text-muted">{t('lead')}</p>

      <form className="mt-6 grid gap-3 rounded-card border border-line bg-white p-4 md:grid-cols-[1fr_1fr_1.2fr_auto]" action="/companies">
        <Sel name="kind" value={f.kind} label={t('filter.kindAll')} options={KINDS.map((k) => [k, tk(k)])} />
        <RegionFilter value={f.region} />
        <input name="q" defaultValue={f.q} placeholder={t('filter.q')} className="rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/25" />
        <button className="rounded-xl bg-navy px-5 py-3 font-semibold text-white hover:bg-navy-2">{tf('apply')}</button>
      </form>
      <p className="mt-4 font-mono text-sm text-navy tabular-nums">{t('count', { count: data.total })}</p>

      {data.items.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-line bg-white p-10 text-center">
          <p className="font-display text-lg font-bold text-navy">{t('empty.title')}</p>
          {filtered ? <Link href="/companies" className="mt-3 inline-block text-sm font-semibold text-teal-ink underline">{t('empty.reset')}</Link> : null}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {data.items.map((o) => (
            <Link key={o.id} href={`/companies/${o.slug ?? o.id}`} className="group rounded-card border border-line bg-white p-4 text-ink transition hover:border-teal">
              <div className="flex items-start justify-between gap-2">
                <h2 className="min-w-0 truncate font-bold group-hover:text-teal-ink">{o.name}</h2>
                {o.isDemo ? <DemoBadge /> : <KycBadge kyc={o.kyc} />}
              </div>
              <p className="mt-0.5 text-xs text-muted">{regionName(o.regionCode, lang) || ' '}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {o.kinds.map((k) => <span key={k} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink/80">{tk(k as OrgKind)}</span>)}
              </div>
              <dl className="mt-3 flex gap-5 font-mono text-xs tabular-nums">
                {(['terminals', 'listings'] as const).map((c) => (
                  <div key={c} className="flex items-baseline gap-1"><dd className={`text-base font-semibold ${o.counts[c] ? 'text-navy' : 'text-muted'}`}>{o.counts[c]}</dd><dt className="text-muted">{t(`counts.${c}`)}</dt></div>
                ))}
              </dl>
            </Link>
          ))}
        </div>
      )}

      <Pagination page={data.page} pages={pages} href={href} />
    </div>
  );
}
