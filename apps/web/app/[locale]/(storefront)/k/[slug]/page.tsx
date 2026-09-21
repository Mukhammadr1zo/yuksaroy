import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { GlobeIcon, TelegramLogoIcon } from '@phosphor-icons/react/dist/ssr';
import type { OrgKind, SearchLang } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { sapiOrNull } from '@/lib/server-api';
import { PhoneReveal } from '@/components/catalog/PhoneReveal';
import { num } from '@/lib/format';
import type { CompanyStorefront } from '@/lib/types-urgent';
import { DemoBadge, ListingCard, regionName } from '@/components/catalog/ListingCard';
import { TerminalCard } from '@/components/catalog/TerminalCard';
import { KycBadge } from '@/components/catalog/KycBadge';
import { OrgMap } from './OrgMap';
import { LogoMark } from '@/components/site/Logo';
import { url } from '@/lib/seo';

type Params = { params: Promise<{ locale: string; slug: string }> };
const load = (slug: string) => sapiOrNull<CompanyStorefront>(`/companies/${slug}`, 60);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const [o, t] = await Promise.all([load(slug), getTranslations({ locale, namespace: 'storefront.public' })]);
  if (!o) return { title: 'YukSaroy' };
  const sf = o.storefront ?? {};
  const description = sf.tagline || sf.about?.slice(0, 160) || o.description?.slice(0, 160) || t('meta', { name: o.name });
  const img = sf.coverUrl || sf.logoUrl;
  // Bir tashkilotning ikkinchi URL'i: canonical asosiy /companies/<slug> sahifasiga
  return { title: `${o.name} · YukSaroy`, description, alternates: { canonical: url(locale, `/companies/${slug}`) }, openGraph: { title: o.name, description, ...(img ? { images: [img] } : {}) } };
}

/** Do'kon: muqova, logotip, nom, KYC, shior, kontakt, terminallar, e'lonlar, shahobcha yo'llar, xarita. Ichki (kabinet) matnlar yo'q. */
export default async function ShopPage({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const lang = locale as SearchLang;
  const o = await load(slug);
  if (!o) notFound();
  const sf = o.storefront ?? {};
  const [t, tk] = await Promise.all([getTranslations('storefront.public'), getTranslations('orgKind')]);
  const tg = (sf.contactTelegram || o.telegram || '').replace(/^@|^https?:\/\/t\.me\//, '') || null;
  const site = o.website ? (o.website.startsWith('http') ? o.website : `https://${o.website}`) : null;
  const about = sf.about || o.description || null;
  const terminals = sf.showTerminals === false ? [] : o.terminals;
  const listings = sf.showListings === false ? [] : o.listings;
  // Xarita: MapView compact, /v1/map-objects.geojson mijozda tashkilot obyektlari kalitlari (kind:id) bo'yicha filtrlanadi
  const mapKeys = [
    ...terminals.filter((x) => x.lat != null && x.lng != null).map((x) => `terminal:${x.id}`),
    ...listings.filter((x) => x.lat != null && x.lng != null).map((x) => `${x.kind === 'TRUCK' ? 'truck' : 'equipment'}:${x.id}`),
  ];
  const empty = !about && !terminals.length && !listings.length;

  return (
    <>
      <div
        className="relative h-44 bg-gradient-to-r from-navy to-teal md:h-64"
        style={sf.coverUrl ? { backgroundImage: `url(${sf.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        <Link href="/" aria-label="YukSaroy" className="absolute right-4 top-4 rounded-full bg-white/90 p-1.5"><LogoMark size={28} /></Link>
      </div>

      <div className="mx-auto max-w-6xl px-6 pb-16">
        <header className="-mt-12 flex flex-wrap items-start gap-4">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-card border border-line bg-white">
            {sf.logoUrl ? <img src={sf.logoUrl} alt="" className="h-full w-full object-cover" /> : <span className="font-display text-3xl font-bold text-navy">{o.name.slice(0, 1)}</span>}
          </div>
          <div className="min-w-0 flex-1 pt-14">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-navy md:text-4xl">{o.name}</h1>
              {o.isDemo ? <DemoBadge className="px-3 py-1 text-xs" /> : <KycBadge kyc={o.kyc} size="md" />}
            </div>
            {sf.tagline ? <p className="mt-1 text-lg text-ink/85">{sf.tagline}</p> : null}
            <p className="mt-1 text-sm text-muted">{o.kinds.map((k) => tk(k as OrgKind)).join(' · ')}{o.regionCode ? ` · ${regionName(o.regionCode, lang)}` : ''}</p>
          </div>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-10">
            {about ? <section><h2 className="text-lg font-bold">{t('about')}</h2><p className="mt-2 whitespace-pre-line text-ink/85">{about}</p></section> : null}
            {terminals.length ? (
              <section>
                <h2 className="text-lg font-bold">{t('terminals')}</h2>
                <div className="mt-3 grid gap-4">{terminals.map((x) => <TerminalCard key={x.id} t={x} />)}</div>
              </section>
            ) : null}
            {listings.length ? (
              <section>
                <h2 className="text-lg font-bold">{t('listings')}</h2>
                <div className="mt-3 grid gap-4 md:grid-cols-2">{listings.map((x) => <ListingCard key={x.id} l={x} />)}</div>
              </section>
            ) : null}
            {empty ? <p className="text-muted">{t('none')}</p> : null}
          </div>

          <aside className="space-y-6">
            <section className="rounded-card border border-line bg-white p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('contact')}</h2>
              <div className="mt-3 flex flex-col gap-2">
                {tg ? <a href={`https://t.me/${tg}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-teal px-5 py-2.5 font-semibold text-white transition hover:bg-teal-ink"><TelegramLogoIcon size={18} aria-hidden="true" />{t('telegram')}</a> : null}
                {/* Raqam obunachiga, bosilganda: do'kon sahifasi ham umumiy qoidaga bo'ysunadi */}
                {o.hasPhone ? <PhoneReveal kind="org" targetId={slug} next={`/k/${slug}`} /> : null}
                {site ? <a href={site} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-navy hover:text-teal-ink"><GlobeIcon size={16} aria-hidden="true" />{site.replace(/^https?:\/\//, '')}</a> : null}
                {!tg && !o.hasPhone && !site ? <p className="text-sm text-muted">{t('noContact')}</p> : null}
              </div>
            </section>
            {mapKeys.length ? (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('map')}</h2>
                <div className="mt-2"><OrgMap only={mapKeys} /></div>
                <p className="mt-1 text-[11px] text-muted">{t('mapNote')}</p>
              </section>
            ) : null}
          </aside>
        </div>

        <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-sm text-muted">
          <Link href="/" className="inline-flex items-center gap-2 hover:text-navy"><LogoMark size={20} />{t('with')}</Link>
          <Link href={`/companies/${o.slug ?? o.id}`} className="font-semibold text-teal-ink hover:text-navy">{t('fullProfile')}</Link>
        </footer>
      </div>
    </>
  );
}
