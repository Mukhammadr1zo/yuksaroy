// Vagon qidiruvi javob shakllari (apps/api modules/wagon bilan bir xil).

export interface WagonEvent {
  date: string;
  station: string | null;
  state: 'loaded' | 'empty' | 'unknown';
}

export interface WagonQuota { subscriber: boolean; freeUsed: number; freeTotal: number }

export interface WagonMe extends WagonQuota { configured: boolean; remainingFree: number }

export interface WagonResult {
  wagonNo: string;
  found: boolean;
  current: WagonEvent | null;
  /** Yangisi birinchi, eng ko'pi 50 ta. */
  fetchedAt: string;
  quota: WagonQuota;
}
