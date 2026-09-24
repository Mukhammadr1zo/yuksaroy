// /map holati: URL paramlari <-> filtrlar. Sof modul: server sahifa (boshlang'ich holat) ham, MapView ham ishlatadi.
// Qoida katalog sahifalaridagi kabi: q lug'at orqali filtrga aylanadi, aniq URL paramlari parse natijasidan ustun.
import { REGIONS, corridorRegions, parseQuery, type RegionCode, type SearchChip, type SearchLang } from '@yuksaroy/domain';

// Toifalar uchta: shahobcha guruhlari terminal ichida (belgi turi 'siding' MapView da faqat chizish uchun)
export const KINDS = ['terminal', 'equipment', 'truck'] as const;
export type Kind = (typeof KINDS)[number];
/** Chizilgan hudud: [lng, lat] uchlari (kamida 3), bo'sh = yo'q. */
export type Area = [number, number][];

export interface MapState {
  cat: Kind[]; // bo'sh = hammasi
  region: string; // csv
  corridor: string; // A>B
  near: [number, number] | null; // lng, lat
  radius: number; // km, 0 = berilmagan
  q: string;
  area?: Area; // ixtiyoriy: eski literal holatlar (MapHero NO_STATE) o'zgarmasin
  /** Faqat bugun bo'sh joyi borlar. Ixtiyoriy: NO_STATE literal holatlari o'zgarmasin. */
  free?: boolean;
  c: [number, number] | null; // kamera markazi lng, lat
  z: number | null;
}

/** Samarali filtrlar (q tahlili qo'shilgan holda). corridor = yo'l (viloyatlar ketma-ketligi), bo'sh = yo'q. */
export interface Effective {
  cat: Kind[];
  regions: RegionCode[];
  corridor: RegionCode[];
  corridorKey: string;
  near: [number, number] | null;
  radius: number;
  area: Area;
  /** Faqat bugun bo'sh joyi borlar (aniq param yoki q dagi "bugun bo'sh" so'zi). */
  free: boolean;
  chips: SearchChip[];
  unresolved: string[];
}

const isRegion = (s: string): s is RegionCode => (REGIONS as readonly string[]).includes(s);
const isKind = (s: string): s is Kind => (KINDS as readonly string[]).includes(s);
const pair = (s: string): [number, number] | null => {
  const [a, b] = s.split(',').map(Number);
  return Number.isFinite(a) && Number.isFinite(b) ? [a!, b!] : null;
};

// Hudud URL'da: "lng,lat;lng,lat;..." (4 xona) -> base64url. btoa/atob brauzerda ham, Node'da ham bor.
export function encodeArea(a: Area): string {
  const s = a.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).join(';');
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeArea(s: string): Area {
  if (!/^[A-Za-z0-9_-]{8,}$/.test(s)) return [];
  try {
    const pts = atob(s.replace(/-/g, '+').replace(/_/g, '/')).split(';').map(pair);
    return pts.every((p): p is [number, number] => p != null) && pts.length >= 3 ? pts : [];
  } catch { return []; }
}

