/**
 * Yozishmaga kirish huquqi. Sof funksiya: baza o'qishlari chaqiruvchida qoladi,
 * qaror esa shu yerda yagona joyda turadi va test qilinadi.
 *
 * Nega muhim: yozishmada telefon raqami, narx va hujjat bo'ladi. Ilgari tekshiruv
 * e'lonning hozirgi egasiga qarardi; obyekt boshqa tashkilotga o'tsa eski suhbat
 * yangi egaga ochilib qolardi. Endi qabul qiluvchi yozishma ochilganda qotiriladi.
 */
export type ThreadParties = {
  fromUserId: string;
  toOrgId: string | null;
  toUserId: string | null;
  toPlatform: boolean;
};

export type Viewer = {
  userId: string;
  orgIds: readonly string[];
  isPlatformAdmin: boolean;
};

export type ThreadRole = 'owner' | 'client' | null;

/**
 * Qaysi tomonda turgani: yuboruvchi "client", qabul qiluvchi "owner".
 * Ikkalasi ham bo'lmasa null, ya'ni yozishma ko'rinmaydi.
 *
 * Yuboruvchi birinchi tekshiriladi: o'z obyektiga o'zi yozgan odam uchun "client"
 * to'g'riroq, chunki suhbatni u boshlagan.
 */
export function threadRole(t: ThreadParties, v: Viewer): ThreadRole {
  if (t.fromUserId === v.userId) return 'client';
  if (t.toUserId && t.toUserId === v.userId) return 'owner';
  if (t.toOrgId && v.orgIds.includes(t.toOrgId)) return 'owner';
  // Egasi yo'q obyekt haqidagi xabarga platforma javob beradi
  if (t.toPlatform && v.isPlatformAdmin) return 'owner';
  return null;
}
