// Superadminlarga boradigan faoliyat xabari: hodisa modeli.
export type Channel = 'web' | 'miniapp' | 'bot';
export type ActivityCategory = 'login' | 'register' | 'loginFailed' | 'action' | 'visit' | 'admin' | 'system';

/** Chaqiruvchilar beradigan narsa. meta XOM: faqat katalogdagi oq ro'yxat kalitlari chiqadi. */
export interface ActivityInput {
  action: string; // audit amali nomi yoki faqat-yozuv nomi
  actorId?: string | null; // amalni qilgan foydalanuvchi (null/yo'q = mehmon yoki tizim)
  entity?: string;
  entityId?: string;
  meta?: unknown;
  count?: number; // logMany: bitta hodisa nechta qatorni bildiradi
  ip?: string | null; // sukut: so'rov konteksti
  ua?: string | null; // sukut: so'rov konteksti
  channel?: Channel; // sukut: so'rov konteksti, keyin katalogdagi o'zgartirish
  guest?: { key?: string; label?: string }; // egasiz hodisa: key sukut hash(ip|ua), label masalan niqoblangan telefon
}

/** Oynaga tushgan hodisa (record() tartibga solgandan keyin). */
export interface ActivityEvent extends ActivityInput {
  at: number; // record() paytidagi Date.now()
  category: ActivityCategory;
}
