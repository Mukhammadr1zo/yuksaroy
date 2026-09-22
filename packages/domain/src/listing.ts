// E'lonlar: temir yo'l texnikasi (ijara/sotuv) va avtotashuvchilar. Framework'siz, Prisma enum'lari shu bilan bir xil.
import { MARKET, REGIONS, SERVICE_TYPES, normalizeUzPhone, uzLocalDate, type RegionCode, type SearchLang } from './index';
import { TransitionError } from './transition';
import { DEAL_KINDS, type DealKind } from './search';

export const LISTING_KINDS = ['SHUNTING_LOCO', 'WAGON', 'TRUCK'] as const;
export type ListingKind = (typeof LISTING_KINDS)[number];
export const LISTING_STATUSES = ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'ARCHIVED', 'EXPIRED'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];
export const CONDITIONS = ['NEW', 'GOOD', 'NEEDS_REPAIR'] as const;
export type Condition = (typeof CONDITIONS)[number];
export const WAGON_TYPES = ['COVERED', 'GONDOLA', 'PLATFORM', 'TANK', 'HOPPER', 'REFRIGERATOR'] as const;
export type WagonType = (typeof WAGON_TYPES)[number];
export const TRUCK_TYPES = ['TENT', 'REF', 'TIPPER', 'CONTAINER', 'FLATBED', 'TANK'] as const;
export type TruckType = (typeof TRUCK_TYPES)[number];
export const PRICE_UNITS = ['TOTAL', 'PER_MONTH', 'PER_DAY', 'PER_HOUR', 'PER_KM', 'PER_TON', 'PER_TRIP'] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number];

export const LISTING = { expireDays: 90, maxPhotos: 10, maxRoutes: 20 } as const;

/** Narx birligi qaysi bitimda mumkin. Avto (TRUCK) uchun deal yo'q. */
export const PRICE_UNITS_FOR: { RENT: readonly PriceUnit[]; SALE: readonly PriceUnit[]; TRUCK: readonly PriceUnit[] } = {
  RENT: ['PER_MONTH', 'PER_DAY', 'PER_HOUR'],
  SALE: ['TOTAL'],
  TRUCK: ['PER_KM', 'PER_TON', 'PER_TRIP'],
};

// ───────────────────────── Holat-mashinasi ─────────────────────────

export type ListingActor = 'OWNER' | 'ADMIN' | 'SYSTEM';

export const LISTING_TRANSITIONS: readonly { from: ListingStatus; to: ListingStatus; actors: readonly ListingActor[] }[] = [
  { from: 'DRAFT', to: 'PENDING_REVIEW', actors: ['OWNER'] },
  { from: 'PENDING_REVIEW', to: 'ACTIVE', actors: ['ADMIN', 'SYSTEM'] }, // SYSTEM: tashkilot KYC VERIFIED bo'lsa darhol
  { from: 'PENDING_REVIEW', to: 'REJECTED', actors: ['ADMIN'] },
  { from: 'REJECTED', to: 'PENDING_REVIEW', actors: ['OWNER'] },
  { from: 'ACTIVE', to: 'ARCHIVED', actors: ['OWNER', 'ADMIN'] },
  { from: 'ACTIVE', to: 'EXPIRED', actors: ['SYSTEM'] },
  { from: 'ARCHIVED', to: 'PENDING_REVIEW', actors: ['OWNER'] },
  { from: 'EXPIRED', to: 'PENDING_REVIEW', actors: ['OWNER'] },
];

export function assertListingTransition(from: ListingStatus, to: ListingStatus, actor: ListingActor): void {
  const rows = LISTING_TRANSITIONS.filter((t) => t.from === from && t.to === to);
  if (!rows.length) throw new TransitionError(from, to, actor, 'NOT_ALLOWED');
  if (!rows.some((t) => t.actors.includes(actor))) throw new TransitionError(from, to, actor, 'WRONG_ACTOR');
}

export function canListingTransition(from: ListingStatus, to: ListingStatus, actor: ListingActor): boolean {
  try { assertListingTransition(from, to, actor); return true; } catch { return false; }
}

