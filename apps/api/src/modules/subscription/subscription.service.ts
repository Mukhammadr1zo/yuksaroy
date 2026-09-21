import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { PlatformConfigService } from '../../common/platform-config.service';
import { extendPremium } from '../premium/extend-premium';
import { payInstructions } from '../premium/pay-instructions';

export const SUBSCRIPTION_STATUSES = ['PENDING', 'ACTIVE', 'CANCELLED'] as const;

type Row = { id: string; userId: string; months: number; amountTiyin: bigint; status: string; provider: string | null; startsAt: Date | null; endsAt: Date | null; paidAt: Date | null; createdAt: Date };
/** BigInt -> Number (JSON). */
export const subscriptionView = (s: Row) => ({ ...s, amountTiyin: Number(s.amountTiyin) });

/**
 * Foydalanuvchi obunasi. Premium bitta e'longa tegishli, obuna esa odamga: telefon
 * raqamini ko'rish va vagon qidiruvi shu bilan ochiladi.
 *
 * To'lov yo'li Premium bilan bir xil: buyurtma PENDING, admin tasdiqlaydi, obuna
 * ACTIVE bo'ladi. Narx PlatformConfig da, admin o'zgartiradi.
 */
@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: PlatformConfigService,
  ) {}

  /** Faol obuna: ACTIVE va muddati o'tmagan. Bir nechta bo'lsa eng kechi. */
  async active(userId: string, now = new Date()) {
    return this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE', endsAt: { gt: now } },
      orderBy: { endsAt: 'desc' },
      select: { id: true, endsAt: true },
    });
  }

  async isActive(userId: string): Promise<boolean> {
    return (await this.active(userId)) !== null;
  }

  async me(userId: string) {
    const [act, pending, cfg] = await Promise.all([
      this.active(userId),
      this.prisma.subscription.findFirst({ where: { userId, status: 'PENDING' }, orderBy: { createdAt: 'desc' } }),
      this.config.get(),
    ]);
    return {
      active: act !== null,
      endsAt: act?.endsAt ?? null,
      pricePerMonthSom: cfg.subscriptionMonthSom,
      pending: pending ? { ...subscriptionView(pending), payInstructions: payInstructions() } : null,
    };
  }

  /**
   * Buyurtma berish. Ochiq (PENDING) buyurtma bo'lsa yangisi ochilmaydi, o'sha qaytadi:
   * tugmani ikki marta bosgan odam admin navbatida ikki qator bo'lib chiqmasin.
   */
  async order(userId: string, months: number) {
    const open = await this.prisma.subscription.findFirst({ where: { userId, status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
    if (open) return { order: subscriptionView(open), payInstructions: payInstructions(), reused: true };
    const cfg = await this.config.get();
    const s = await this.prisma.subscription.create({
      data: { userId, months, amountTiyin: BigInt(months * cfg.subscriptionMonthSom * 100), status: 'PENDING', provider: 'manual' },
    });
    return { order: subscriptionView(s), payInstructions: payInstructions(), reused: false };
  }

  /** Admin navbati: berilgan holat, eski birinchi. */
  async list(status: string) {
    const rows = await this.prisma.subscription.findMany({
      where: { status },
      include: { user: { select: { fullName: true, phone: true, email: true } } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return rows.map(({ user, ...s }) => ({ ...subscriptionView(s), user }));
  }

  /**
   * To'lov tasdiqlandi. Faol obuna bo'lsa yangi muddat uning tugashidan boshlanadi,
   * bo'lmasa hozirdan: erta to'lagan odam kunlarini yo'qotmaydi.
   */
  async confirm(id: string, now = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      const s = await tx.subscription.findUnique({ where: { id } });
      if (!s) throw new NotFoundException({ code: 'SUBSCRIPTION_NOT_FOUND' });
      if (s.status !== 'PENDING') throw new ConflictException({ code: 'SUBSCRIPTION_NOT_PENDING', status: s.status });
      const cur = await tx.subscription.findFirst({
        where: { userId: s.userId, status: 'ACTIVE', endsAt: { gt: now } },
        orderBy: { endsAt: 'desc' },
        select: { endsAt: true },
      });
      const endsAt = extendPremium(cur?.endsAt ?? null, s.months, now);
      const startsAt = cur?.endsAt ?? now;
      const done = await tx.subscription.update({ where: { id }, data: { status: 'ACTIVE', startsAt, endsAt, paidAt: now, provider: s.provider ?? 'manual' } });
      return subscriptionView(done);
    });
  }

  /** To'lov kelmadi yoki buyurtma noto'g'ri: navbatdan chiqadi, obuna berilmaydi. */
  async cancel(id: string) {
    const s = await this.prisma.subscription.findUnique({ where: { id } });
    if (!s) throw new NotFoundException({ code: 'SUBSCRIPTION_NOT_FOUND' });
    if (s.status !== 'PENDING') throw new ConflictException({ code: 'SUBSCRIPTION_NOT_PENDING', status: s.status });
    return subscriptionView(await this.prisma.subscription.update({ where: { id }, data: { status: 'CANCELLED' } }));
  }
}
