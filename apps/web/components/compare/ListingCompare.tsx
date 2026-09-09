import { getTranslations } from 'next-intl/server';
import { KYC_STATUS_LABELS, LISTING_LABELS, SEARCH_LABELS, type SearchLang } from '@yuksaroy/domain';
import { sapiOrNull } from '@/lib/server-api';
import type { ListingDetail } from '@/lib/types-listing';
import { listingHref, listingPrice, regionName } from '@/components/catalog/ListingCard';
import { CompareTable, type CompareRow } from './CompareTable';
import { Impressions } from '@/components/catalog/Impressions';

/** E'lonlarni solishtirish: equipment (temir yo'l) va carriers (TRUCK) bitta komponent, qatorlar turga qarab. */
export async function ListingCompare({ cat, slugs, lang }: { cat: 'equipment' | 'carriers'; slugs: string[]; lang: SearchLang }) {
  const [t, tc, found] = await Promise.all([
    getTranslations('compare'), getTranslations('listing.card'),
    Promise.all(slugs.map((s) => sapiOrNull<ListingDetail>(`/listings/${encodeURIComponent(s)}`, 60).catch(() => null))),
  ]);
  const truck = cat === 'carriers';
  // Boshqa kategoriya e'loni bu jadvalga tushmaydi (URL qo'lda o'zgartirilgan bo'lsa)
  const items = found.filter((x): x is ListingDetail => !!x && (x.kind === 'TRUCK') === truck);
  const L = LISTING_LABELS[lang];
  const none = t('none');
  const v = (f: (l: ListingDetail) => React.ReactNode) => items.map(f);
  const rows: CompareRow[] = truck ? [
    { label: t('row.truckType'), values: v((l) => (l.truckType ? L.truckType[l.truckType as keyof typeof L.truckType] ?? l.truckType : none)) },
    { label: t('row.tonnage'), values: v((l) => (l.tonnage ? t('unit.t', { n: l.tonnage }) : none)) },
    { label: t('row.fleetSize'), values: v((l) => (l.fleetSize ? t('unit.trucks', { n: l.fleetSize }) : none)) },
    { label: t('row.price'), values: v((l) => (l.priceTiyin != null ? listingPrice(l.priceTiyin, l.priceUnit, lang) : t('onRequest'))) },
    { label: t('row.region'), values: v((l) => regionName(l.regionCode, lang)) },
    { label: t('row.serviceRegions'), values: v((l) => <span className="font-body text-xs">{l.serviceRegions.map((r) => regionName(r, lang)).join(', ') || none}</span>) },
    { label: t('row.routes'), values: v((l) => <span className="font-body text-xs">{l.routes.length ? l.routes.map((r) => `${regionName(r.from, lang)} > ${regionName(r.to, lang)}`).join('; ') : none}</span>) },
  ] : [
    { label: t('row.kind'), values: v((l) => L.kind[l.kind]) },
    { label: t('row.deal'), values: v((l) => (l.deal ? SEARCH_LABELS[lang].deal[l.deal] : none)) },
    { label: t('row.price'), values: v((l) => (l.priceTiyin != null ? listingPrice(l.priceTiyin, l.priceUnit, lang) : t('onRequest'))) },
    { label: t('row.year'), values: v((l) => l.year ?? none) },
    { label: t('row.condition'), values: v((l) => (l.condition ? L.condition[l.condition] : none)) },
    { label: t('row.model'), values: v((l) => l.model ?? none) },
    { label: t('row.qty'), values: v((l) => t('unit.pcs', { n: l.qty })) },
    ...(items.some((l) => l.wagonType) ? [{ label: t('row.wagonType'), values: v((l) => (l.wagonType ? L.wagonType[l.wagonType as keyof typeof L.wagonType] ?? l.wagonType : none)) }] : []),
    { label: t('row.capacityT'), values: v((l) => (l.capacityT ? t('unit.t', { n: l.capacityT }) : none)) },
    { label: t('row.region'), values: v((l) => regionName(l.regionCode, lang)) },
    { label: t('row.object'), values: v((l) => (l.object ? <span className="font-body text-xs">{l.object.name}</span> : none)) },
  ];
  rows.push(
    { label: t('row.owner'), values: v((l) => <span className="font-body">{l.owner.name}</span>) },
    { label: t('row.kyc'), values: v((l) => <span className={`font-body text-xs ${(l.owner.type === 'org' ? l.owner.kyc === 'VERIFIED' : l.owner.phoneVerified) ? 'font-semibold text-teal-ink' : 'text-muted'}`}>{l.owner.type === 'org' ? KYC_STATUS_LABELS[lang][l.owner.kyc] : tc(l.owner.phoneVerified ? 'phoneVerified' : 'phoneUnverified')}</span>) },
    { label: t('row.response'), values: v((l) => (l.responseHours ? t('unit.hours', { n: l.responseHours }) : none)) },
  );
  const cols = items.map((l) => ({ slug: l.slug, name: l.title, href: listingHref(l), sub: truck ? [l.truckType ? L.truckType[l.truckType as keyof typeof L.truckType] : null, l.tonnage ? t('unit.t', { n: l.tonnage }) : null].filter(Boolean).join(' · ') : [L.kind[l.kind], l.year].filter(Boolean).join(' · ') }));
  return <><Impressions kind="listing" ids={items.map((l) => l.id)} surface="compare" /><CompareTable cat={cat} cols={cols} rows={rows} missing={slugs.length - items.length} /></>;
}