// ───────────────────────── Kiritish va qoidalar ─────────────────────────

/** E'lon egasi: tashkilot yoki yakka shaxs (haydovchi). */
export type ListingOwnerType = 'org' | 'person';

export interface ListingInput {
  kind: ListingKind;
  /** Egasi turi; bo'sh bo'lsa 'org'. Temir yo'l turlari faqat tashkilotdan (ORG_REQUIRED). */
  ownerType?: ListingOwnerType;
  deal: DealKind | null;
  title: string;
  description: string | null;
  regionCode: RegionCode;
  /** Bog'langan obyekt: terminal. Shahobcha ham terminal (turi RAIL). */
  terminalId: string | null;
  priceTiyin: number | null;
  priceUnit: PriceUnit | null;
  photos: string[];
  year: number | null;
  condition: Condition | null;
  model: string | null;
  qty: number;
  wagonType: string | null;
  capacityT: number | null;
  truckType: string | null;
  tonnage: number | null;
  fleetSize: number | null;
  serviceRegions: RegionCode[];
  routes: { from: RegionCode; to: RegionCode }[];
  contactPhone: string | null;
  responseHours: number | null;
}

/**
 * Standart: must = e'lon berish uchun shart, should = tavsiya (ogohlantirish). terminalId = terminal yoki shahobcha (ikkisidan biri).
 * Egasi qoidasi: TRUCK ni tashkilot ham, yakka haydovchi (ownerType 'person') ham beradi;
 * SHUNTING_LOCO va WAGON faqat tashkilotdan, aks holda ownerType:ORG_REQUIRED.
 */
export const LISTING_RULES: Record<ListingKind, { must: (keyof ListingInput)[]; should: (keyof ListingInput)[] }> = {
  SHUNTING_LOCO: {
    must: ['title', 'deal', 'year', 'condition', 'regionCode', 'photos'],
    should: ['model', 'capacityT', 'priceTiyin', 'terminalId', 'responseHours'],
  },
  WAGON: {
    must: ['title', 'deal', 'wagonType', 'year', 'condition', 'regionCode', 'photos'],
    should: ['qty', 'capacityT', 'model', 'priceTiyin', 'terminalId'],
  },
  TRUCK: {
    must: ['title', 'truckType', 'tonnage', 'regionCode', 'serviceRegions'],
    should: ['routes', 'fleetSize', 'priceTiyin', 'photos', 'responseHours'],
  },
};

