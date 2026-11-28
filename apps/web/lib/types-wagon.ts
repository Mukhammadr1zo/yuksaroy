// Vagon qidiruvi javob shakllari (apps/api modules/wagon bilan bir xil).

export interface WagonEvent {
  date: string;
  station: string | null;
  state: 'loaded' | 'empty' | 'unknown';
}

/** dailyUsed/dailyLimit: obunachining bugungi (Toshkent kuni) yangi qidiruvlari va chegarasi. */
export interface WagonQuota { subscriber: boolean; freeUsed: number; freeTotal: number; dailyUsed: number; dailyLimit: number }

/** Oxirgi qidirganlarim: takrorsiz, yangisidan eskisiga, eng ko'pi 10 ta. */
export interface WagonRecent { wagonNo: string; found: boolean }
export interface WagonMe extends WagonQuota { configured: boolean; remainingFree: number; recent: WagonRecent[] }

/** Partiyadagi bitta qator: kutmoqda, qidirilmoqda, natija, o'tkazib yuborilgan yoki noto'g'ri raqam. */
export type WagonRow = { no: string } & (
  | { s: 'wait' | 'busy' | 'skipped' | 'invalid' }
  | { s: 'done'; r: WagonResult }
);

/** Yuklangan vagonning yo'li (faqat obunachiga): qayerda va qachon yuklandi, qayerga, nima ortilgan. */
export interface WagonTrip { from: string | null; loadDate: string | null; dest: string | null; cargo: string | null; weightT: number | null }
/** Vaqt chizig'idagi qadam, yangisi birinchi. */
export interface WagonStep { date: string; station: string | null; op: string | null; state: WagonEvent['state'] }

export interface WagonResult {
  wagonNo: string;
  found: boolean;
  current: WagonEvent | null;
  /** Obunachiga: yo'l va vaqt chizig'i. Obunasizga ular kelmaydi, faqat `locked`. */
  trip?: WagonTrip | null;
  timeline?: WagonStep[];
  /** Obunasiz: obunada ko'rinadigan yo'l bor (karta ostida taklif chiziladi). */
  locked?: boolean;
  /** Yangisi birinchi, eng ko'pi 50 ta. */
  fetchedAt: string;
  quota: WagonQuota;
}
