import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { EyeIcon } from '@phosphor-icons/react/dist/ssr';
import { Link } from '@/i18n/navigation';
import { LISTING_LABELS, LISTING_OWNER_LABELS, SEARCH_LABELS, formatSom, type SearchLang } from '@yuksaroy/domain';
import { sapi, sapiOrNull } from '@/lib/server-api';
import { num, uzDate } from '@/lib/format';
import type { ListingDetail, ListingPage } from '@/lib/types-listing';
import { DemoBadge, KIND_ICON, ListingCard, listingHref, regionName } from './ListingCard';
import { KycBadge, PhoneBadge } from './KycBadge';
import { ChatLauncher } from '@/components/chat/ChatPanel';
import { PhoneReveal } from './PhoneReveal';
import { MiniMap } from './MiniMap';
import { PhotoGallery } from './PhotoGallery';
import { PremiumBadge } from './PremiumBadge';
import { Impressions } from './Impressions';
import { ListingReviews } from '@/components/reviews/ListingReviews';

type Section = 'equipment' | 'carriers';

export async function listingMetadata(slug: string) {
  const l = await sapiOrNull<ListingDetail>(`/listings/${slug}`, 60);
  return l ? { title: `${l.title} · YukSaroy`, description: l.description?.slice(0, 160) ?? l.title } : { title: 'YukSaroy' };
}