/** Maydon to'ldirilganmi (must/should uchun bitta qoida). Forma ham shu bilan belgilaydi. */
export function listingFieldPresent(input: ListingInput, field: keyof ListingInput): boolean {
  if (field === 'terminalId') return !!input.terminalId;
  const v = input[field];
  if (v == null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'number') return Number.isFinite(v);
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

export type ListingIssue = { field: string; code: string };

/** E'lon tekshiruvi: errors bo'lsa saqlanmaydi, warnings faqat ko'rsatiladi. */
export function validateListing(input: ListingInput): { errors: ListingIssue[]; warnings: ListingIssue[] } {
  const errors: ListingIssue[] = [];
  const warnings: ListingIssue[] = [];
  const err = (field: string, code: string) => errors.push({ field, code });
  const has = (f: keyof ListingInput) => listingFieldPresent(input, f);
  const isRegion = (r: unknown): r is RegionCode => (REGIONS as readonly string[]).includes(r as string);

  if (!LISTING_KINDS.includes(input.kind)) { err('kind', 'INVALID'); return { errors, warnings }; }
  const rules = LISTING_RULES[input.kind];
  const truck = input.kind === 'TRUCK';

  // Egasi: temir yo'l texnikasi faqat tashkilotdan
  if ((input.ownerType ?? 'org') === 'person' && !truck) err('ownerType', 'ORG_REQUIRED');

  for (const f of rules.must) if (!has(f)) err(f, 'REQUIRED');
  for (const f of rules.should) if (!has(f)) warnings.push({ field: f, code: 'MISSING_SHOULD' });

  if (has('regionCode') && !isRegion(input.regionCode)) err('regionCode', 'INVALID');

  // Bitim: avto uchun yo'q, temir yo'l uchun RENT | SALE
  if (input.deal != null) {
    if (truck) err('deal', 'DEAL_NOT_ALLOWED');
    else if (!DEAL_KINDS.includes(input.deal)) err('deal', 'INVALID');
  }

  // Lug'atlar
  if (input.condition != null && !CONDITIONS.includes(input.condition)) err('condition', 'INVALID');
  if (input.wagonType != null && !(WAGON_TYPES as readonly string[]).includes(input.wagonType)) err('wagonType', 'INVALID');
  if (input.truckType != null && !(TRUCK_TYPES as readonly string[]).includes(input.truckType)) err('truckType', 'INVALID');
  if (input.priceUnit != null && !PRICE_UNITS.includes(input.priceUnit)) err('priceUnit', 'INVALID');

  // Sonlar
  const int = (v: number | null) => v == null || Number.isInteger(v);
  const year = new Date().getFullYear();
  if (input.year != null && (!int(input.year) || input.year < 1950 || input.year > year)) err('year', 'RANGE');
  if (!int(input.qty) || input.qty < 1) err('qty', 'RANGE');
  if (input.tonnage != null && (!int(input.tonnage) || input.tonnage < 1 || input.tonnage > 100)) err('tonnage', 'RANGE');
  if (input.capacityT != null && (!int(input.capacityT) || input.capacityT < 1)) err('capacityT', 'RANGE');
  if (input.fleetSize != null && (!int(input.fleetSize) || input.fleetSize < 1)) err('fleetSize', 'RANGE');
  if (input.responseHours != null && (!int(input.responseHours) || input.responseHours < 1)) err('responseHours', 'RANGE');
  if (input.priceTiyin != null && (!int(input.priceTiyin) || input.priceTiyin < 1)) err('priceTiyin', 'RANGE');

  // Narx birligi: narx bo'lsa birlik shart; birlik bitimga mos bo'lsin
  if (input.priceTiyin != null && input.priceUnit == null) err('priceUnit', 'PRICE_UNIT_REQUIRED');
  if (input.priceUnit != null && PRICE_UNITS.includes(input.priceUnit)) {
    const allowed = truck ? PRICE_UNITS_FOR.TRUCK : input.deal && DEAL_KINDS.includes(input.deal) ? PRICE_UNITS_FOR[input.deal] : null;
    if (allowed && !allowed.includes(input.priceUnit)) err('priceUnit', 'UNIT_NOT_FOR_DEAL');
  }

  // Xizmat hududlari va yo'nalishlar (avto)
  if (input.serviceRegions.some((r) => !isRegion(r))) err('serviceRegions', 'INVALID');
  else if (truck && has('serviceRegions') && has('regionCode') && !input.serviceRegions.includes(input.regionCode)) {
    err('serviceRegions', 'SERVICE_REGIONS_MUST_INCLUDE_BASE');
  }
  if (input.routes.length > LISTING.maxRoutes) err('routes', 'TOO_MANY');
  if (input.routes.some((r) => !isRegion(r.from) || !isRegion(r.to))) err('routes', 'INVALID');
  else if (input.routes.some((r) => r.from === r.to)) err('routes', 'ROUTE_SAME_REGION');

  if (input.photos.length > LISTING.maxPhotos) err('photos', 'TOO_MANY');
  if (input.contactPhone && !normalizeUzPhone(input.contactPhone)) err('contactPhone', 'INVALID');

  return { errors, warnings };
}

// ───────────────────────── Yorliqlar ─────────────────────────

export const LISTING_OWNER_LABELS: Record<SearchLang, Record<ListingOwnerType, string>> = {
  uz: { person: 'Yakka haydovchi', org: 'Tashkilot' },
  ru: { person: 'Частный перевозчик', org: 'Организация' },
  en: { person: 'Independent driver', org: 'Organization' },
};

export const LISTING_LABELS: Record<SearchLang, {
  kind: Record<ListingKind, string>; status: Record<ListingStatus, string>; condition: Record<Condition, string>;
  wagonType: Record<WagonType, string>; truckType: Record<TruckType, string>; priceUnit: Record<PriceUnit, string>;
}> = {
  uz: {
    kind: { SHUNTING_LOCO: 'Manevr teplovozi', WAGON: 'Vagon', TRUCK: 'Yuk mashinasi' },
    status: { DRAFT: 'Qoralama', PENDING_REVIEW: 'Tekshiruvda', ACTIVE: 'Faol', REJECTED: 'Rad etilgan', ARCHIVED: 'Arxiv', EXPIRED: "Muddati o'tgan" },
    condition: { NEW: 'Yangi', GOOD: 'Yaxshi', NEEDS_REPAIR: "Ta'mir talab" },
    wagonType: { COVERED: 'Yopiq vagon', GONDOLA: 'Yarim vagon', PLATFORM: 'Platforma', TANK: 'Sisterna', HOPPER: 'Xopper', REFRIGERATOR: 'Refrijerator' },
    truckType: { TENT: 'Tentli', REF: 'Refrijerator', TIPPER: "Ag'daruvchi", CONTAINER: 'Konteyner tashuvchi', FLATBED: 'Ochiq platforma', TANK: 'Sisterna' },
    priceUnit: { TOTAL: 'jami', PER_MONTH: 'oyiga', PER_DAY: 'kuniga', PER_HOUR: 'soatiga', PER_KM: 'km uchun', PER_TON: 'tonna uchun', PER_TRIP: 'reys uchun' },
  },
  ru: {
    kind: { SHUNTING_LOCO: 'Маневровый тепловоз', WAGON: 'Вагон', TRUCK: 'Грузовик' },
    status: { DRAFT: 'Черновик', PENDING_REVIEW: 'На проверке', ACTIVE: 'Активно', REJECTED: 'Отклонено', ARCHIVED: 'Архив', EXPIRED: 'Истекло' },
    condition: { NEW: 'Новый', GOOD: 'Хорошее', NEEDS_REPAIR: 'Требует ремонта' },
    wagonType: { COVERED: 'Крытый вагон', GONDOLA: 'Полувагон', PLATFORM: 'Платформа', TANK: 'Цистерна', HOPPER: 'Хоппер', REFRIGERATOR: 'Рефрижератор' },
    truckType: { TENT: 'Тентованный', REF: 'Рефрижератор', TIPPER: 'Самосвал', CONTAINER: 'Контейнеровоз', FLATBED: 'Открытая платформа', TANK: 'Цистерна' },
    priceUnit: { TOTAL: 'всего', PER_MONTH: 'в месяц', PER_DAY: 'в сутки', PER_HOUR: 'в час', PER_KM: 'за км', PER_TON: 'за тонну', PER_TRIP: 'за рейс' },
  },
  en: {
    kind: { SHUNTING_LOCO: 'Shunting locomotive', WAGON: 'Wagon', TRUCK: 'Truck' },
    status: { DRAFT: 'Draft', PENDING_REVIEW: 'Under review', ACTIVE: 'Active', REJECTED: 'Rejected', ARCHIVED: 'Archived', EXPIRED: 'Expired' },
    condition: { NEW: 'New', GOOD: 'Good', NEEDS_REPAIR: 'Needs repair' },
    wagonType: { COVERED: 'Covered wagon', GONDOLA: 'Gondola', PLATFORM: 'Flat wagon', TANK: 'Tank wagon', HOPPER: 'Hopper', REFRIGERATOR: 'Refrigerator wagon' },
    truckType: { TENT: 'Curtainsider', REF: 'Reefer', TIPPER: 'Tipper', CONTAINER: 'Container carrier', FLATBED: 'Flatbed', TANK: 'Tanker' },
    priceUnit: { TOTAL: 'total', PER_MONTH: 'per month', PER_DAY: 'per day', PER_HOUR: 'per hour', PER_KM: 'per km', PER_TON: 'per ton', PER_TRIP: 'per trip' },
  },
};

// ── Bozor so'rovi: maydon tekshiruvi ──
//
// Bu tekshiruv ilgari faqat serverda turardi, shuning uchun so'rov formasi mehmonni
// avval kirishga yuborardi: mijozda tekshiradigan narsa yo'q edi. Endi bitta funksiya
// ikki tomonda ham ishlaydi, ya'ni mehmon formani to'ldiradi va faqat yuborish oldidan
// raqamini tasdiqlaydi. Domen paketida turgani uchun ikki nusxa bo'lib ajralib ketmaydi.

export type RequestInput = {
  board: string;
  title?: string | null; description?: string | null;
  serviceType?: string | null; regionCode?: string | null;
  fromRegion?: string | null; toRegion?: string | null; fromText?: string | null; toText?: string | null;
  cargoName?: string | null; weightT?: number | null; loadDate?: string | null; truckType?: string | null;
  contactPhone?: string | null;
};
export type FieldError = 'REQUIRED' | 'INVALID' | 'RANGE' | 'PAST' | 'TOO_LONG';

// Nomlari `has`/`blank` emas: validateListing ichida boshqa ma'nodagi `has` bor, soyalanmasin
const inList = (list: readonly string[], v: string | null | undefined) => !!v && list.includes(v);
const isBlank = (v: string | null | undefined) => !v || !v.trim();

/**
 * So'rov maydonlari taxtaga qarab tekshiriladi. Natija: maydon -> xato kodi; bo'sh obyekt = to'g'ri.
 * Sana Toshkent kuni bilan solishtiriladi: kechqurun yuborilgan "bugun" ertaga aylanib ketmasin.
 */
export function validateRequest(i: RequestInput, today = uzLocalDate(new Date())): Record<string, FieldError> {
  const e: Record<string, FieldError> = {};
  if (isBlank(i.title)) e.title = 'REQUIRED';
  else if (i.title!.trim().length > MARKET.titleMax) e.title = 'TOO_LONG';
  if (isBlank(i.description)) e.description = 'REQUIRED';
  else if (i.description!.trim().length > MARKET.descriptionMax) e.description = 'TOO_LONG';
  if (i.fromText && i.fromText.length > 200) e.fromText = 'TOO_LONG';
  if (i.toText && i.toText.length > 200) e.toText = 'TOO_LONG';
  // Telefon SERVICE shoxidan oldin: u shox erta qaytadi va raqam ikkala taxtada ham bor
  if (i.contactPhone?.trim() && !normalizeUzPhone(i.contactPhone)) e.contactPhone = 'INVALID';

  if (i.board === 'SERVICE') {
    if (!inList(SERVICE_TYPES, i.serviceType)) e.serviceType = i.serviceType ? 'INVALID' : 'REQUIRED';
    if (!inList(REGIONS, i.regionCode)) e.regionCode = i.regionCode ? 'INVALID' : 'REQUIRED';
    return e;
  }
  if (i.board !== 'CARGO') { e.board = 'INVALID'; return e; }
  if (!inList(REGIONS, i.fromRegion)) e.fromRegion = i.fromRegion ? 'INVALID' : 'REQUIRED';
  if (!inList(REGIONS, i.toRegion)) e.toRegion = i.toRegion ? 'INVALID' : 'REQUIRED';
  if (isBlank(i.cargoName)) e.cargoName = 'REQUIRED';
  else if (i.cargoName!.length > 120) e.cargoName = 'TOO_LONG';
  if (i.weightT == null || !Number.isFinite(i.weightT)) e.weightT = 'REQUIRED';
  else if (i.weightT <= 0 || i.weightT > 10_000) e.weightT = 'RANGE';
  // Sana orqaga aylantirib solishtiriladi: "2026-02-31" ni Date 3-martga surib qo'yadi, bunday kun rad etiladi
  const d = i.loadDate ? new Date(`${i.loadDate}T00:00:00Z`) : null;
  if (!i.loadDate || !d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== i.loadDate) e.loadDate = i.loadDate ? 'INVALID' : 'REQUIRED';
  else if (i.loadDate < today) e.loadDate = 'PAST';
  if (i.truckType && !inList(TRUCK_TYPES, i.truckType)) e.truckType = 'INVALID';
  return e;
}
