import type { Prisma } from '@prisma/client';
import { ORDER_STUCK_DAYS, ORDER_STUCK_STATUSES, customerCloseAt, orderIdleSince } from '@yuksaroy/domain';
import type { OrderRecord } from '../modules/orders/domain/ports';
import type { PrismaService } from './prisma.service';

/**
 * Domain dagi yagona qoida (orderIdleSince + customerCloseAt) buyurtma yozuviga qo'llanadi:
 * mijozning yopish huquqi (closeStuck) shundan. Hodisa ham, holat o'zgarishi ham tarixga
 * tushadi, shuning uchun oxirgi harakat - tarixning eng kech qatori (tartibga tayanmaydi).
 */
export function closeAtOf(o: OrderRecord): Date | null {
  const last = o.history.length ? new Date(Math.max(...o.history.map((h) => h.at.getTime()))) : null;
  return customerCloseAt(o.status, orderIdleSince({ lastActivityAt: last, slotEndsAt: o.slot?.endsAt ?? null, confirmedAt: o.confirmedAt, createdAt: o.createdAt, storageDays: o.storageDays }));
}

/**
 * "Kelmadi" shu paytgacha qabul qilinadi: mijozning yopish huquqi boshlanadigan payt. noShow dagi
 * tekshiruv ham, taxtadagi tugma (orderCard) ham shundan o'qiydi: qoida bitta, sayt faqat
 * solishtiradi. Pastdagi ikki chegara ham shunday. Faqat CONFIRMED da: terminal buyurtmani faqat
 * shu holatdan bekor qila oladi.
 */
export function noShowUntil(o: OrderRecord): Date | null {
  return o.status === 'CONFIRMED' ? closeAtOf(o) : null;
}

/**
 * "Kelmadi" shu paytdan qabul qilinadi: band qilingan vaqt boshlanishi. Egasining 2026-10-07 qarori:
 * vaqt boshlanmasdan mijoz kechikkan emas, undan oldin terminal faqat sabab yozib bekor qiladi
 * (terminalCancelUntil). Slotsiz buyurtmada pastki chegara yo'q, avvalgidek.
 */
export function noShowFrom(o: OrderRecord): Date | null {
  return o.status === 'CONFIRMED' ? o.slot?.startsAt ?? null : null;
}

/**
 * Terminal tasdiqlangan buyurtmani sabab yozib shu paytgacha bekor qila oladi: vaqt boshlanguncha,
 * keyin "Kelmadi" ishlaydi. Slotsiz buyurtmada chegara noShowUntil bilan bir xil: kech bekor qilish
 * ham, kech "Kelmadi" kabi, mijozning yopish va baho yozish huquqini o'chirib yuborardi.
 */
export function terminalCancelUntil(o: OrderRecord): Date | null {
  return o.status === 'CONFIRMED' ? o.slot?.startsAt ?? closeAtOf(o) : null;
}

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

/**
 * Pul, aylanma va komissiya sanog'idagi DONE buyurtmalar sharti. Egasining 2026-10-07 qarori:
 * mijoz o'zi yopgan buyurtma (closeStuck, IDLE_CLOSED) sanalmaydi, faqat terminal yoki admin
 * yakunlagani sanaladi. Bunday buyurtmada ishni terminal tasdiqlamagan, akt va hisob tuzilmagan;
 * sanalsa terminalning jimligi uning aylanmasini va komissiya chegarasini (yordam sahifasidagi
 * "oyiga 100 ta buyurtma" va'dasi) shishirardi.
 *
 * Ikkinchi shart: admin qayta ochib, keyin terminal yoki admin yakunlagan buyurtma yana sanaladi.
 * Faqat DONE ga haqiqiy o'tish (fromStatus DONE emas): admin formasida joriy holat oldindan
 * tanlangan va DONE -> DONE saqlash sababsiz o'tadi; bunday qator mijoz yopganini jimgina pulga
 * qaytarardi. Tarix sabab bo'yicha emas, rol bo'yicha o'qiladi: mijozning DONE ga boshqa yo'li
 * paydo bo'lsa ham u pulga kirmasin.
 *
 * Holatni (status: 'DONE') chaqiruvchi yozadi, shart so'rovga yoyiladi: so'rovda boshqa OR bo'lsa
 * ikkalasi AND ichiga olinsin, aks holda biri ikkinchisini yozib yuboradi.
 *
 * ponytail: tarix tartibi hisobga olinmaydi: terminal yakunlagan, admin qayta ochgan, keyin mijoz
 * yopgan buyurtma ham sanaladi. Shunday holat uchrasa Order ga yopgan tomon ustuni qo'shiladi.
 */
export const notClientClosed = {
  OR: [
    { history: { none: { toStatus: 'DONE', actorRole: 'CLIENT' } } },
    { history: { some: { toStatus: 'DONE', fromStatus: { not: 'DONE' }, actorRole: { not: 'CLIENT' } } } },
  ],
} satisfies Prisma.OrderWhereInput;
