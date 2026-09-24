import { uzLocalDate } from '@yuksaroy/domain';
import { notifyBoth } from '../../common/telegram';
import type { PrismaService } from '../../common/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';

const DAYS = 3;
const HREF = '/dashboard/subscription';
/** Bir siklda shuncha qator; qolgani ertangi siklda ketadi. */
const BATCH = 500;

/**
 * Obuna tugashidan uch kun oldin bitta eslatma.
 *
 * Nega yangi jadval yo'q: yuborilgani obunaning o'z qatorida belgilanadi va belgi
 * YUBORISHDAN OLDIN qo'yiladi. Kunlik sikl qayta ishga tushsa ham xabar takrorlanmaydi;
 * yuborish yiqilsa bitta eslatma yo'qoladi, bu esa ikkita xabardan yaxshiroq.
 *
 * Uzaytirgan odam chetda qoladi: uzaytirish eski qatorga tegmaydi, yangi qator ochiladi,
 * shuning uchun keyingi obunasi oynadan nariga o'tgan bo'lsa eskisining tugashi hodisa emas.
 *
 * Sana ISO ko'rinishida ('2026-09-27'): xabar qisqa va uch tilda bir ma'noli bo'lsin.
 */
export async function remindExpiring(prisma: PrismaService, notifications: NotificationsService, now = new Date()): Promise<number> {
  const until = new Date(now.getTime() + DAYS * 86_400_000);
  const rows = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      remindedAt: null,
      endsAt: { gt: now, lte: until },
      user: { subscriptions: { none: { status: 'ACTIVE', endsAt: { gt: until } } } },
    },
    select: { id: true, userId: true, endsAt: true },
    take: BATCH,
  });
  let sent = 0;
  for (const s of rows) {
    if (!s.endsAt) continue;
    // Belgini band qilish atomar: ikkinchi nusxa count 0 oladi va yubormaydi
    const claimed = await prisma.subscription.updateMany({ where: { id: s.id, remindedAt: null }, data: { remindedAt: now } });
    if (!claimed.count) continue;
    // Bitta odamdagi xato qolganlarni to'xtatmasin
    await notifyBoth(prisma, notifications, {
      target: { userIds: [s.userId] },
      kind: 'subscriptionExpiring',
      inApp: 'subscription',
      href: HREF,
      vars: { date: uzLocalDate(s.endsAt) },
    }).catch(() => {});
    sent++;
  }
  return sent;
}
