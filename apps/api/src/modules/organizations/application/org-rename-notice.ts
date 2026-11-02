import type { PrismaService } from '../../../common/prisma.service';
import { notifyBoth } from '../../../common/telegram';
import type { NotificationsService } from '../../notifications/notifications.service';
import { PlatformAdmin } from './platform-admin';

const QUEUE = {
  uz: "Tasdiqlangan tashkilot nomini o'zgartirdi",
  ru: 'Подтверждённая организация сменила название',
  en: 'A verified organisation changed its name',
} as const;

/**
 * Tasdiqlangan tashkilot nomini o'zgartirsa tasdiq QOLADI, lekin adminlar biladi (egasi qarori, 2026-11-02, sukut):
 * STIR o'zgarsa tasdiq tushadi (create-org.usecase), ammo nom boshqa tashkilotga o'xshab ketishi mumkin va
 * belgi eski nom ostida olingan. Qaytariladigan qaror: admin kerak bo'lsa tasdiqni panelda o'zi olib tashlaydi.
 * Xabar nom o'zgargandagina ketadi (boshqa maydon tahriri jim). Xato tahrirni to'xtatmaydi.
 */
export async function noticeRenamedVerifiedOrg(
  prisma: PrismaService, notifications: NotificationsService,
  prev: { id: string; name: string; kycStatus: string }, nextName: string | undefined, byUserId: string,
): Promise<boolean> {
  const name = nextName?.trim();
  if (prev.kycStatus !== 'VERIFIED' || !name || name === prev.name) return false;
  try {
    const userIds = await new PlatformAdmin(prisma).adminUserIds();
    if (!userIds.length) return false;
    await notifyBoth(prisma, notifications, {
      target: { userIds, exceptUserId: byUserId }, kind: 'adminQueue', inApp: 'claim', href: `/admin/orgs/${prev.id}`,
      vars: (l) => ({ queue: QUEUE[l], what: `${prev.name} -> ${name}` }),
    });
    return true;
  } catch { return false; }
}
