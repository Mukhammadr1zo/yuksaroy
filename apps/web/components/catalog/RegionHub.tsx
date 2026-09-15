import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { MapTrifoldIcon } from '@phosphor-icons/react/dist/ssr';
import { REGIONS, REGION_ADJACENCY, REGION_CENTERS, type RegionCode } from '@yuksaroy/domain';
import { sapiOrNull } from '@/lib/server-api';
import { MiniMap, type Pin, type Poly } from '@/components/catalog/MiniMap';
import { RegionChips } from '@/components/catalog/RegionChips';
import { AuthOnly } from '@/components/site/AuthOnly';
import { DashLink } from '@/components/site/DashLink';

export type HubCat = 'terminals' | 'equipment' | 'carriers';
const CATS: HubCat[] = ['terminals', 'equipment', 'carriers'];
/** /map sahifasidagi kategoriya kodi */
export const MAP_CAT: Record<HubCat, string> = { terminals: 'terminal', equipment: 'equipment', carriers: 'truck' };
export const isRegion = (s: string): s is RegionCode => (REGIONS as readonly string[]).includes(s);
export const HUB_PARAMS = () => REGIONS.map((code) => ({ code }));

type Feature = { properties: { code: string }; geometry: Poly };
/** Viloyat poligoni: /v1/regions.geojson bo'lsa; yo'q bo'lsa null (MiniMap markazga tushadi). Kun bo'yi kesh. */
export async function regionPolygon(code: RegionCode) {
  const fc = await sapiOrNull<{ features: Feature[] }>('/regions.geojson', 86400).catch(() => null);
  return fc?.features.find((f) => f.properties.code === code)?.geometry ?? null;
}

/** Bo'sh holatdagi harakat: terminal egasi kabinetga, e'lon beruvchi formaga, reestr o'ziga. */
const CTA: Record<HubCat, string> = { terminals: '/dashboard/terminals/new', equipment: '/dashboard/listings/new', carriers: '/dashboard/listings/new' };

/** Viloyat hubi: h1, lead, xarita, qo'shni viloyatlar, boshqa kategoriyalar, xaritada ochish, ro'yxat (children), pastda viloyat chiplari.
 *  count: jami, shown: ko'rsatilgani (50 dan ko'p bo'lsa filtrli katalogga havola). */
export async function RegionHub({ cat, code, count, shown, pins, children }: { cat: HubCat; code: RegionCode; count: number; shown: number; pins: Pin[]; children: React.ReactNode }) {
  const [t, tr, tg, polygon] = await Promise.all([getTranslations('hubs'), getTranslations('region'), getTranslations('marketing.common'), regionPolygon(code)]);
  const region = tr(code);
  const c = REGION_CENTERS[code];
  // Bo'sh viloyatda qo'shni viloyatlar bo'sh holat blokida, aks holda sarlavha ostida (bir marta)
  const neighbours = (
    <>
      <span className="font-mono text-xs text-muted">{count === 0 ? t('emptyNeighbours') : t('neighbours')}: </span>
      {REGION_ADJACENCY[code].map((n, i) => <span key={n}>{i ? ', ' : ''}<Link href={`/${cat}/region/${n}`} className="text-sm font-semibold text-teal-ink underline decoration-dotted hover:text-navy">{tr(n)}</Link></span>)}
    </>
  );
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <nav aria-label={t('regions')} className="font-mono text-xs text-muted"><Link href={`/${cat}`} className="hover:text-navy">{t(`cat.${cat}`)}</Link> / {region}</nav>
      <div className="mt-3 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy sm:text-3xl">{t(`${cat}.h1`, { region, count })}</h1>
          <p className="mt-2 max-w-[64ch] text-muted">{t(`${cat}.lead`)}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link href={`/map?region=${code}&cat=${MAP_CAT[cat]}`} className="inline-flex items-center gap-1.5 rounded-full border border-navy px-4 py-2 text-sm font-semibold text-navy transition hover:bg-white"><MapTrifoldIcon size={16} />{t('openMap')}</Link>
            {CATS.filter((x) => x !== cat).map((x) => <Link key={x} href={`/${x}/region/${code}`} className="rounded-full border border-line bg-white px-3 py-2 text-sm text-ink/80 transition hover:border-teal hover:text-teal-ink">{t(`cat.${x}`)}</Link>)}
          </div>
          {count > 0 ? <div className="mt-4">{neighbours}</div> : null}
        </div>
        <div>
          <MiniMap pins={pins.length ? pins : polygon ? [] : [{ lat: c.lat, lng: c.lng, color: '#077F84' }]} polygon={polygon} zoom={7} className="h-56 w-full lg:h-64" />
          <p className="mt-1 text-[11px] text-muted">{t('mapNote')}</p>
        </div>
      </div>
      <div className="mt-6">
        {count === 0 ? (
          <div className="rounded-card border border-dashed border-line bg-white p-10 text-center">
            <p className="mx-auto max-w-[52ch] text-muted">{t(`${cat}.empty`, { region })}</p>
            <p className="mt-3">{neighbours}</p>
            <DashLink href={CTA[cat]} className="mt-5 inline-block rounded-full bg-teal px-6 py-3 font-semibold text-white transition hover:bg-teal-ink active:scale-[0.98]" signupLabel={tg('guestCta')}>{t(`${cat}.cta`)}</DashLink>
          </div>
        ) : children}
        {count > shown ? <p className="mt-4"><Link href={`/${cat}?region=${code}`} className="text-sm font-semibold text-teal-ink underline decoration-dotted hover:text-navy">{t('more', { count })}</Link></p> : null}
      </div>
      <RegionChips base={`/${cat}`} current={code} />
    </div>
  );
}
