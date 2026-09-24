import { Link } from '@/i18n/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { LISTING_LABELS, LISTING_OWNER_LABELS, SEARCH_LABELS, formatSom, type ListingKind, type PriceUnit, type RegionCode, type SearchLang } from '@yuksaroy/domain';
import { EyeIcon, PhoneIcon, SealCheckIcon, TrainIcon, TrainRegionalIcon, TruckIcon } from '@phosphor-icons/react/dist/ssr';
import { num } from '@/lib/format';
import type { ListingCard as L } from '@/lib/types-listing';
import { CompareCheck } from '@/components/compare/CompareCheck';
import { PremiumBadge } from './PremiumBadge';

/** Kartadagi va tafsilotdagi umumiy yordamchilar: havola, narx, viloyat nomi, tur ikonkasi. */
export const listingHref = (l: Pick<L, 'kind' | 'slug'>) => `${l.kind === 'TRUCK' ? '/carriers' : '/equipment'}/${l.slug}`;
export const regionName = (code: string | null, lang: SearchLang) => (code ? SEARCH_LABELS[lang].region[code as RegionCode] ?? code : '');
/** "18 500 000 so'm oyiga"; SALE (TOTAL) da birlik yozilmaydi. */
export const listingPrice = (tiyin: number, unit: PriceUnit | null, lang: SearchLang) =>
  unit && unit !== 'TOTAL' ? `${formatSom(tiyin)} ${LISTING_LABELS[lang].priceUnit[unit]}` : formatSom(tiyin);
export const KIND_ICON: Record<ListingKind, typeof TrainIcon> = { SHUNTING_LOCO: TrainIcon, WAGON: TrainIcon, TRUCK: TruckIcon };

/** Shuncha kundan eski e'lon qaror uchun boshqacha: u ko'proq ehtimol bilan band. */
const STALE_DAYS = 30;

/** "Namuna" yorlig'i: namuna qator haqiqiy taklif emasligi har joyda ko'rinsin (e'lon, kompaniya, do'kon). */
export async function DemoBadge({ className = '' }: { className?: string }) {
  const t = await getTranslations('listing.card');
  return <span className={`inline-flex shrink-0 items-center rounded-full border border-dashed border-line bg-sand px-2 py-0.5 text-[11px] font-semibold text-muted ${className}`}>{t('demo')}</span>;
}

