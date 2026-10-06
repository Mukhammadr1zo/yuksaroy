import type { Prisma } from '@prisma/client';
import { ORDER_STUCK_DAYS, ORDER_STUCK_STATUSES } from '@yuksaroy/domain';

/**
 * Qotib qolgan buyurtmalar sharti, bazada sanash uchun. Ta'rif domain dagi orderIdleSince
 * bilan AYNAN bir xil: harakatsizlik payti (oxirgi hodisa, slot oxiri, tasdiq, yaratilgan
 * payt) dan eng kechi ham chegaradan oldin bo'lsa, buyurtma qotgan.
 *
 * Ya'ni "eng kechi <= chegara" sharti "har biri <= chegara" ga teng va har bo'lak alohida
 * shart bo'lib yoziladi. OR lar AND ichida: ikkita OR bitta obyektda bir-birini bosib qolardi.
 */
export function stuckOrderWhere(now: Date): Prisma.OrderWhereInput {
  const cutoff = new Date(now.getTime() - ORDER_STUCK_DAYS * 86_400_000);
  return {
    status: { in: [...ORDER_STUCK_STATUSES] },
    createdAt: { lte: cutoff },
    // Hodisa ham, holat o'zgarishi ham OrderStatusHistory ga yoziladi
    history: { none: { at: { gt: cutoff } } },
    AND: [
      { OR: [{ confirmedAt: null }, { confirmedAt: { lte: cutoff } }] },
      { OR: [{ booking: { is: null } }, { booking: { is: { slot: { endsAt: { lte: cutoff } } } } }] },
    ],
  };
}
