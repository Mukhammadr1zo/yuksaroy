import { matchWatches, uzLocalDate, uzLocalToUtc, watchUserIds, type WatchEvent } from '@yuksaroy/domain';
import type { PrismaService } from '../../common/prisma.service';

/**
 * Bir hodisaga ko'pi bilan shuncha kuzatuv qaraladi.
 * ponytail: xotiradagi hovuz chegaralangan (katalog qoidasi bilan bir xil);
 * kuzatuvlar bundan oshsa hodisani navbatga chiqarish kerak bo'ladi.
 */
const TAKE = 500;

/**
 * Hodisaga mos kuzatuv egalari.
 *
 * "Bitta kuzatuvga kuniga bir marta" ikki bosqichda ishlaydi:
 *   1) bugun xabar bergan kuzatuv umuman O'QILMAYDI (shart bazada, indeks bor);
 *   2) mos kelganlarga vaqt DARHOL yoziladi - xabardan OLDIN.
 * Nega oldin: xabar yo'li ikkita (qo'ng'iroq va Telegram) va ular alohida yiqiladi;
 * belgi keyin yozilsa, xato paytida bir odam bir kunda bir necha xabar olardi.
 * Bu muddati o'tgan e'lon bilan bir xil tanlov: yo'qotish bo'ladi, takror emas.
 */
export async function watchers(prisma: PrismaService, e: WatchEvent, now = new Date()): Promise<string[]> {
  const dayStart = uzLocalToUtc(uzLocalDate(now), '00:00');
  const rows = await prisma.watch.findMany({
    where: {
      kind: e.kind,
      OR: [{ lastSentAt: null }, { lastSentAt: { lt: dayStart } }],
      // O'chirilgan yoki admin bloklagan hisob: unga yozilgan qo'ng'iroqni hech kim
      // o'qimaydi. Shart BAZADA, chunki aks holda bunday qatorlar 500 talik hovuzda
      // tirik odamlarning joyini egallardi.
      user: { isActive: true },
    },
    select: { id: true, userId: true, kind: true, params: true },
    take: TAKE,
  });
  const matched = matchWatches(e, rows);
  if (!matched.length) return [];
  await prisma.watch.updateMany({ where: { id: { in: matched.map((w) => w.id) } }, data: { lastSentAt: now } });
  return watchUserIds(matched);
}
