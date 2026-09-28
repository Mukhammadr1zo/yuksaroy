import type { Prisma } from '@prisma/client';
import { OWNER_MATCH, type OwnerKind } from '@yuksaroy/domain';

/**
 * Egasining turi bo'yicha shart, reestrdagi nom ustida.
 *
 * Shart bazada bajariladi: ~1700 qatorni xotiraga olib filtrlash sahifalashni ham,
 * sanoqni ham buzadi (jami soni noto'g'ri chiqardi va oxirgi sahifa bo'sh qolardi).
 *
 * Prisma da NOT ro'yxati "hammasi yolg'on bo'lsin" degani, ya'ni sanab o'tilgan
 * bo'laklarning birortasi ham nomda bo'lmasligi kerak. Bizga aynan shu kerak.
 */
export function ownerKindWhere(kind: OwnerKind): Prisma.TerminalWhereInput {
  const { any, none } = OWNER_MATCH[kind];
  // Ikkala ustun ham qaraladi: obyektning nomi va reestrdagi ega nomi boshqa-boshqa
  // bo'lishi mumkin va belgi ularning istalganida turishi mumkin (ownerKind izohiga qara)
  const has = (w: string): Prisma.TerminalWhereInput => ({
    OR: [{ name: { contains: w, mode: 'insensitive' } }, { ownerNameRaw: { contains: w, mode: 'insensitive' } }],
  });
  return { OR: any.map(has), ...(none.length ? { NOT: none.map(has) } : {}) };
}
