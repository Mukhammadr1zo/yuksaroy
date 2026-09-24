import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { PlatformConfigService } from '../../common/platform-config.service';
import { REVEAL_ACTIONS } from '../../common/reveal-actions';
import { notifyBoth } from '../../common/telegram';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminNotify } from '../organizations/application/admin-notify';
import { extendPremium } from '../premium/extend-premium';
import { env } from '../../common/env';

export const SUBSCRIPTION_STATUSES = ['PENDING', 'ACTIVE', 'CANCELLED'] as const;

/** Rekvizit hali kiritilmagan bo'lsa odam murojaat formasiga yuboriladi. */
const PAY_PLACEHOLDER = "To'lov rekvizitlari hali kiritilmagan. Buyurtma raqamini ko'rsatib /contact orqali yozing, to'lov tasdiqlangach xizmat yoqiladi.";

/**
 * Qo'lda to'lov ko'rsatmasi. Rekvizit endi admin sozlamasida: uni o'zgartirish uchun
 * VPS ga kirib .env ni tahrirlash va idishni qayta ishga tushirish shart emas.
 * ponytail: env tarmog'i faqat eski prod qiymati uchun; sozlama to'ldirilgach olinadi.
 */
const payInstructions = (details: string) => ({
  method: 'manual' as const,
  details: details.trim() || env.PREMIUM_PAY_DETAILS?.trim() || PAY_PLACEHOLDER,
});

type Row = { id: string; no: string; userId: string; months: number; amountTiyin: bigint; status: string; provider: string | null; startsAt: Date | null; endsAt: Date | null; paidAt: Date | null; createdAt: Date };
/** BigInt -> Number (JSON). */
export const subscriptionView = (s: Row) => ({ ...s, amountTiyin: Number(s.amountTiyin) });

/**
 * Bir tashkilotning buyurtmalarini navbatda yonma-yon qo'yadi.
 *
 * Jamoa bitta o'tkazma qiladi, operator esa uni ko'chirmaning bitta qatoriga
 * solishtiradi: qatorlar sana bo'yicha aralashib yotsa u har bir xodimni
 * alohida qidirishga majbur bo'ladi va summani jamlay olmaydi.
 *
 * Guruhning o'rni uning eng eski qatoriga teng, ya'ni "eski birinchi" tartibi
 * saqlanadi: eng uzoq kutgan buyurtma baribir tepada turadi.
 *
 * Kalit id bo'yicha, nom bo'yicha emas: tashkilot nomi unikal emas, ya'ni bir xil
 * nomli ikki BOSHQA tashkilot bitta guruhga tushib ketardi va operator bitta
 * o'tkazmani begona qatorlarga taqsimlardi.
 *
 * Tashkilotsiz qator hech kim bilan guruhlanmaydi (kalit sifatida indeks olinadi):
 * ikki notanish odam bitta o'tkazma qilgandek ko'rinmasin.
 */
export function groupByOrg<T extends { orgId: string | null }>(rows: T[]): T[] {
  const groups = new Map<string | number, T[]>();
  rows.forEach((r, i) => {
    // Son va satr kaliti Map da hech qachon to'qnashmaydi
    const key = r.orgId ?? i;
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  });
  return [...groups.values()].flat();
}

/** Obunachining e'lonlari: o'zinikilari va a'zo bo'lgan tashkilotlarniki. */
export async function subscriberListingFilter(tx: Pick<PrismaService, 'membership'>, userId: string) {
  const orgIds = (await tx.membership.findMany({ where: { userId }, select: { orgId: true } })).map((m) => m.orgId);
  return { OR: [{ ownerUserId: userId }, { createdById: userId }, ...(orgIds.length ? [{ orgId: { in: orgIds } }] : [])] };
}

/**
 * Obuna muddatigacha e'lonlarni ko'taradi. Faqat uzaytiradi: qo'lda berilgan uzoqroq
 * muddat (eski Premium to'lovi) qisqarib ketmasin.
 */
