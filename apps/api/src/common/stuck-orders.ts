import { ORDER_STUCK_DAYS, ORDER_STUCK_STATUSES, orderIdleSince } from '@yuksaroy/domain';
import type { PrismaService } from './prisma.service';

/**
 * Qotib qolgan buyurtmalar ro'yxati (id lar): bosh sahifadagi STUCK_ORDERS sanog'i va admin
 * buyurtmalar ro'yxatidagi filtr shundan o'qiydi.
 *
 * Qarorni domain dagi orderIdleSince qiladi, mijozning yopish huquqi bilan AYNAN bir xil.
 * Baza faqat nomzodlarni toraytiradi: pastdagi uch shart qotishning ZARUR shartlari (yangi
 * buyurtma yoki chegaradan keyin harakati bor buyurtma qotgan bo'la olmaydi). To'liq shartni
 * bazaga yozib bo'lmaydi: pullik saqlash xizmat oxirini storageDays kunga suradi, Prisma esa
 * ustunga kun qo'shib solishtira olmaydi.
 *
 * ponytail: nomzodlar STUCK_SCAN_MAX bilan cheklangan (eng eskilari birinchi). Ochiq va eski
 * buyurtmalar shundan oshsa sanoq kam chiqadi; o'shanda Order ga serviceEndsAt ustuni qo'shib,
 * shartni to'liq bazaga o'tkazish kerak.
 */
export const STUCK_SCAN_MAX = 2000;

export async function stuckOrderIds(prisma: PrismaService, now: Date): Promise<string[]> {
  const cutoff = new Date(now.getTime() - ORDER_STUCK_DAYS * 86_400_000);
  const rows = await prisma.order.findMany({
    where: {
      status: { in: [...ORDER_STUCK_STATUSES] },
      createdAt: { lte: cutoff },
      // Hodisa ham, holat o'zgarishi ham OrderStatusHistory ga yoziladi
      history: { none: { at: { gt: cutoff } } },
    },
    select: {
      id: true, createdAt: true, confirmedAt: true, storageDays: true,
      booking: { select: { slot: { select: { endsAt: true } } } },
      history: { select: { at: true }, orderBy: { at: 'desc' }, take: 1 },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: STUCK_SCAN_MAX,
  });
  return rows
    .filter((o) => orderIdleSince({
      lastActivityAt: o.history[0]?.at ?? null,
      slotEndsAt: o.booking?.slot.endsAt ?? null,
      confirmedAt: o.confirmedAt,
      createdAt: o.createdAt,
      storageDays: o.storageDays,
    }) <= cutoff)
    .map((o) => o.id);
}
