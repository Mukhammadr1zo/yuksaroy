import { ConflictException, NotFoundException } from '@nestjs/common';
import { uzLocalDate, uzLocalToUtc } from '@yuksaroy/domain';
import type { AuditService } from '../../common/audit.service';
import type { PrismaService } from '../../common/prisma.service';
import { notifyBoth } from '../../common/telegram';
import type { NotificationsService } from '../notifications/notifications.service';

export const REMIND_ACTION = 'admin.subscription.remind';
const HREF = '/dashboard/subscription';

/** Bugungi kunning Toshkent boshi (UTC instant). */
export const remindDayStart = (now: Date) => uzLocalToUtc(uzLocalDate(now), '00:00');

/**
 * Bugun eslatma ketganmi: qo'lda (audit qatori) yoki avto (subscription.remindedAt).
 * Ikkalasidan bugungi eng yangisi qaytadi, bo'lmasa null. Kechagisi to'smaydi.
 */
export function remindBlockedAt(lastManualAt: Date | null | undefined, autoRemindedAt: Date | null | undefined, dayStart: Date): Date | null {
  const today = [lastManualAt, autoRemindedAt].filter((d): d is Date => !!d && d >= dayStart);
  return today.length ? new Date(Math.max(...today.map((d) => d.getTime()))) : null;
}

/**
 * Qo'lda eslatma: operator tugayotgan obunachiga "uzayting" xabarini o'zi yuboradi.
 *
 * Nega jadval yo'q: yuborishning o'zi audit qatori (admin.subscription.remind); ikkinchi
 * manba u bilan ajralib ketardi. Chegara kuniga bitta: bugun avto eslatma ketgan odamga
 * ham ikkinchi xabar ketmasin. Audit AVVAL va strict: yozilmasa yuborilmaydi
 * (expiry-reminder.ts falsafasi: bitta yo'qolgan eslatma ikkitadan yaxshi).
 * remindedAt ga tegilmaydi: avto 3 kunlik eslatma o'z yo'lida qoladi.
 *
 * ponytail: ikki admin bir soniyada bossa ikki xabar ketadi (Telegram chelagi 5/soat bor).
 */
export async function remindManual(
  prisma: PrismaService, notifications: NotificationsService, audit: AuditService, actorId: string, id: string, now = new Date(),
): Promise<{ sentAt: string }> {
  const s = await prisma.subscription.findUnique({ where: { id }, select: { id: true, no: true, userId: true, status: true, endsAt: true, remindedAt: true } });
  if (!s) throw new NotFoundException({ code: 'SUBSCRIPTION_NOT_FOUND' });
  if (s.status !== 'ACTIVE' || !s.endsAt || s.endsAt <= now) throw new ConflictException({ code: 'SUBSCRIPTION_NOT_ACTIVE', status: s.status });
  const dayStart = remindDayStart(now);
  // [action, createdAt] indeksi: bugungi o'nlab qator ichidan meta.userId bo'yicha
  const last = await prisma.auditLog.findFirst({
    where: { action: REMIND_ACTION, createdAt: { gte: dayStart }, meta: { path: ['userId'], equals: s.userId } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  const at = remindBlockedAt(last?.createdAt, s.remindedAt, dayStart);
  if (at) throw new ConflictException({ code: 'REMIND_TODAY', at });
  await audit.log({ actorId, action: REMIND_ACTION, entity: 'Subscription', entityId: id, meta: { userId: s.userId, no: s.no, endsAt: s.endsAt, manual: true } }, true);
  await notifyBoth(prisma, notifications, {
    target: { userIds: [s.userId] }, kind: 'subscriptionExpiring', inApp: 'subscription', href: HREF, vars: { date: uzLocalDate(s.endsAt) },
  }).catch(() => {});
  return { sentAt: now.toISOString() };
}
