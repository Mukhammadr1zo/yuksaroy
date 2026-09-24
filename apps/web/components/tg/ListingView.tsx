import { getLocale, getTranslations } from 'next-intl/server';
import { LISTING_LABELS, SEARCH_LABELS, type SearchLang } from '@yuksaroy/domain';
import { redirect } from '@/i18n/navigation';
import { sapiOrNull } from '@/lib/server-api';
import { uzDate } from '@/lib/format';
import type { ListingDetail } from '@/lib/types-listing';
import { ListingContact } from '@/components/catalog/ListingContact';
import { listingPrice, regionName } from '@/components/tg/labels';
import { PhoneReveal } from '@/components/catalog/PhoneReveal';
import { DemoBadge } from '@/components/catalog/ListingCard';
import { PhotoGallery } from '@/components/catalog/PhotoGallery';
import { Impressions } from '@/components/catalog/Impressions';

/** /tg/equipment/[slug] va /tg/carriers/[slug]: ixcham e'lon tafsiloti. Tur mos kelmasa boshqa bo'limga o'tkaziladi (start_param listing_ uchun). */
export async function TgListingView({ slug, section }: { slug: string; section: 'equipment' | 'carriers' }) {
  const [lang, t, tl, tc] = await Promise.all([getLocale() as Promise<SearchLang>, getTranslations('tg.listing'), getTranslations('listing.detail'), getTranslations('tg.common')]);
  const l = await sapiOrNull<ListingDetail>(`/listings/${slug}`, 60);
  if (!l) return <main className="mx-auto max-w-md px-4 py-10 text-center text-sm text-muted">{t('notFound')}</main>;
  const truck = l.kind === 'TRUCK';
  if (truck !== (section === 'carriers')) redirect({ href: `/tg/${truck ? 'carriers' : 'equipment'}/${slug}`, locale: lang });
  const L = LISTING_LABELS[lang];
  const specs: [string, React.ReactNode][] = truck
    ? [
        [tl('truckType'), l.truckType ? L.truckType[l.truckType as keyof typeof L.truckType] ?? l.truckType : null],
        [tl('tonnage'), l.tonnage ? `${l.tonnage} t` : null],
        [tl('fleetSize'), l.fleetSize],
        [tl('model'), l.model],
        [tl('serviceRegions'), l.serviceRegions.length ? l.serviceRegions.map((r) => regionName(r, lang)).join(', ') : null],
        [tl('routes'), l.routes.length ? l.routes.map((r) => `${regionName(r.from, lang)} → ${regionName(r.to, lang)}`).join('; ') : null],
      ]
    : [
        [tl('year'), l.year],
        [tl('condition'), l.condition ? L.condition[l.condition] : null],
        [tl('model'), l.model],
        [tl('wagonType'), l.wagonType ? L.wagonType[l.wagonType as keyof typeof L.wagonType] ?? l.wagonType : null],
        [tl('qty'), l.kind === 'WAGON' || l.qty > 1 ? l.qty : null],
        [tl('capacityT'), l.capacityT ? `${l.capacityT} t` : null],
      ];
  specs.push([tl('region'), regionName(l.regionCode, lang)], [tl('published'), l.publishedAt ? uzDate(l.publishedAt, lang) : null]);
  const rows = specs.filter(([, v]) => v !== null && v !== undefined && v !== '');
  // Botda joy tor: ikkala gap bitta qatorda, bo'shlari tushib qoladi
  const sig = [
    l.signal?.seen ? tl(`signal.${l.signal.seen}`) : null,
    l.signal?.replied ? tl('signal.replied', l.signal.replied) : null,
  ].filter((x): x is string => x !== null);

  return (
    <main className="mx-auto max-w-md px-4 pb-8 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-teal-soft px-3 py-1 text-xs font-semibold text-teal-ink">{L.kind[l.kind]}</span>
        {l.isDemo ? <DemoBadge className="px-3 py-1 text-xs" /> : null}
        {l.deal ? <span className={`rounded-full px-3 py-1 font-mono text-xs font-semibold text-white ${l.deal === 'RENT' ? 'bg-teal' : 'bg-navy'}`}>{SEARCH_LABELS[lang].deal[l.deal]}</span> : null}
        {l.condition ? <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold">{L.condition[l.condition]}</span> : null}
      </div>
      <h1 className="font-display mt-2 text-xl font-bold">{l.title}</h1>
      <p className="mt-1 text-sm text-muted">{[regionName(l.regionCode, lang), l.year, l.model].filter(Boolean).join(' · ')}</p>

      {/* Botdagi ochilish ham sanalsin: veb sahifasi bilan bir xil mayoq, aks holda
          shaxsiy e'lon egasi botdan kelgan tashriflarni umuman ko'rmaydi */}
      <Impressions kind="listing" ids={[l.id]} surface="detail" />
      {l.photos.length ? <PhotoGallery photos={l.photos} alt={l.title} className="mt-3" /> : null}

      <section className="mt-3 rounded-card border border-line bg-white p-4">
        <p className="font-mono text-lg font-bold text-navy tabular-nums">{l.priceTiyin != null ? listingPrice(l.priceTiyin, l.priceUnit, lang) : tc('onRequest')}</p>
        {sig.length ? <p className="mt-0.5 text-xs text-muted">{sig.join(' · ')}</p> : null}
      </section>

      {rows.length ? (
        <section className="mt-3 rounded-card border border-line bg-white p-4">
          <h2 className="text-sm font-bold">{t('specs')}</h2>
          <dl className="mt-1 divide-y divide-line">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 py-1.5 text-sm"><dt className="text-muted">{k}</dt><dd className="text-right font-mono tabular-nums">{v}</dd></div>)}</dl>
        </section>
      ) : null}
      {l.description ? <p className="mt-3 whitespace-pre-line text-sm">{l.description}</p> : null}

      <section className="mt-3 rounded-card border border-line bg-white p-4">
        <h2 className="text-sm font-bold">{t('owner')}</h2>
        <p className="mt-1 text-sm">{l.owner.name}{l.owner.type === 'org' && l.owner.kyc === 'VERIFIED' ? <span className="ml-2 rounded-full bg-teal-soft px-2 py-0.5 text-[11px] font-semibold text-teal-ink">KYC</span> : null}</p>
        {/* Namuna e'londa telefon va so'rov yo'q: bot ichida ham haqiqiy taklifdek ko'rinmasin */}
        {l.isDemo ? <p className="mt-2 rounded-xl border border-dashed border-line bg-sand px-3 py-2 text-xs text-muted">{tl('demoNote')}</p> : (
          <>
            {l.hasPhone ? <p className="mt-2"><PhoneReveal kind="listing" targetId={l.id} next={`/tg/${l.kind === 'TRUCK' ? 'carriers' : 'equipment'}/${l.slug}`} /></p> : null}
            <div className="mt-3"><ListingContact endpoint={`/listings/${l.id}/inquiries`} next={`/tg/${l.kind === 'TRUCK' ? 'carriers' : 'equipment'}/${l.slug}`} /></div>
            <p className="mt-2 text-[11px] text-muted">{t('loginNote')}</p>
          </>
        )}
      </section>
    </main>
  );
}