/** /equipment/[slug] va /carriers/[slug] uchun bitta tafsilot: galereya, xususiyatlar, narx, egasi, so'rov, xarita, o'xshashlar. */
export async function ListingDetailView({ slug, section }: { slug: string; section: Section }) {
  const l = await sapiOrNull<ListingDetail>(`/listings/${slug}`, 60);
  if (!l || (l.kind === 'TRUCK') !== (section === 'carriers')) notFound();
  const [lang, t] = await Promise.all([getLocale() as Promise<SearchLang>, getTranslations('listing.detail')]);
  const L = LISTING_LABELS[lang];
  const truck = l.kind === 'TRUCK';
  const similar = await sapi<ListingPage>(`/listings?kind=${l.kind}&region=${l.regionCode}&limit=4`, 60).then((d) => d.items.filter((x) => x.id !== l.id).slice(0, 3)).catch(() => []);
  const Icon = KIND_ICON[l.kind];
  const sectionTitle = truck ? SEARCH_LABELS[lang].category.truck : SEARCH_LABELS[lang].category.equipment;

  const specs: [string, React.ReactNode][] = truck
    ? [
        [t('truckType'), l.truckType ? L.truckType[l.truckType as keyof typeof L.truckType] ?? l.truckType : null],
        [t('tonnage'), l.tonnage ? `${l.tonnage} t` : null],
        [t('fleetSize'), l.fleetSize],
        [t('model'), l.model],
        [t('serviceRegions'), l.serviceRegions.length ? <span className="flex flex-wrap justify-end gap-1">{l.serviceRegions.map((r) => <span key={r} className="rounded-full bg-teal-soft px-2 py-0.5 text-[11px] font-semibold text-teal-ink">{regionName(r, lang)}</span>)}</span> : null],
        [t('routes'), l.routes.length ? <span className="flex flex-col items-end gap-0.5">{l.routes.map((r, i) => <span key={i}>{regionName(r.from, lang)} → {regionName(r.to, lang)}</span>)}</span> : null],
      ]
    : [
        [t('year'), l.year],
        [t('condition'), l.condition ? L.condition[l.condition] : null],
        [t('model'), l.model],
        [t('wagonType'), l.wagonType ? L.wagonType[l.wagonType as keyof typeof L.wagonType] ?? l.wagonType : null],
        [t('qty'), l.kind === 'WAGON' || l.qty > 1 ? l.qty : null],
        [t('capacityT'), l.capacityT ? `${l.capacityT} t` : null],
      ];
  specs.push([t('region'), regionName(l.regionCode, lang)], [t('published'), l.publishedAt ? uzDate(l.publishedAt, lang) : null]);
  const rows = specs.filter(([, v]) => v !== null && v !== undefined && v !== '');

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Impressions kind="listing" ids={[l.id]} surface="detail" />
      <nav aria-label="Yo'l" className="font-mono text-xs text-muted"><Link href={`/${section}`} className="hover:text-navy">{sectionTitle}</Link> / {regionName(l.regionCode, lang)}</nav>
      <header className="mt-3 max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-teal-soft px-3 py-1 text-xs font-semibold text-teal-ink">{L.kind[l.kind]}</span>
          {l.isDemo ? <DemoBadge className="px-3 py-1 text-xs" /> : null}
          {l.premium ? <PremiumBadge className="px-3 py-1 text-xs" /> : null}
          {l.deal ? <span className={`rounded-full px-3 py-1 font-mono text-xs font-semibold text-white ${l.deal === 'RENT' ? 'bg-teal' : 'bg-navy'}`}>{SEARCH_LABELS[lang].deal[l.deal]}</span> : null}
          {l.condition ? <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-ink/80">{L.condition[l.condition]}</span> : null}
        </div>
        <h1 className="font-display mt-3 text-3xl font-bold text-navy md:text-4xl">{l.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-muted">{[regionName(l.regionCode, lang), l.year, l.model].filter(Boolean).join(' · ')}</p>
          {/* Ko'rishlar jadval qatorida ko'zga tashlanmasdi: sarlavha ostida, ko'z belgisi bilan.
              Namuna e'londa ham chiqadi: son haqiqiy, yorliq esa e'lon taklif emasligini aytadi. */}
          <span aria-label={t('viewsShort', { count: l.views })} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sand px-3 py-1 font-mono text-xs font-semibold text-ink ring-1 ring-line tabular-nums">
            <EyeIcon size={15} weight="duotone" className="text-teal-ink" aria-hidden="true" />
            {num(l.views, lang)}
          </span>
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-8">
          <section>
            <PhotoGallery
              photos={l.photos} alt={l.title}
              fallback={<div className="flex h-full w-full items-center justify-center text-navy/30"><Icon size={96} weight="duotone" aria-hidden="true" /></div>}
            />
          </section>
          {l.description ? <p className="whitespace-pre-line text-ink/85">{l.description}</p> : null}
          <section>
            <h2 className="text-lg font-bold">{t('specs')}</h2>
            <dl className="mt-3 overflow-hidden rounded-card border border-line bg-white">
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-4 border-t border-line/70 px-4 py-2.5 text-sm first:border-t-0">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-mono font-semibold text-navy tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
          {similar.length ? (
            <section>
              <h2 className="text-lg font-bold">{t('similar')}</h2>
              <div className="mt-3 grid gap-4 md:grid-cols-2">{similar.map((x) => <ListingCard key={x.id} l={x} />)}</div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          <section className="rounded-card border border-line bg-white p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('price')}</h2>
            {l.priceTiyin != null ? (
              <p className="mt-1 font-display text-2xl font-bold text-navy tabular-nums">{formatSom(l.priceTiyin, lang)}{l.priceUnit && l.priceUnit !== 'TOTAL' ? <span className="ml-2 font-mono text-sm font-normal text-muted">{L.priceUnit[l.priceUnit]}</span> : null}</p>
            ) : <p className="mt-1 font-display text-xl font-bold text-navy">{t('onRequest')}</p>}
            {/* Namuna e'londa telefon ham, yozishma ham yo'q: odam haqiqiy taklif deb so'rov yubormasin */}
            {l.isDemo ? <p className="mt-4 rounded-xl border border-dashed border-line bg-sand px-3 py-2 text-sm text-muted">{t('demoNote')}</p> : (
              <div className="mt-4 space-y-3">
                {l.hasPhone ? <PhoneReveal kind="listing" targetId={l.id} next={listingHref(l)} /> : <p className="text-sm text-muted">{t('noPhone')}</p>}
                <ChatLauncher target={{ kind: 'listing', id: l.id, title: l.title }} next={listingHref(l)} />
              </div>
            )}
            {/* Egasi o'zi yozgan javob muddati emas, o'lchangani: qachon kirgani va
                kelgan yozishmalarning nechtasiga javob bergani. Ikkalasi ham bo'lmasa
                (yangi egada shunday) qator umuman chizilmaydi */}
            {l.signal?.seen || l.signal?.replied ? (
              <div className="mt-4 space-y-1.5 border-t border-line/70 pt-3 text-xs">
                {l.signal?.seen ? (
                  <p className="flex items-center gap-2 text-muted">
                    <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${l.signal.seen === 'away' ? 'bg-line' : 'bg-teal'}`} />
                    {t(`signal.${l.signal.seen}`)}
                  </p>
                ) : null}
                {l.signal?.replied ? (
                  <p className="font-mono tabular-nums text-ink">{t('signal.replied', l.signal.replied)}</p>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="rounded-card border border-line bg-white p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('owner')}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="font-semibold">{l.owner.name}</span>
              {l.owner.type === 'org' ? <KycBadge kyc={l.owner.kyc} /> : <PhoneBadge verified={l.owner.phoneVerified} />}
            </div>
            {l.owner.type === 'person' ? <p className="mt-1 text-xs text-muted">{LISTING_OWNER_LABELS[lang].person}</p>
              : l.owner.slug ? <Link href={`/companies/${l.owner.slug}`} className="mt-2 inline-block text-sm font-semibold text-teal-ink underline">{t('companyPage')} →</Link> : null}
            {l.object ? (
              <p className="mt-3 border-t border-line/70 pt-3 text-sm">
                <span className="text-xs text-muted">{t('object')}</span><br />
                <Link href={`/terminals/${l.object.slug}`} className="font-semibold text-navy hover:text-teal-ink">{l.object.name} →</Link>
              </p>
            ) : null}
          </section>

          {l.lat != null && l.lng != null ? (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('map')}</h2>
              <div className="mt-2"><MiniMap pins={[{ lat: l.lat, lng: l.lng }]} zoom={l.object ? 12 : 8} /></div>
              <p className="mt-1 text-[11px] text-muted">{t('mapNote')}</p>
            </section>
          ) : null}
        </aside>
      </div>

      <div className="mt-10 max-w-3xl">
        <ListingReviews listingId={l.id} slug={l.slug} />
      </div>
    </div>
  );
}