async function raiseListings(tx: Pick<PrismaService, 'membership' | 'listing'>, userId: string, endsAt: Date) {
  const owner = await subscriberListingFilter(tx, userId);
  await tx.listing.updateMany({
    where: { AND: [owner, { OR: [{ premiumUntil: null }, { premiumUntil: { lt: endsAt } }] }] },
    data: { premiumUntil: endsAt },
  });
}

/**
 * Foydalanuvchi obunasi: platformadagi yagona pullik mahsulot. U bilan telefon raqami
 * ochiladi, vagon qidiruvi cheksiz bo'ladi va odamning barcha e'lonlari ro'yxatda
 * yuqorida chiqadi. Ilgari e'lonni ko'tarish alohida sotilardi (Premium, har e'longa
 * alohida to'lov) va mijoz ikki marta to'lardi; endi bitta obuna hammasini qamraydi.
 *
 * To'lov yo'li Premium bilan bir xil: buyurtma PENDING, admin tasdiqlaydi, obuna
 * ACTIVE bo'ladi. Narx PlatformConfig da, admin o'zgartiradi.
 */
@Injectable()
export class SubscriptionService {
  /** Tugagan obuna shuncha kungacha kartada ko'rsatiladi: undan eskisi qaror uchun ishlamaydi. */
  private static readonly LAPSED_DAYS = 90;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: PlatformConfigService,
    private readonly adminNotify: AdminNotify,
    private readonly notifications: NotificationsService,
  ) {}

  /** Faol obuna: ACTIVE va muddati o'tmagan. Bir nechta bo'lsa eng kechi. */
  async active(userId: string, now = new Date()) {
    return this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE', endsAt: { gt: now } },
      orderBy: { endsAt: 'desc' },
      select: { id: true, endsAt: true },
    });
  }

  /**
   * Bitta e'lonni obuna muddatigacha ko'taradi: obunachi yangi e'lon bersa, u keyingi
   * tasdiqni kutmasdan darhol yuqorida chiqadi. Obunasi yo'q bo'lsa hech narsa qilmaydi.
   */
  async raiseListing(userId: string, listingId: string): Promise<void> {
    const act = await this.active(userId);
    if (!act?.endsAt) return;
    await this.prisma.listing.updateMany({
      where: { id: listingId, OR: [{ premiumUntil: null }, { premiumUntil: { lt: act.endsAt } }] },
      data: { premiumUntil: act.endsAt },
    });
  }

  async isActive(userId: string): Promise<boolean> {
    return (await this.active(userId)) !== null;
  }

  async me(userId: string) {
    const now = new Date();
    const [act, pending, cfg] = await Promise.all([
      this.active(userId, now),
      this.prisma.subscription.findFirst({ where: { userId, status: 'PENDING' }, orderBy: { createdAt: 'desc' } }),
      this.config.get(),
    ]);
    return {
      active: act !== null,
      endsAt: act?.endsAt ?? null,
      // Faol obunachiga ortiqcha so'rov ketmaydi: tugagani faqat obunasizga qaraladi
      expired: act ? null : await this.lapsed(userId, now),
      pricePerMonthSom: cfg.subscriptionMonthSom,
      // Kartadagi uchta chegara shu yerdan: cfg allaqachon o'qilgan, qo'shimcha so'rov yo'q.
      // Ikkinchi chaqiruv (narx yo'li) kartaga ikkinchi yuklanish qo'shardi.
      phoneRevealDaily: cfg.phoneRevealDaily,
      wagonSearchFree: cfg.wagonSearchFree,
      pending: pending ? { ...subscriptionView(pending), payInstructions: payInstructions(cfg.payDetails) } : null,
    };
  }

  /**
   * Yaqinda tugagan obuna: qachon tugagani va shu muddatda necha marta raqam ochilgani.
   *
   * Raqam soni bezak emas: odam yangilash haqida qaror qilayotganda obuna unga nima
   * berganini ko'rsatadi va nol bo'lsa ekranga umuman chiqmaydi. Uch oydan eski obuna
   * ko'rsatilmaydi, chunki eski son bugungi qaror uchun hech narsa bermaydi.
   * Qator ACTIVE bo'lib qolaveradi: tugagani endsAt dan bilinadi, holat o'zgarmaydi.
   */
  private async lapsed(userId: string, now: Date) {
    const from = new Date(now.getTime() - SubscriptionService.LAPSED_DAYS * 86_400_000);
    const s = await this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE', endsAt: { lte: now, gt: from } },
      orderBy: { endsAt: 'desc' },
      select: { startsAt: true, endsAt: true, createdAt: true },
    });
    if (!s?.endsAt) return null;
    const reveals = await this.prisma.auditLog.count({
      where: { actorId: userId, action: { in: [...REVEAL_ACTIONS] }, createdAt: { gte: s.startsAt ?? s.createdAt, lt: s.endsAt } },
    });
    return { endsAt: s.endsAt, reveals };
  }

  /**
   * Buyurtma berish. Ochiq (PENDING) buyurtma bo'lsa yangisi ochilmaydi, o'sha qaytadi:
   * tugmani ikki marta bosgan odam admin navbatida ikki qator bo'lib chiqmasin.
   */
  async order(userId: string, months: number) {
    const cfg = await this.config.get();
    const openWhere = { where: { userId, status: 'PENDING' }, orderBy: { createdAt: 'desc' as const } };
    try {
      // Serializable: ikki so'rov bir vaqtda kelsa (ikki marta bosish, ikki varaq) ikkinchisi
      // yiqiladi va pastda mavjud buyurtma qaytariladi; aks holda navbatda ikki qator bo'lardi
      return await this.prisma.$transaction(async (tx) => {
        const open = await tx.subscription.findFirst(openWhere);
        if (open) return { order: subscriptionView(open), payInstructions: payInstructions(cfg.payDetails), reused: true };
        // Ketma-ketlik tranzaksiyaga bo'ysunmaydi: qayta urinishda raqam tushib qoladi,
        // lekin hech qachon takrorlanmaydi. Buyurtmadagi yo'l bilan bir xil
        const [{ nextval }] = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('pay_no_seq')`;
        const s = await tx.subscription.create({
          data: { no: `PAY-${Number(nextval)}`, userId, months, amountTiyin: BigInt(months * cfg.subscriptionMonthSom * 100), status: 'PENDING', provider: 'manual' },
        });
        // Takror xabar kaliti odamga bog'langan, buyurtmaga emas: bekor qilib qayta buyurtma
        // bergan odam har safar yangi id bilan adminlarga xabar yog'dira olmasin
        void this.adminNotify.queued('subscriptionPending', `${s.no}, ${months} oy`, `sub:${userId}`, userId).catch(() => {});
        return { order: subscriptionView(s), payInstructions: payInstructions(cfg.payDetails), reused: false };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034')) throw e;
      const open = await this.prisma.subscription.findFirst(openWhere);
      if (!open) throw e;
      return { order: subscriptionView(open), payInstructions: payInstructions(cfg.payDetails), reused: true };
    }
  }

  /**
   * Admin navbati: berilgan holat, eski birinchi, bir tashkilotniki yonma-yon.
   *
   * Tashkilot a'zolikdan olinadi, buyurtmada saqlanmaydi: jamoa uchun alohida hisob
   * qurilmagan, bu ustun faqat operator bitta o'tkazmani bir necha qatorga
   * taqsimlayotganda kerak.
   *
   * Xodim bir necha tashkilotda a'zo bo'lsa a'zoliklardan biri tanlanadi (eng eskisi).
   * Bu uning ish beruvchisi ekanini kafolatlamaydi va kafolatlay ham olmaydi, shuning
   * uchun ustun qaror bermaydi: operator baribir to'lov izohidagi PAY raqamiga qaraydi.
   */
  async list(status: string) {
    const rows = await this.prisma.subscription.findMany({
      where: { status },
      include: {
        user: {
          select: {
            fullName: true,
            phone: true,
            email: true,
            memberships: { select: { orgId: true, org: { select: { name: true } } }, orderBy: { createdAt: 'asc' }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return groupByOrg(rows.map(({ user: { memberships, ...user }, ...s }) => ({ ...subscriptionView(s), user, orgId: memberships[0]?.orgId ?? null, orgName: memberships[0]?.org.name ?? null })));
  }

  /**
   * To'lov tasdiqlandi. Faol obuna bo'lsa yangi muddat uning tugashidan boshlanadi,
   * bo'lmasa hozirdan: erta to'lagan odam kunlarini yo'qotmaydi.
   */
  async confirm(id: string, now = new Date()) {
    const out = await this.prisma.$transaction(async (tx) => {
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
      // Holat sharti yangilashning o'zida: ikki admin bir vaqtda bossa faqat bittasi o'tadi
      const r = await tx.subscription.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'ACTIVE', startsAt, endsAt, paidAt: now, provider: s.provider ?? 'manual' } });
      if (r.count === 0) throw new ConflictException({ code: 'SUBSCRIPTION_NOT_PENDING' });
      await raiseListings(tx, s.userId, endsAt);
      return subscriptionView({ ...s, status: 'ACTIVE', startsAt, endsAt, paidAt: now, provider: s.provider ?? 'manual' });
    });
    // Tranzaksiyadan keyin: o'zgarish qaytarib olinsa yolg'on xabar ketmasin
    this.tell(out.userId, 'subscriptionActive', { until: out.endsAt?.toISOString().slice(0, 10) ?? '' });
    return out;
  }

  /**
   * Foydalanuvchi o'z kutilayotgan buyurtmasini yopadi: 1 oy tanlagan odam uni bekor
   * qilib, 12 oyga qayta bera olsin (ochiq buyurtma turganda order() muddatni o'zgartirmaydi).
   *
   * Shart UPDATE ning ichida, chunki ayni damda admin tasdiqlayotgan bo'lishi mumkin:
   * tasdiq birinchi o'tsa bu yerda nol qator yangilanadi va obuna faol qolaveradi,
   * aksincha bo'lsa confirm() dagi shart tushmaydi va uning butun tranzaksiyasi
   * (e'lonlarni ko'tarish ham) orqaga qaytadi.
   */
  async cancelOwn(userId: string, id: string) {
    const s = await this.prisma.subscription.findFirst({ where: { id, userId }, select: { status: true } });
    if (!s) throw new NotFoundException({ code: 'SUBSCRIPTION_NOT_FOUND' });
    const r = await this.prisma.subscription.updateMany({ where: { id, userId, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    if (r.count === 0) throw new ConflictException({ code: 'SUBSCRIPTION_NOT_PENDING', status: s.status });
    return this.me(userId); // karta yangi holatni shu javobdan oladi, ikkinchi so'rov kerak emas
  }

  /** To'lov kelmadi yoki buyurtma noto'g'ri: navbatdan chiqadi, obuna berilmaydi. */
  async cancel(id: string, reason: string) {
    const s = await this.prisma.subscription.findUnique({ where: { id } });
    if (!s) throw new NotFoundException({ code: 'SUBSCRIPTION_NOT_FOUND' });
    const r = await this.prisma.subscription.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    if (r.count === 0) throw new ConflictException({ code: 'SUBSCRIPTION_NOT_PENDING', status: s.status });
    this.tell(s.userId, 'subscriptionCancelled', { reason });
    return subscriptionView({ ...s, status: 'CANCELLED' });
  }

  /** Obunachiga qaror xabari: kabinetdagi qo'ng'iroq va Telegram; to'lov oqimini to'xtatmaydi. */
  private tell(userId: string, kind: 'subscriptionActive' | 'subscriptionCancelled', vars: Record<string, string>) {
    void notifyBoth(this.prisma, this.notifications, {
      target: { userIds: [userId] },
      kind,
      inApp: 'subscription',
      href: '/dashboard/subscription',
      vars,
    }).catch(() => {});
  }
}