/** Nuqta ko'pburchak ichidami (nur tashlash). Chegara nuqtalari tasodifiy tomonga tushadi, xarita uchun yetarli. */
export function inArea([x, y]: [number, number], a: Area): boolean {
  let inside = false;
  for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
    const [xi, yi] = a[i]!, [xj, yj] = a[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function parseState(get: (k: string) => string): MapState {
  const z = Number(get('z'));
  const corridor = get('corridor');
  return {
    cat: get('cat').split(',').filter(isKind),
    region: get('region').split(',').filter(isRegion).join(','),
    corridor: corridor.split('>').filter(isRegion).length === 2 ? corridor : '',
    near: pair(get('near')),
    radius: Number(get('radius')) || 0,
    q: get('q').trim(),
    area: decodeArea(get('area')),
    free: get('free') === '1',
    c: pair(get('c')),
    z: Number.isFinite(z) && z > 0 ? z : null,
  };
}

/** "?q=..&cat=..&c=lng,lat&z=.." (bo'sh bo'lsa ""). Vergul va > o'qiladigan ko'rinishda qoladi. */
export function toParams(s: MapState): string {
  const p = new URLSearchParams();
  if (s.q) p.set('q', s.q);
  if (s.cat.length && s.cat.length < KINDS.length) p.set('cat', KINDS.filter((k) => s.cat.includes(k)).join(','));
  if (s.region) p.set('region', s.region);
  if (s.corridor) p.set('corridor', s.corridor);
  if (s.near) {
    p.set('near', `${s.near[0].toFixed(5)},${s.near[1].toFixed(5)}`);
    if (s.radius) p.set('radius', String(s.radius));
  }
  if (s.area && s.area.length >= 3) p.set('area', encodeArea(s.area));
  if (s.free) p.set('free', '1');
  if (s.c) p.set('c', `${s.c[0].toFixed(4)},${s.c[1].toFixed(4)}`);
  if (s.z != null) p.set('z', s.z.toFixed(2));
  const str = p.toString().replace(/%2C/g, ',').replace(/%3E/g, '>');
  return str ? `?${str}` : '';
}

const chip = (type: SearchChip['type'], value: string): SearchChip => ({ type, key: `${type}:${value}`, value });
/** "Bugun bo'sh" chipi: yorliq domen lug'atida (chipLabel), shuning uchun tugmada ham, chiplar qatorida ham, katalogda ham bitta manba. */
export const FREE_CHIP: SearchChip = chip('bookable', '1');

export function effective(s: MapState, lang: SearchLang): Effective {
  const p = s.q ? parseQuery(s.q, { lang, near: s.near ? { lng: s.near[0], lat: s.near[1] } : undefined }) : null;
  // Koridor alohida param; aniq viloyat tanlangan bo'lsa koridor o'chadi (katalog naqshi)
  const [a, b] = (s.region ? '' : s.corridor || (p?.corridor ? `${p.corridor.from}>${p.corridor.to}` : '')).split('>').filter(isRegion);
  const corridorKey = a && b ? `${a}>${b}` : '';
  const corridor = a && b ? corridorRegions(a, b) : [];
  const regions = s.region ? s.region.split(',').filter(isRegion) : corridorKey ? [] : (p?.regions ?? []);
  const near = s.near ?? (p?.near ? ([p.near.lng, p.near.lat] as [number, number]) : null);
  const radius = near ? s.radius || p?.near?.radiusKm || 25 : 0;
  const cat = s.cat.length ? s.cat : p?.category ? [p.category] : [...KINDS];
  // Aniq param yoki q dagi so'z ("bugun bo'sh"): katalogdagi bookable=1 bilan bir xil ma'no
  const free = s.free === true || p?.bookable === true;
  const chips: SearchChip[] = [
    ...(corridorKey ? [chip('corridor', corridorKey)] : regions.map((r) => chip('region', r))),
    ...(near ? [chip('near', String(radius))] : []),
    ...(free ? [FREE_CHIP] : []),
  ];
  return { cat, regions, corridor, corridorKey, near, radius, area: s.area && s.area.length >= 3 ? s.area : [], free, chips, unresolved: p?.unresolved ?? [] };
}

/** Samarali filtrlar aniq paramga aylanadi, q tashlanadi (keyingi o'zgarishlar deterministik bo'lsin, katalog naqshi). */
export function materialize(s: MapState, e: Effective): MapState {
  return { ...s, q: '', cat: e.cat.length === KINDS.length ? [] : e.cat, region: e.regions.join(','), corridor: e.corridorKey, near: e.near, radius: e.radius, free: e.free };
}

export function withoutChip(s: MapState, e: Effective, c: SearchChip): MapState {
  const base = materialize(s, e);
  if (c.type === 'corridor') return { ...base, corridor: '' };
  if (c.type === 'region') return { ...base, region: e.regions.filter((r) => r !== c.value).join(',') };
  if (c.type === 'bookable') return { ...base, free: false };
  return { ...base, near: null, radius: 0 };
}
