import { MARKET, uzLocalDate, type MarketBoard, type MarketStatus } from '@yuksaroy/domain';

// Taklif tanlash va hudud+qo'shnilar shoshilinch so'rovlar bilan bir xil: qayta yozilmaydi
export { awardOffers, notifyRegions } from '../urgent/urgent.rules';

/** Holat o'tishlari: egasi OPEN dan taklif tanlaydi, yopadi yoki bekor qiladi.
 *  AWARDED dan ikki chiqish: ish bajarilgan bo'lsa DONE, bo'lmasa CLOSED. */
export const MARKET_TRANSITIONS: Record<MarketStatus, readonly MarketStatus[]> = {
  OPEN: ['AWARDED', 'CLOSED', 'CANCELLED'],
  AWARDED: ['DONE', 'CLOSED'],
  // DONE yakuniy: bajarilgan ish soni shundan sanaladi, ortga qaytarilsa sanoq o'ynab ketardi
  DONE: [],
  CLOSED: [],
  CANCELLED: [],
};

export const canMarketTransition = (from: string, to: MarketStatus): boolean =>
  (MARKET_TRANSITIONS[from as MarketStatus] ?? []).includes(to);

/** "CR-1001" (yuk) yoki "SR-1001" (xizmat): market_no_seq dan bitta raqam. */
export const formatMarketNo = (board: MarketBoard, seq: number): string => `${board === 'CARGO' ? 'CR' : 'SR'}-${seq}`;

/** Ro'yxatda ko'rinish chegarasi: shu sanadan eski OPEN so'rov tushib qoladi. */
export const staleBefore = (now = new Date()): Date => new Date(now.getTime() - MARKET.staleDays * 86_400_000);

/**
 * So'rov hozir ochiq doskada ko'rinadimi: market.controller dagi visible() shartining bitta qator
 * uchun shakli (ochiq, eskirmagan, yuklash sanasi Toshkent kuni bilan o'tmagan). Kabinet "so'rovingiz
 * doskada turadi" ni faqat shunda aytadi: bekor qilingan yoki sanasi o'tgan so'rovda bu yolg'on.
 */
export const isListed = (r: { status: string; createdAt: Date; loadDate: Date | null }, now = new Date()): boolean =>
  r.status === 'OPEN' && r.createdAt >= staleBefore(now) && (!r.loadDate || r.loadDate >= new Date(`${uzLocalDate(now)}T00:00:00Z`));

// Maydon tekshiruvi domen paketida: bir xil qoida mijozda ham, serverda ham ishlaydi
export { cargoTitle, validateRequest, type FieldError, type RequestInput } from '@yuksaroy/domain';

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
