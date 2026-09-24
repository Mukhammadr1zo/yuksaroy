// Vagon qidiruvi javob shakllari (apps/api modules/wagon bilan bir xil).

export interface WagonEvent {
  date: string;
  station: string | null;
  state: 'loaded' | 'empty' | 'unknown';
}

export interface WagonQuota { subscriber: boolean; freeUsed: number; freeTotal: number }

/** Oxirgi qidirganlarim: takrorsiz, yangisidan eskisiga, eng ko'pi 10 ta. */
export interface WagonRecent { wagonNo: string; found: boolean }
export interface WagonMe extends WagonQuota { configured: boolean; remainingFree: number; recent: WagonRecent[] }

/** Partiyadagi bitta qator: kutmoqda, qidirilmoqda, natija, o'tkazib yuborilgan yoki noto'g'ri raqam. */
export type WagonRow = { no: string } & (
  | { s: 'wait' | 'busy' | 'skipped' | 'invalid' }
  | { s: 'done'; r: WagonResult }
);

export interface WagonResult {
  wagonNo: string;
  found: boolean;
  current: WagonEvent | null;
  /** Yangisi birinchi, eng ko'pi 50 ta. */
  fetchedAt: string;
  quota: WagonQuota;
}
