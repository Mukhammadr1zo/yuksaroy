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
  const has = (w: string): Prisma.TerminalWhereInput => ({ ownerNameRaw: { contains: w, mode: 'insensitive' } });
  return { OR: any.map(has), ...(none.length ? { NOT: none.map(has) } : {}) };
}
