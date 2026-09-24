import { Injectable, Logger } from '@nestjs/common';
import { QUEUE_HREF, QUEUE_LABEL, type QueueKey } from '../../../common/admin-queues';
import { PrismaService } from '../../../common/prisma.service';
import { notifyBoth } from '../../../common/telegram';
import { NotificationsService } from '../../notifications/notifications.service';
import { PlatformAdmin } from './platform-admin';

/**
 * Navbatga yangi ish tushganda adminlarga xabar.
 *
 * Ikki yo'l birga: panel qo'ng'irog'i va Telegram (notifyBoth). Faqat Telegram bo'lsa,
 * botni bog'lamagan admin hech narsa ko'rmasdi va butun eslatma jim turardi.
 *
 * Xabar boshlagan odamga o'zining amali haqida qaytmaydi: platforma admini o'zi
 * e'lon chiqarsa yoki obuna buyurtma bersa, o'ziga xabar kelishi kulgili bo'lardi.
 */
@Injectable()
export class AdminNotify {
  private readonly log = new Logger('AdminNotify');
  /**
   * Shu obyekt haqida oxirgi marta qachon xabar yuborilgan.
   *
   * Nega kerak: e'lonni arxivga olib qayta yuborish cheksiz takrorlanadi, ya'ni bitta
   * odam adminlarga xabar yog'dira olardi va haqiqiy navbat shovqin ichida yo'qolardi.
   * ponytail: bitta jarayon xotirasida; ko'p nusxa bo'lsa Redis SETNX + EXPIRE.
   */
  private readonly sent = new Map<string, number>();
  private static readonly QUIET_MS = 6 * 3_600_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly admins: PlatformAdmin,
  ) {}

  /**
   * @param key navbat nomi
   * @param what qisqacha: e'lon sarlavhasi yoki tashkilot nomi
   * @param entityId takrorlanishni to'xtatish uchun
   * @param byUserId amalni boshlagan odam: unga xabar bormaydi
   */
  async queued(key: QueueKey, what: string, entityId: string, byUserId?: string): Promise<void> {
    const now = Date.now();
    const last = this.sent.get(entityId);
    if (last && now - last < AdminNotify.QUIET_MS) return;
    if (this.sent.size > 5_000) this.sent.clear();
    this.sent.set(entityId, now);

    const userIds = await this.admins.adminUserIds();
    if (!userIds.length) return;
    await notifyBoth(this.prisma, this.notifications, {
      target: { userIds, exceptUserId: byUserId },
      kind: 'adminQueue',
      inApp: 'claim',
      href: QUEUE_HREF[key],
      vars: (l) => ({ queue: QUEUE_LABEL[l][key], what }),
    });
  }

  /** Kunlik ogohlantirish: eng eski ish necha kundan beri kutmoqda. */
  async stale(rows: { key: QueueKey; days: number }[]): Promise<void> {
    if (!rows.length) return;
    const userIds = await this.admins.adminUserIds();
    if (!userIds.length) return;
    // ponytail: jarayon qayta ishga tushsa kunlik hisob nolga qaytadi va eslatma takrorlanishi
    // mumkin; deploy tez-tez bo'lsa bugungi yozuvni Notification jadvalidan tekshirish kerak.
    await notifyBoth(this.prisma, this.notifications, {
      target: { userIds },
      kind: 'adminStale',
      inApp: 'claim',
      href: '/admin',
      vars: (l) => ({ list: rows.map((r) => `${QUEUE_LABEL[l][r.key]}: ${r.days}`).join(String.fromCharCode(10)) }),
    });
    this.log.log(`kutib qolgan navbatlar: ${rows.map((r) => `${r.key} ${r.days}`).join(', ')}`);
  }
}
