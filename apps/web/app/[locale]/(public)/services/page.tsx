import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FileTextIcon, PackageIcon, ReceiptIcon } from '@phosphor-icons/react/dist/ssr';
import { REGIONS, SEARCH_LABELS, SERVICE_TYPES, SERVICE_TYPE_LABELS, type RegionCode, type SearchLang, type ServiceType } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { qs, sapi } from '@/lib/server-api';
import type { MarketRequest, Paged, ServiceProfileCard } from '@/lib/types-market';
import { alt } from '@/lib/seo';
import { Sel } from '@/components/catalog/Sel';
import { Pagination } from '@/components/catalog/Pagination';
import { DashLink } from '@/components/site/DashLink';
import { RequestCard } from '@/components/market/RequestCard';

export const revalidate = 60;
type Params = { params: Promise<{ locale: string }> };
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v.at(-1) : v) ?? '';
const ICON: Record<ServiceType, typeof PackageIcon> = { FORWARDER: PackageIcon, CASHIER: ReceiptIcon, DOCS: FileTextIcon };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'services.meta' });
  return { title: t('title'), description: t('description'), ...alt(locale, '/services') };
}

/** Xizmatlar markazi: kim xizmat ko'rsatadi (profillar), kimga xizmat kerak (ochiq so'rovlar), ikkita CTA. */
export default async function ServicesPage({ params, searchParams }: Params & { searchParams: Promise<SP> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = (['uz', 'ru', 'en'].includes(locale) ? locale : 'uz') as SearchLang;
  const [sp, t] = await Promise.all([searchParams, getTranslations('services')]);
  const type = (SERVICE_TYPES as readonly string[]).includes(one(sp.type)) ? one(sp.type) : '';
  const region = (REGIONS as readonly string[]).includes(one(sp.region)) ? one(sp.region) : '';
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const limit = 24;
  const [profiles, requests] = await Promise.all([
    sapi<Paged<ServiceProfileCard>>(`/services/profiles${qs({ type, region, page, limit })}`, 60),
    sapi<Paged<MarketRequest>>(`/market/requests${qs({ board: 'SERVICE', type, region, limit: 6 })}`, 60),
  ]);
  const pages = Math.max(1, Math.ceil(profiles.total / limit));
  const regionName = (c: string) => SEARCH_LABELS[lang].region[c as RegionCode] ?? c;
  const href = (over: { type?: string; region?: string; page?: number }) => `/services${qs({ type, region, ...over, page: over.page && over.page > 1 ? over.page : '' })}`;
  const chip = (on: boolean) => `rounded-full px-4 py-2 text-sm font-semibold transition ${on ? 'bg-navy text-white' : 'border border-line bg-white text-muted hover:border-teal hover:text-ink'}`;

  return (
    <>
      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
          <p className="font-mono text-xs uppercase tracking-wide text-teal-ink">{t('hero.eyebrow')}</p>
          <h1 className="font-display mt-3 max-w-[22ch] text-3xl font-bold text-navy md:text-5xl">{t('hero.title')}</h1>
          <p className="mt-4 max-w-[62ch] text-lg text-muted">{t('hero.lead')}</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:max-w-3xl">
            <div className="rounded-card border border-line bg-sand p-5">
              <Link href="/services/request" className="inline-block rounded-full bg-teal px-6 py-2.5 font-semibold text-white transition hover:bg-teal-ink active:scale-[0.98]">{t('hero.ctaAsk')}</Link>
              <p className="mt-2 text-sm text-muted">{t('hero.ctaAskNote')}</p>
            </div>
            <div className="rounded-card border border-line bg-sand p-5">
              <DashLink href="/dashboard/market?tab=profile" className="inline-block rounded-full border border-navy bg-white px-6 py-2.5 font-semibold text-navy transition hover:bg-navy hover:text-white active:scale-[0.98]">{t('hero.ctaOffer')}</DashLink>
              <p className="mt-2 text-sm text-muted">{t('hero.ctaOfferNote')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-4 md:grid-cols-3">
          {SERVICE_TYPES.map((k) => {
            const Icon = ICON[k];
            return (
              <Link key={k} href={href({ type: type === k ? '' : k, page: 1 })} aria-current={type === k ? 'true' : undefined}
                className={`rounded-card border p-5 transition ${type === k ? 'border-navy bg-navy text-white' : 'border-line bg-white hover:border-teal'}`}>
                <Icon size={28} weight="duotone" className={type === k ? 'text-white' : 'text-teal'} aria-hidden="true" />
                <h2 className="mt-3 text-lg font-bold">{SERVICE_TYPE_LABELS[lang][k]}</h2>
                <p className={`mt-1 text-sm ${type === k ? 'text-white/80' : 'text-muted'}`}>{t(`types.${k}`)}</p>
              </Link>
            );
          })}
        </div>

        <form method="get" className="mt-6 flex flex-wrap items-center gap-3">
          {type ? <input type="hidden" name="type" value={type} /> : null}
          <Link href={href({ type: '', page: 1 })} className={chip(!type)}>{t('types.all')}</Link>
          <div className="min-w-[220px] flex-1 sm:max-w-xs">
            <Sel name="region" value={region} label={t('filter.regionAll')} aria={t('filter.region')} options={REGIONS.map((r) => [r, regionName(r)] as const)} />
          </div>
          <button type="submit" className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white transition hover:bg-navy-2">{t('filter.apply')}</button>
        </form>

        <div className="mt-8 flex flex-wrap items-baseline gap-3">
          <h2 className="font-display text-2xl font-bold text-navy">{t('grid.title')}</h2>
          <span className="font-mono text-sm text-muted tabular-nums">{t('grid.count', { count: profiles.total })}</span>
        </div>
        {profiles.items.length === 0 ? (
          <p className="mt-6 rounded-card border border-dashed border-line bg-white p-10 text-center text-muted">{t('grid.empty')}</p>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {profiles.items.map((p) => (
              <article key={p.id} className="flex min-w-0 flex-col rounded-card border border-line bg-white p-5 transition hover:border-teal">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-teal-soft px-2.5 py-0.5 text-xs font-semibold text-teal-ink">{SERVICE_TYPE_LABELS[lang][p.serviceType]}</span>
                  {p.isDemo ? <span className="rounded-full border border-amber/40 bg-amber-soft px-2.5 py-0.5 text-[11px] font-semibold text-amber-ink">{t('demo')}</span> : null}
                  {p.experienceYears != null ? <span className="ml-auto font-mono text-xs text-muted tabular-nums">{t('grid.years', { n: p.experienceYears })}</span> : null}
                </div>
                <h3 className="font-display mt-3 text-lg font-bold text-navy wrap-anywhere"><Link href={`/services/${p.id}`} className="hover:text-teal-ink">{p.title}</Link></h3>
                {p.owner ? <p className="mt-0.5 text-sm text-muted wrap-anywhere">{p.owner}</p> : null}
                <p className="mt-2 line-clamp-3 text-sm text-ink/85 wrap-anywhere">{p.description}</p>
                <p className="mt-3 text-xs text-muted wrap-anywhere">{p.regions.length ? p.regions.map(regionName).join(', ') : t('grid.regionsAll')}</p>
                {/* Faqat noldan katta bo'lsa: yangi odamda "0" turgani qaror bermaydi */}
                {p.doneCount ? <p className="mt-2 font-mono text-xs font-semibold tabular-nums text-teal-ink">{t('grid.done', { count: p.doneCount })}</p> : null}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
                  <span className="font-mono text-navy tabular-nums wrap-anywhere">{p.priceNote ?? t('grid.noPrice')}</span>
                  <Link href={`/services/${p.id}`} className="font-semibold text-navy underline-offset-4 hover:text-teal-ink hover:underline">{t('grid.more')}</Link>
                </div>
              </article>
            ))}
          </div>
        )}
        <Pagination page={page} pages={pages} href={(p) => href({ page: p })} />
      </section>

      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <h2 className="font-display text-2xl font-bold text-navy">{t('requests.title')}</h2>
          <p className="mt-1 max-w-[62ch] text-muted">{t('requests.lead')}</p>
          {requests.items.length === 0 ? (
            <p className="mt-6 rounded-card border border-dashed border-line bg-sand p-8 text-center text-muted">{t('requests.empty')}</p>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {requests.items.map((r) => <RequestCard key={r.id} r={r} cta={t('requests.offerCta')} />)}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
