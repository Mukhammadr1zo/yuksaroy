import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { REVIEW, distanceKm, type ServiceCode } from '@yuksaroy/domain';
import { sapiOrNull } from '@/lib/server-api';
import { hoursSummary, pricePer } from '@/lib/format';
import type { TerminalDetail } from '@/lib/types';
import { parseIds } from '@/lib/compare';
import { CompareTable, type CompareRow } from '@/components/compare/CompareTable';
import { Impressions } from '@/components/catalog/Impressions';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: 'compare.title' });
  return { title: `${t('terminals')} · YukSaroy`, robots: { index: false } };
}

/** Terminallarni solishtirish: tur, viloyat, stansiya, ish vaqti, tariflar (xizmatlar birlashmasi), bugungi slot, xizmatlar, masofa (near bo'lsa), reyting. */
export default async function TerminalsComparePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const slugs = parseIds(one(sp.ids));
  const [nLng, nLat] = one(sp.near).split(',').map(Number);
  const near = Number.isFinite(nLat) && Number.isFinite(nLng) ? { lat: nLat!, lng: nLng! } : null;
  const [t, tk, ts, tr, trv, found] = await Promise.all([
    getTranslations('compare'), getTranslations('kind'), getTranslations('service'), getTranslations('region'), getTranslations('reviews'),
    Promise.all(slugs.map((s) => sapiOrNull<TerminalDetail>(`/terminals/${encodeURIComponent(s)}`, 60).catch(() => null))),
  ]);
  const items = found.filter((x): x is TerminalDetail => !!x);
  const none = t('none');
  const v = (f: (x: TerminalDetail) => React.ReactNode) => items.map(f);
  // Tarif qatorlari: ustunlardagi xizmatlar birlashmasi, har biri uchun joriy umumiy tarif (yuk guruhisiz) yoki birinchi mos tarif
  const services = [...new Set(items.flatMap((x) => x.tariffs.map((y) => y.serviceCode)))] as ServiceCode[];
  const tariff = (x: TerminalDetail, s: ServiceCode) => x.tariffs.find((y) => y.serviceCode === s && !y.cargoGroupCode) ?? x.tariffs.find((y) => y.serviceCode === s);
  const rows: CompareRow[] = [
    { label: t('row.kind'), values: v((x) => <span className="font-body">{tk(x.kind)}</span>) },
    { label: t('row.region'), values: v((x) => <span className="font-body">{x.regionCode && tr.has(x.regionCode) ? tr(x.regionCode) : none}</span>) },
    { label: t('row.station'), values: v((x) => <span className="font-body">{x.station.nameUz}</span>) },
    { label: t('row.hours'), values: v((x) => hoursSummary(x.hours, x.is24h)) },
    ...(services.length ? [{ label: t('row.tariffs'), values: [], head: true } as CompareRow] : []),
    ...services.map((s) => ({ label: ts(s), values: v((x) => { const y = tariff(x, s); return y ? pricePer(y.priceTiyin, y.unit) : none; }) })),
    { label: t('row.freeToday'), values: v((x) => <span className={x.freeToday ? 'font-semibold text-teal-ink' : 'text-muted'}>{t('unit.slots', { n: x.freeToday ?? 0 })}</span>) },
    { label: t('row.services'), values: v((x) => <span className="font-body text-xs">{x.services.map((s) => ts(s)).join(', ') || none}</span>) },
    ...(near ? [{ label: t('row.distance'), values: v((x) => (x.lat != null && x.lng != null ? t('unit.km', { km: Math.round(distanceKm(near.lat, near.lng, x.lat, x.lng)) }) : none)) }] : []),
    { label: t('row.rating'), values: v((x) => (x.ratingAvg != null ? `★ ${x.ratingAvg.toFixed(1)} (${x.ratingCount})` : <span className="text-muted">{x.ratingCount ? trv('hidden', { count: x.ratingCount, min: REVIEW.minToShow }) : t('noRating')}</span>)) },
  ];
  const cols = items.map((x) => ({ slug: x.slug, name: x.name, href: `/terminals/${x.slug}`, sub: tk(x.kind) }));
  return <><Impressions kind="terminal" ids={items.map((x) => x.id)} surface="compare" /><CompareTable cat="terminals" cols={cols} rows={rows} missing={slugs.length - items.length} /></>;
}
