import { REPORT_STATUSES, type ReportStatus } from '@yuksaroy/domain';

/**
 * Shikoyat holati bitta joyda: filtr ham, qaror ustunlari ham.
 *
 * Nega alohida fayl: murojaat qutisida bu juftlik kontroller ichida yotibdi va uni
 * sinash uchun butun kontrollerni import qilishga to'g'ri keladi. Bu yerda shunday
 * qilinmaydi.
 */

/** Noma'lum yoki bo'sh qiymat = filtrsiz. */
export const reportWhere = (v?: string) =>
  ((REPORT_STATUSES as readonly string[]).includes(v ?? '') ? { status: v as ReportStatus } : {});

/**
 * Qaror ustunlari BIRGA yoziladi: holat, kim, qachon, izoh. Ikki joyda yozilsa ular
 * bir-biridan ayrilib ketardi va izoh egasiz qolardi.
 */
export const resolveData = (approve: boolean, userId: string, note?: string) => ({
  status: (approve ? 'RESOLVED' : 'DISMISSED') as ReportStatus,
  resolvedById: userId,
  resolvedAt: new Date(),
  resolveNote: note?.trim() || null,
});
