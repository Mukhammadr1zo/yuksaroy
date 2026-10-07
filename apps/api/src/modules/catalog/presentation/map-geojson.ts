// Xarita GeoJSON: terminal, shahobcha guruhi va e'lon nuqtalari bitta shaklda. Sof, DB yo'q.
import { REGION_CENTERS, type RegionCode, type SearchCategory } from '@yuksaroy/domain';
import { corridorMatch, listingOwner, type ListingRecord } from '../../listings/domain/listing-query';
import type { TerminalRecord } from '../domain/ports';
import { fromPriceTiyin } from './mappers';

/** Xaritadagi belgi turi: kategoriyalar + 'siding' (stansiya bo'yicha to'plangan temir yo'l terminallari guruhi; terminal kategoriyasi ichida). */
export type MapKind = SearchCategory | 'siding';
/** [W, S, E, N] darajalarda. */
export type Bbox = [number, number, number, number];
export interface SidingGroup { id: string; name: string; lat: number; lng: number; count: number; regionCode: string | null }

export interface MapFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    id: string; kind: MapKind; accuracy: 'exact' | 'station' | 'region'; name: string; regionCode: string | null;
    slug?: string; terminalKind?: string; freeToday?: number; fromPriceTiyin?: number | null;
    count?: number;
    /** Namuna (terminal yoki e'lon): xarita uni "Namuna" deb belgilaydi va qaror satrida sanamaydi */
    isDemo?: boolean;
    listingKind?: string; deal?: string | null; priceTiyin?: number | null; priceUnit?: string | null; owner?: { type: string; name: string };
  };
}

/** `?bbox=69,41,70,42`; noto'g'ri qiymat = filtr yo'q. */
export function parseBbox(v?: string): Bbox | undefined {
  const p = (v ?? '').split(',').map(Number);
  return p.length === 4 && p.every(Number.isFinite) && p[0]! < p[2]! && p[1]! < p[3]! ? (p as Bbox) : undefined;
}

const point = (lng: number, lat: number, properties: MapFeature['properties']): MapFeature => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties });

export function terminalFeature(t: TerminalRecord, freeToday: number): MapFeature | null {
  if (t.lat == null || t.lng == null) return null;
  return point(t.lng, t.lat, { id: t.id, kind: 'terminal', accuracy: 'exact', name: t.name, slug: t.slug, terminalKind: t.kind, regionCode: t.regionCode, freeToday, fromPriceTiyin: fromPriceTiyin(t), isDemo: t.isDemo });
}

/** Shahobcha yo'lning o'z koordinatasi yo'q: stansiya nuqtasi, soni bilan. */
export const sidingFeature = (g: SidingGroup): MapFeature =>
  point(g.lng, g.lat, { id: g.id, kind: 'siding', accuracy: 'station', name: g.name, regionCode: g.regionCode, count: g.count });

/** E'lon: obyektga bog'langan bo'lsa aniq nuqta, aks holda viloyat markazi. */
export function listingFeature(l: ListingRecord): MapFeature | null {
  const linked = l.terminalId !== null && l.lat != null && l.lng != null;
  const c = linked ? { lat: l.lat!, lng: l.lng! } : REGION_CENTERS[l.regionCode as RegionCode];
  if (!c) return null;
  const owner = listingOwner(l);
  return point(c.lng, c.lat, {
    id: l.id, kind: l.kind === 'TRUCK' ? 'truck' : 'equipment', accuracy: linked ? 'exact' : 'region', name: l.title, slug: l.slug, regionCode: l.regionCode,
    listingKind: l.kind, deal: l.deal, priceTiyin: l.priceTiyin, priceUnit: l.priceUnit, owner: { type: owner.type, name: owner.name }, isDemo: l.isDemo,
  });
}

export const inBbox = (f: MapFeature, b: Bbox) => {
  const [x, y] = f.geometry.coordinates;
  return x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];
};

export interface MapSource { terminals: TerminalRecord[]; free: Record<string, number>; sidings: SidingGroup[]; listings: ListingRecord[] }
export interface MapFilter { cats: SearchCategory[]; bbox?: Bbox; corridor?: readonly string[] }

/** Koridor: terminal va shahobcha viloyat bo'yicha, e'lon yo'nalish/xizmat hududi bo'yicha (corridorMatch). */
export function mapFeatures(src: MapSource, f: MapFilter) {
  const inCorridor = (code: string | null) => !f.corridor || (code !== null && f.corridor.includes(code));
  const has = (k: SearchCategory) => f.cats.includes(k);
  const features: MapFeature[] = [];
  if (has('terminal')) for (const t of src.terminals) { const x = inCorridor(t.regionCode) && terminalFeature(t, src.free[t.id] ?? 0); if (x) features.push(x); }
  // Shahobcha guruhlari terminal kategoriyasida: alohida toifa emas, faqat boshqacha chiziladi (sanoq bilan)
  if (has('terminal')) for (const g of src.sidings) if (inCorridor(g.regionCode)) features.push(sidingFeature(g));
  for (const l of src.listings) {
    if (!has(l.kind === 'TRUCK' ? 'truck' : 'equipment') || (f.corridor && !corridorMatch(l, f.corridor))) continue;
    const x = listingFeature(l);
    if (x) features.push(x);
  }
  return { type: 'FeatureCollection' as const, features: f.bbox ? features.filter((x) => inBbox(x, f.bbox!)) : features };
}
