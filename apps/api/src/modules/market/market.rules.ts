import { MARKET, REGIONS, SERVICE_TYPES, TRUCK_TYPES, uzLocalDate, type MarketBoard, type MarketStatus } from '@yuksaroy/domain';

// Taklif tanlash va hudud+qo'shnilar shoshilinch so'rovlar bilan bir xil: qayta yozilmaydi
export { awardOffers, notifyRegions } from '../urgent/urgent.rules';

/** Holat o'tishlari: egasi OPEN dan taklif tanlaydi, yopadi yoki bekor qiladi; AWARDED faqat yopiladi. */
export const MARKET_TRANSITIONS: Record<MarketStatus, readonly MarketStatus[]> = {
  OPEN: ['AWARDED', 'CLOSED', 'CANCELLED'],
  AWARDED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
};

export const canMarketTransition = (from: string, to: MarketStatus): boolean =>
  (MARKET_TRANSITIONS[from as MarketStatus] ?? []).includes(to);

/** "CR-1001" (yuk) yoki "SR-1001" (xizmat): market_no_seq dan bitta raqam. */
export const formatMarketNo = (board: MarketBoard, seq: number): string => `${board === 'CARGO' ? 'CR' : 'SR'}-${seq}`;

/** Ro'yxatda ko'rinish chegarasi: shu sanadan eski OPEN so'rov tushib qoladi. */
export const staleBefore = (now = new Date()): Date => new Date(now.getTime() - MARKET.staleDays * 86_400_000);

export type RequestInput = {
  board: string;
  title?: string | null; description?: string | null;
  serviceType?: string | null; regionCode?: string | null;
  fromRegion?: string | null; toRegion?: string | null; fromText?: string | null; toText?: string | null;
  cargoName?: string | null; weightT?: number | null; loadDate?: string | null; truckType?: string | null;
};
export type FieldError = 'REQUIRED' | 'INVALID' | 'RANGE' | 'PAST' | 'TOO_LONG';

const has = (list: readonly string[], v: string | null | undefined) => !!v && list.includes(v);
const blank = (v: string | null | undefined) => !v || !v.trim();

/**
 * So'rov maydonlari taxtaga qarab tekshiriladi. Natija: maydon -> xato kodi; bo'sh obyekt = to'g'ri.
 * Sana Toshkent kuni bilan solishtiriladi: kechqurun yuborilgan "bugun" ertaga aylanib ketmasin.
 */
export function validateRequest(i: RequestInput, today = uzLocalDate(new Date())): Record<string, FieldError> {
  const e: Record<string, FieldError> = {};
  if (blank(i.title)) e.title = 'REQUIRED';
  else if (i.title!.trim().length > MARKET.titleMax) e.title = 'TOO_LONG';
  if (blank(i.description)) e.description = 'REQUIRED';
  else if (i.description!.trim().length > MARKET.descriptionMax) e.description = 'TOO_LONG';
  if (i.fromText && i.fromText.length > 200) e.fromText = 'TOO_LONG';
  if (i.toText && i.toText.length > 200) e.toText = 'TOO_LONG';

  if (i.board === 'SERVICE') {
    if (!has(SERVICE_TYPES, i.serviceType)) e.serviceType = i.serviceType ? 'INVALID' : 'REQUIRED';
    if (!has(REGIONS, i.regionCode)) e.regionCode = i.regionCode ? 'INVALID' : 'REQUIRED';
    return e;
  }
  if (i.board !== 'CARGO') { e.board = 'INVALID'; return e; }
  if (!has(REGIONS, i.fromRegion)) e.fromRegion = i.fromRegion ? 'INVALID' : 'REQUIRED';
  if (!has(REGIONS, i.toRegion)) e.toRegion = i.toRegion ? 'INVALID' : 'REQUIRED';
  if (blank(i.cargoName)) e.cargoName = 'REQUIRED';
  else if (i.cargoName!.length > 120) e.cargoName = 'TOO_LONG';
  if (i.weightT == null || !Number.isFinite(i.weightT)) e.weightT = 'REQUIRED';
  else if (i.weightT <= 0 || i.weightT > 10_000) e.weightT = 'RANGE';
  if (!i.loadDate || !/^\d{4}-\d{2}-\d{2}$/.test(i.loadDate) || Number.isNaN(Date.parse(i.loadDate))) e.loadDate = i.loadDate ? 'INVALID' : 'REQUIRED';
  else if (i.loadDate < today) e.loadDate = 'PAST';
  if (i.truckType && !has(TRUCK_TYPES, i.truckType)) e.truckType = 'INVALID';
  return e;
}

/**
 * Kim taklif bera oladi. O'z so'roviga yo'q; yopiq so'rovga yo'q; xizmat so'roviga faqat
 * o'sha turdagi faol profili bor odam. Yuk e'loniga kirgan har kim (haydovchi tashkilotsiz ham bo'ladi).
 */
export function offerDenial(
  r: { status: string; createdById: string; board: string; serviceType: string | null; isDemo?: boolean },
  userId: string,
  activeServiceTypes: readonly string[],
): 'NOT_OPEN' | 'OWN_REQUEST' | 'NOT_PROVIDER' | 'DEMO_TARGET' | null {
  // Namuna so'rov haqiqiy emas: taklif hech kimga bormaydi
  if (r.isDemo) return 'DEMO_TARGET';
  if (r.status !== 'OPEN') return 'NOT_OPEN';
  if (r.createdById === userId) return 'OWN_REQUEST';
  if (r.board === 'SERVICE' && !(r.serviceType && activeServiceTypes.includes(r.serviceType))) return 'NOT_PROVIDER';
  return null;
}
