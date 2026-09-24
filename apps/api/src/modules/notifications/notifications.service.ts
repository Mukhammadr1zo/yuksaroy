import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export type NotificationKind = 'inquiry' | 'message' | 'orderNew' | 'orderStatus' | 'claim' | 'kyc' | 'premium' | 'market' | 'listing' | 'subscription';
export interface NotificationInput { kind: NotificationKind; title: string; body?: string | null; href?: string | null }

/**
 * Saytdagi bildirishnomalar. Telegram xabari yuboriladigan joyda shu yozuv ham qo'shiladi:
 * Telegramni bog'lamagan foydalanuvchi hodisani baribir ko'radi.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Bir nechta foydalanuvchiga bir xil xabar. Xato yozuvni yuborgan amalni to'xtatmasligi kerak. */
  async push(userIds: readonly string[], n: NotificationInput): Promise<void> {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (!ids.length) return;
    await this.prisma.notification.createMany({
      data: ids.map((userId) => ({ userId, kind: n.kind, title: n.title, body: n.body ?? null, href: n.href ?? null })),
    });
  }

  /** Tashkilot a'zolari (ownersOnly: faqat egasi) va shaxsiy egasi uchun foydalanuvchi ro'yxati. */
  async recipients(where: { orgIds?: (string | null | undefined)[]; userIds?: (string | null | undefined)[]; ownersOnly?: boolean }): Promise<string[]> {
    const orgIds = (where.orgIds ?? []).filter((x): x is string => !!x);
    const direct = (where.userIds ?? []).filter((x): x is string => !!x);
    if (!orgIds.length) return direct;
    const ms = await this.prisma.membership.findMany({
      where: { orgId: { in: orgIds }, ...(where.ownersOnly ? { isOwner: true } : {}) },
      select: { userId: true },
    });
    return [...new Set([...direct, ...ms.map((m) => m.userId)])];
  }

  async list(userId: string, limit = 30) {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, unread };
  }

  /** ids berilmasa hammasi o'qilgan deb belgilanadi. */
  async markRead(userId: string, ids?: string[]) {
    const where = { userId, readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) };
    const r = await this.prisma.notification.updateMany({ where, data: { readAt: new Date() } });
    return { updated: r.count };
  }
}