/** E'lon kartasi: rasm yoki tur ikonkasi, sarlavha, tur + yil + holat, viloyat, narx, egasi (tashkilot KYC yoki haydovchi telefoni), obyekt qatori. */
export async function ListingCard({ l }: { l: L }) {
  const [lang, t] = await Promise.all([getLocale() as Promise<SearchLang>, getTranslations('listing.card')]);
  const L = LISTING_LABELS[lang];
  const Icon = KIND_ICON[l.kind];
  const truck = l.kind === 'TRUCK';
  // Ro'yxat yangilik bo'yicha saralangan, ya'ni har kartada sana bezak bo'lardi.
  // Qaror beradigan holat faqat aksi: uzoq turgan e'lon ko'proq ehtimol bilan band.
  // publishedAt har qayta yuborishda yangilanadi, ya'ni son nolga qaytadi.
  const days = l.publishedAt ? Math.floor((Date.now() - new Date(l.publishedAt).getTime()) / 86_400_000) : null;
  const sub = truck
    ? [l.truckType ? L.truckType[l.truckType as keyof typeof L.truckType] ?? l.truckType : null, l.tonnage ? `${l.tonnage} t` : null, l.fleetSize ? t('fleet', { count: l.fleetSize }) : null]
    : [L.kind[l.kind], l.wagonType ? L.wagonType[l.wagonType as keyof typeof L.wagonType] ?? l.wagonType : null, l.year, l.condition ? L.condition[l.condition] : null, l.qty > 1 ? t('qty', { count: l.qty }) : null];
  const regions = truck ? l.serviceRegions.slice(0, 3) : [];
  // Solishtirish belgisi Link tashqarisida (a ichida input bo'lmasin): karta pastida joy, belgi o'ng burchakda
  return (
    <div className="relative min-w-0">
    <Link href={listingHref(l)} className="group flex h-full min-w-0 gap-4 rounded-card border border-line bg-white p-4 pb-10 text-ink transition hover:border-teal">
      <div className="relative h-[84px] w-[112px] shrink-0 overflow-hidden rounded-xl bg-sand">
        {l.photo ? <img src={l.photo} alt="" className="h-full w-full object-cover" /> : (
          <div className="flex h-full w-full items-center justify-center text-navy/40" aria-label={t('noPhoto')}><Icon size={36} weight="duotone" /></div>
        )}
        {l.deal ? <span className={`absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${l.deal === 'RENT' ? 'bg-teal text-white' : 'bg-navy text-white'}`}>{SEARCH_LABELS[lang].deal[l.deal]}</span> : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 truncate font-bold group-hover:text-teal-ink">{l.title}</h3>
          {l.isDemo ? <DemoBadge /> : l.premium ? <PremiumBadge className="shrink-0" /> : null}
        </div>
        <p className="mt-0.5 text-xs text-muted">{sub.filter((x) => x != null && x !== '').join(' · ')}</p>
        <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted">
          <span className="truncate">{regionName(l.regionCode, lang)}{l.model ? ` · ${l.model}` : ''}{l.distanceKm != null ? ` · ${Math.round(l.distanceKm)} km` : ''}</span>
          {/* Ko'rishlar alohida: matn ichida yo'qolib ketmasin */}
          {l.views > 0 ? (
            <span aria-label={t('viewsShort', { count: l.views })} className="inline-flex shrink-0 items-center gap-1 font-mono font-semibold text-ink/70 tabular-nums">
              <EyeIcon size={13} weight="duotone" className="text-teal-ink" aria-hidden="true" />{num(l.views, lang)}
            </span>
          ) : null}
          {days != null && days >= STALE_DAYS ? <span className="shrink-0 text-[11px] text-muted">{t('posted', { days })}</span> : null}
        </p>
        {truck ? (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {regions.map((r) => <span key={r} className="rounded-full bg-teal-soft px-2 py-0.5 text-[11px] font-semibold text-teal-ink">{regionName(r, lang)}</span>)}
            {l.serviceRegions.length > 3 ? <span className="px-1 text-[11px] text-muted">{t('regionsMore', { count: l.serviceRegions.length - 3 })}</span> : null}
            {l.routes.length ? <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-ink/80">{t('routes', { count: l.routes.length })}</span> : null}
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span className="flex min-w-0 max-w-full items-center gap-1 text-xs text-muted">
            {l.owner.type === 'org'
              ? (l.owner.kyc === 'VERIFIED' ? <SealCheckIcon size={13} weight="fill" className="shrink-0 text-teal" aria-label={t('verified')} /> : null)
              : <PhoneIcon size={13} weight={l.owner.phoneVerified ? 'fill' : 'regular'} className={`shrink-0 ${l.owner.phoneVerified ? 'text-teal' : 'text-muted'}`} aria-label={t(l.owner.phoneVerified ? 'phoneVerified' : 'phoneUnverified')} />}
            <span className="truncate">{l.owner.name}</span>
            {l.owner.type === 'person' ? <span className="shrink-0 text-[11px]">· {LISTING_OWNER_LABELS[lang].person}</span> : null}
          </span>
          <span className="font-mono text-sm font-semibold text-navy tabular-nums">{l.priceTiyin != null ? listingPrice(l.priceTiyin, l.priceUnit, lang) : t('onRequest')}</span>
        </div>
        {l.object ? <p className="mt-1 truncate text-[11px] text-teal-ink">{t('atTerminal', { name: l.object.name })}</p> : null}
      </div>
    </Link>
    <CompareCheck cat={truck ? 'carriers' : 'equipment'} slug={l.slug} name={l.title} className="absolute bottom-3 right-3" />
    </div>
  );
}
