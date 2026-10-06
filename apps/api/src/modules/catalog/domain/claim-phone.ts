import { normalizePhone } from '@yuksaroy/domain';

/**
 * Da'vogarning tasdiqlangan raqami obyektdagi raqamlardan biriga mosmi.
 *
 * Bu egalikning eng arzon va eng ishonchli dalili: reestrdagi mas'ul shaxs raqami bazada
 * bor, foydalanuvchining raqamiga esa faqat kod bilan tushiladi.
 *
 * null: obyektda tanilgan raqam yo'q, ya'ni solishtirishning o'zi mumkin emas. Uni "mos
 * emas" bilan aralashtirmaymiz: u da'vogarga qarshi dalil bo'lib ko'rinardi.
 * Reestr qatorida bir nechta raqam bo'lishi mumkin ("71 299-12-34, 71 299-12-35"): har biri
 * alohida tekshiriladi. Ikkala tomon ham normalizePhone dan o'tadi: tanilmagan yozuvlar
 * (masalan ikki raqamli) 20261006010000 migratsiyasidan keyin ham asl shaklida qolgan.
 */
export function claimPhoneMatch(claimant: string, known: (string | null | undefined)[]): boolean | null {
  const mine = normalizePhone(claimant);
  const theirs = known
    .flatMap((k) => (k ?? '').split(/[,;/]/))
    .map((p) => normalizePhone(p))
    .filter((p): p is string => !!p);
  if (!mine || !theirs.length) return null;
  return theirs.includes(mine);
}
