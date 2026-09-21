import { PLATFORM_DEFAULTS } from '@yuksaroy/domain';
import { sapi } from './server-api';

/** Obuna narxi va chegaralari admin sozlamasida turadi, shuning uchun serverdan olinadi. */
export type SubPrice = { pricePerMonthSom: number; phoneRevealDaily: number; wagonSearchFree: number };

const FALLBACK: SubPrice = {
  pricePerMonthSom: PLATFORM_DEFAULTS.subscriptionMonthSom,
  phoneRevealDaily: PLATFORM_DEFAULTS.phoneRevealDaily,
  wagonSearchFree: PLATFORM_DEFAULTS.wagonSearchFree,
};

/** Chaqiruv ishlamasa marketing sahifasi yiqilmasin: sukut narx ko'rsatiladi. */
export const subscriptionPrice = (): Promise<SubPrice> => sapi<SubPrice>('/subscription/price').catch(() => FALLBACK);
