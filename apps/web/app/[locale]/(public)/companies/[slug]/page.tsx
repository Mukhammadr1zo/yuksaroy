import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { GlobeIcon, PhoneIcon, TelegramLogoIcon } from '@phosphor-icons/react/dist/ssr';
import { type OrgKind, type SearchLang } from '@yuksaroy/domain';
import { sapiOrNull } from '@/lib/server-api';
import { num } from '@/lib/format';
import type { CompanyDetail } from '@/lib/types-listing';
import { ListingCard, regionName } from '@/components/catalog/ListingCard';
import { TerminalCard } from '@/components/catalog/TerminalCard';
import { KycBadge } from '@/components/catalog/KycBadge';
import { PhoneLink } from '@/components/catalog/PhoneLink';
import { MiniMap, type Pin } from '@/components/catalog/MiniMap';
import { Ld, alt, breadcrumbs, url } from '@/lib/seo';

type Params = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Params) {
  const { locale, slug } = await params;
  const o = await sapiOrNull<CompanyDetail>(`/companies/${slug}`, 60);
  return o ? { title: `${o.name} · YukSaroy`, description: o.description?.slice(0, 160) ?? o.name, ...alt(locale, `/companies/${slug}`) } : { title: 'YukSaroy' };
}

/** Kompaniya sahifasi: sarlavha (turlar, KYC, viloyat), uchta plitka, kontakt, terminallar, shahobcha yo'llar, e'lonlar, xarita. */
export default async function CompanyPage({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const lang = locale as SearchLang;
  const o = await sapiOrNull<CompanyDetail>(`/companies/${slug}`, 60);
  if (!o) notFound();
  const [t, tk] = await Promise.all([getTranslations('companies'), getTranslations('orgKind')]);
  const tg = o.telegram ? o.telegram.replace(/^@|^https?:\/\/t\.me\//, '') : null;
  const site = o.website ? (o.website.startsWith('http') ? o.website : `https://${o.website}`) : null;
  const pins: Pin[] = [
    ...o.terminals.filter((x) => x.lat != null && x.lng != null).map((x) => ({ lat: x.lat!, lng: x.lng!, color: '#002352' })),
    ...o.listings.filter((x) => x.lat != null && x.lng != null).map((x) => ({ lat: x.lat!, lng: x.lng!, color: '#FD7B03' })),
  ];
  const tiles = (['terminals', 'listings'] as const).map((k) => [k, o.counts[k]] as const);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Ld data={{ '@context': 'https://schema.org', '@type': 'Organization', name: o.name, url: url(locale, `/companies/${slug}`), address: o.regionCode ? { '@type': 'PostalAddress', addressRegion: o.regionCode, addressCountry: 'UZ' } : undefined, sameAs: [site, tg ? `https://t.me/${tg}` : null].filter(Boolean) }} />
      <Ld data={breadcrumbs(locale, [{ name: t('title'), path: '/companies' }, { name: o.name, path: `/companies/${slug}` }])} />
      <nav aria-label="Yo'l" className="font-mono text-xs text-muted"><Link href="/companies" className="hover:text-navy">{t('title')}</Link> / {o.name}</nav>
      <header className="mt-3 max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          {o.kinds.map((k) => <span key={k} className="rounded-full bg-teal-soft px-3 py-1 text-xs font-semibold text-teal-ink">{tk(k as OrgKind)}</span>)}
          <KycBadge kyc={o.kyc} size="md" />
        </div>
        <h1 className="font-display mt-3 text-3xl font-bold text-navy md:text-4xl">{o.name}</h1>
        {o.regionCode ? <p className="mt-2 text-muted">{regionName(o.regionCode, lang)}</p> : null}
      </header>

      <dl className="mt-6 grid grid-cols-3 gap-3">
        {tiles.map(([k, n]) => (
          <a key={k} href={`#${k}`} className="rounded-card border border-line bg-white px-4 py-3 transition hover:border-teal">
            <dd className={`font-display text-2xl font-bold tabular-nums ${n ? 'text-navy' : 'text-muted'}`}>{num(n, lang)}</dd>
            <dt className="text-xs text-muted">{t(`detail.${k}`)}</dt>
          </a>
        ))}
      </dl>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-8">
          {o.description ? <section><h2 className="text-lg font-bold">{t('detail.about')}</h2><p className="mt-2 whitespace-pre-line text-ink/85">{o.description}</p></section> : null}
          <section id="terminals">
            <h2 className="text-lg font-bold">{t('detail.terminals')}</h2>
            {o.terminals.length ? <div className="mt-3 grid gap-4">{o.terminals.map((x) => <TerminalCard key={x.id} t={x} />)}</div> : <p className="mt-2 text-sm text-muted">{t('detail.none')}</p>}
          </section>
          <section id="listings">
            <h2 className="text-lg font-bold">{t('detail.listings')}</h2>
            {o.listings.length ? <div className="mt-3 grid gap-4 md:grid-cols-2">{o.listings.map((x) => <ListingCard key={x.id} l={x} />)}</div> : <p className="mt-2 text-sm text-muted">{t('detail.none')}</p>}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-card border border-line bg-white p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('detail.contact')}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {tg ? <li className="flex items-center gap-2"><TelegramLogoIcon size={16} className="shrink-0 text-muted" aria-hidden="true" /><a href={`https://t.me/${tg}`} target="_blank" rel="noreferrer" className="font-semibold text-navy hover:text-teal-ink">@{tg}</a></li> : null}
              {site ? <li className="flex items-center gap-2"><GlobeIcon size={16} className="shrink-0 text-muted" aria-hidden="true" /><a href={site} target="_blank" rel="noreferrer" className="font-semibold text-navy hover:text-teal-ink">{site.replace(/^https?:\/\//, '')}</a></li> : null}
              <li className="flex items-center gap-2">
                {o.phone ? <PhoneLink phone={o.phone} kind="org" targetId={o.id} /> : <><PhoneIcon size={16} className="shrink-0 text-muted" aria-hidden="true" /><span className="text-muted">{t('detail.noPhone')}</span></>}
              </li>
            </ul>
            {!tg && !site ? <p className="mt-3 text-xs text-muted">{t('detail.noContact')}</p> : null}
          </section>
          {pins.length ? (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('detail.map')}</h2>
              <div className="mt-2"><MiniMap pins={pins} zoom={pins.length === 1 ? 11 : 7} className="h-64 w-full" /></div>
              <p className="mt-1 text-[11px] text-muted">{t('detail.mapNote')}</p>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
