import { PLATFORM_DEFAULTS, SUBSCRIPTION_FALLBACK } from '@yuksaroy/domain';
import { sapi } from './server-api';

/** Sotuvdagi tarif. Nomi va tavsifi admin yozgan matn, shuning uchun tarjima faylidan emas. */
export type PlanCard = {
  code: string; name: Record<string, string>; features: Record<string, string[]>;
  priceMonthSom: number; grants: string[]; maxMonths: number; limits: { phoneRevealDaily?: number } | null;
};
/**
 * Obuna narxi va kunlik raqam soni tarifda (Plan jadvali) turadi, shuning uchun serverdan
 * olinadi. Bepul sonlar esa sozlamada: ular obunasiz odamga tegishli, tarifga emas.
 */
export type SubPrice = {
  pricePerMonthSom: number; phoneRevealDaily: number; wagonSearchFree: number;
  wagonPerMonthSom: number | null; plans: PlanCard[];
};

// Tarif yo'q yoki server javob bermadi: sahifa yiqilmasin, lekin bo'lmagan tarif ham chizilmasin
const FALLBACK: SubPrice = {
  pricePerMonthSom: SUBSCRIPTION_FALLBACK.priceMonthSom,
  phoneRevealDaily: SUBSCRIPTION_FALLBACK.phoneRevealDaily,
  wagonSearchFree: PLATFORM_DEFAULTS.wagonSearchFree,
  wagonPerMonthSom: null,
  plans: [],
};

/** Chaqiruv ishlamasa marketing sahifasi yiqilmasin: sukut narx ko'rsatiladi. */
export const subscriptionPrice = (): Promise<SubPrice> => sapi<SubPrice>('/subscription/price').catch(() => FALLBACK);
