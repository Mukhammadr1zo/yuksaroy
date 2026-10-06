import { Controller, Get, Logger, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { uzLocalToUtc } from '@yuksaroy/domain';
import { queueStats } from '../../common/admin-queues';
import { countByDay } from '../../common/day-counts';
import { FANOUT_ACTION } from '../../common/fanout';
import { PlatformConfigService } from '../../common/platform-config.service';
import { PrismaService } from '../../common/prisma.service';
import { REVEAL_ACTIONS } from '../../common/reveal-actions';
import { JwtGuard } from '../identity/presentation/jwt.guard';
import { dayKeys } from '../impressions/day-series';
import { ImpressionsService } from '../impressions/impressions.service';
import { PlatformAdminGuard } from '../organizations/presentation/platform-admin.guard';
import { PlatformOwnerGuard } from '../organizations/presentation/platform-owner.guard';
import { alertsOf, fillSeries, growthPair, revealFunnel, sortWork } from './admin-home';
import { monthWindow } from './revenue';

const DAY = 86_400_000;

/**
 * Boshqaruv bosh sahifasi: bugungi ish (navbatlar yoshi bilan), pul (tushumsiz),
 * o'sish 7 kun / oldingi 7 kun, 30 kunlik to'rt chiziqcha, ogohlantirishlar, komissiya
 * chegarasi va raqam ochish voronkasi. Ilgari bularning bir qismi /admin/health ning
 * to'liq shoxida edi: qobiq har o'tishda so'raydigan yo'l bosh sahifaning og'ir
 * hisoblarini ko'tarib yurardi.
 *
 * Har blok safe() bilan alohida: bittasi yiqilsa qolgani ko'rinadi, yiqilgani null va
 * failed[] da nomi bilan qaytadi.
 *
 * Kesh yo'q: menyu badge (health) va ish ro'yxati bir xil raqam ko'rsatsin.
 * ponytail: so'rov 500 ms dan oshsa 60 s xotira keshi (PlatformConfigService uslubida).
 * ponytail: Order va WagonSearch da createdAt-only indeks yo'q, 30 kunlik skan hozirgi hajmda
 * arzon; kunlik qator soni o'n minglarga yetsa @@index([createdAt]) alohida migratsiya bilan.
 */
@ApiTags('admin')
@Controller('admin/home')
@UseGuards(JwtGuard, PlatformAdminGuard)
@ApiCookieAuth('ys_access')
export class AdminHomeController {
  private readonly log = new Logger('AdminHome');

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: PlatformConfigService,
    private readonly impressions: ImpressionsService,
  ) {}

  @Get()
  async home() {
    const now = new Date();
    const failed: string[] = [];
    const safe = async <T>(name: string, fn: () => Promise<T>): Promise<T | null> => {
      try {
        return await fn();
      } catch (e) {
        failed.push(name);
        this.log.error(`admin/home: ${name} yiqildi: ${(e as Error).message.split(String.fromCharCode(10)).pop()}`);
        return null;
      }
    };
    const in7 = new Date(now.getTime() + 7 * DAY);
    const since24h = new Date(now.getTime() - DAY);
    const [db, work, money, growth, series, phonePlans, wagon, ads, commission, reveals, noProvider] = await Promise.all([
      this.pingDb(),
      safe('work', async () => sortWork(await queueStats(this.prisma, true))),
      safe('money', () => this.money(now, in7)),
      safe('growth', () => this.growth(now)),
      safe('series', () => this.series(now)),
      // PHONE ruxsatli faol tarif soni: nol bo'lsa hech kim obuna sotib ololmaydi
      safe('plans', () => this.prisma.plan.count({ where: { active: true, grants: { has: 'PHONE' } } })),
      // Vagon manbasi 24 soatda: javobsiz qidiruvlar meta.error=true bilan yoziladi
      safe('wagon', async () => {
        const where = { action: 'wagon.search', createdAt: { gte: since24h } };
        const [total, errors] = await Promise.all([
          this.prisma.auditLog.count({ where }),
          this.prisma.auditLog.count({ where: { ...where, meta: { path: ['error'], equals: true } } }),
        ]);
        return { errors, total };
      }),
      safe('ads', async () => {
        const [expired, ending] = await Promise.all([
          this.prisma.adPlacement.count({ where: { status: 'ACTIVE', endsAt: { lt: now } } }),
          this.prisma.adPlacement.count({ where: { status: 'ACTIVE', endsAt: { gte: now, lte: in7 } } }),
        ]);
        return { expired, ending };
      }),
      safe('commission', () => this.commission()),
      safe('reveals', () => this.reveals(now)),
      // 24 soatda hech kimga yuborilmagan yangi so'rovlar: sent son bo'lib yoziladi (common/fanout.ts)
      safe('fanout', () => this.prisma.auditLog.count({ where: { action: FANOUT_ACTION, createdAt: { gte: since24h }, meta: { path: ['sent'], equals: 0 } } })),
    ]);
    return {
      db,
      work: work ?? [],
      money,
      growth,
      series,
      alerts: alertsOf({ phonePlans, wagon, ads, db, noProvider }),
      // Uch oylik tarix ataylab yo'q: qaror ikkita songa qaraydi
      commission,
      // Raqam ochish voronkasi, 30 kun. Bepul oyna o'chiq ekan brauzer kartani chizmaydi.
      reveals,
      failed, // bo'sh bo'lsa hammasi joyida
    };
  }

  /**
   * Tushum faqat egaga: shu oy va o'tgan oy, paidAt bo'yicha, Toshkent oyi (monthWindow).
   * Mijoz isOwner bo'lmasa bu yo'lni so'ramaydi. Alohida yo'l, chunki qolgan bloklar
   * operatorga ham ochiq va bitta javobda "ega bo'lsa qo'sh" sharti xatoga moyil.
   */
  @Get('money')
  @UseGuards(PlatformOwnerGuard)
  async revenue() {
    const now = new Date();
    const { start, prevStart } = monthWindow(now);
    const [subNow, premNow, subPrev, premPrev] = await Promise.all([
      this.prisma.subscription.aggregate({ where: { paidAt: { gte: start, lt: now } }, _sum: { amountTiyin: true }, _count: { _all: true } }),
      this.prisma.premiumOrder.aggregate({ where: { paidAt: { gte: start, lt: now } }, _sum: { amountTiyin: true }, _count: { _all: true } }),
      this.prisma.subscription.aggregate({ where: { paidAt: { gte: prevStart, lt: start } }, _sum: { amountTiyin: true } }),
      this.prisma.premiumOrder.aggregate({ where: { paidAt: { gte: prevStart, lt: start } }, _sum: { amountTiyin: true } }),
    ]);
    const som = (v: bigint | null) => Number(v ?? 0n); // BigInt JSON ga chiqmaydi
    return {
      thisMonthTiyin: som(subNow._sum.amountTiyin) + som(premNow._sum.amountTiyin),
      prevMonthTiyin: som(subPrev._sum.amountTiyin) + som(premPrev._sum.amountTiyin),
      payments: subNow._count._all + premNow._count._all,
    };
  }

  /** Pul, tushumsiz: faol obunachi, 7 kunda tugaydigan, to'lov kutayotgan (obuna + Premium birga). */
  private async money(now: Date, in7: Date) {
    const [subscribers, expiring7, subPend, premPend] = await Promise.all([
      // Odam soni, qator soni emas: bir odamda telefon va vagon obunasi alohida qator bo'lishi mumkin
      this.prisma.subscription.findMany({ where: { status: 'ACTIVE', endsAt: { gt: now } }, select: { userId: true }, distinct: ['userId'] }),
      this.prisma.subscription.count({ where: { status: 'ACTIVE', endsAt: { gt: now, lte: in7 } } }),
      this.prisma.subscription.aggregate({ where: { status: 'PENDING' }, _count: { _all: true }, _sum: { amountTiyin: true }, _min: { createdAt: true } }),
      this.prisma.premiumOrder.aggregate({ where: { status: 'PENDING' }, _count: { _all: true }, _sum: { amountTiyin: true }, _min: { createdAt: true } }),
    ]);
    const oldest = [subPend._min.createdAt, premPend._min.createdAt].filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
    return {
      activeSubscribers: subscribers.length,
      expiring7,
      pendingPay: {
        count: subPend._count._all + premPend._count._all,
        amountTiyin: Number(subPend._sum.amountTiyin ?? 0n) + Number(premPend._sum.amountTiyin ?? 0n),
        oldestAt: oldest,
      },
    };
  }

  /** O'sish: oxirgi 7 kun va oldingi 7 kun. Namuna qatorlar sanalmaydi: ular o'smaydi. */
  private async growth(now: Date) {
    const { last, prev } = growthPair(now);
    const pair = async (count: (w: { gte: Date; lt?: Date }) => Promise<number>) => {
      const [last7, prev7] = await Promise.all([count(last), count(prev)]);
      return { last7, prev7 };
    };
    const [users, listings, market, urgent, wagon] = await Promise.all([
      pair((w) => this.prisma.user.count({ where: { createdAt: w } })),
      pair((w) => this.prisma.listing.count({ where: { createdAt: w, isDemo: false } })),
      pair((w) => this.prisma.marketRequest.count({ where: { createdAt: w, isDemo: false } })),
      pair((w) => this.prisma.urgentRequest.count({ where: { createdAt: w } })),
      pair((w) => this.prisma.wagonSearch.count({ where: { createdAt: w } })),
    ]);
    return { users, listings, requests: { last7: market.last7 + urgent.last7, prev7: market.prev7 + urgent.prev7 }, wagon };
  }

  /** 30 kunlik to'rt qator, kunlar dayKeys bilan bir xil: tashrif, raqam ochish, vagon qidiruv, buyurtma. */
  private async series(now: Date) {
    const days = dayKeys(now);
    // Oyna boshi Toshkent kunining boshi: SQL dagi AT TIME ZONE bilan bir xil konvensiya
    const from = uzLocalToUtc(days[0]!, '00:00');
    const [visits, reveals, wagon, orders] = await Promise.all([
      this.impressions.visits(now),
      countByDay(this.prisma, 'AuditLog', from, Prisma.sql`AND "action" IN (${Prisma.join([...REVEAL_ACTIONS])})`),
      countByDay(this.prisma, 'WagonSearch', from),
      countByDay(this.prisma, 'Order', from),
    ]);
    return {
      days,
      visits: fillSeries(new Map(visits.days.map((d) => [d.day, d.count])), days),
      reveals: fillSeries(reveals, days),
      wagon: fillSeries(wagon, days),
      orders: fillSeries(orders, days),
    };
  }

  /**
   * Komissiya chegarasi: va'da bo'yicha komissiya faqat oyiga N ta bajarilgan buyurtmadan
   * oshgach kiritiladi va kamida 30 kun oldin e'lon qilinadi. Demak ega chegaraga YETGUNCHA
   * qaror qilishi kerak; shu ikki son aynan shu qaror uchun.
   */
  private async commission() {
    const { start, prevStart } = monthWindow();
    // status DONE shart: closedAt rad etilgan, bekor qilingan va muddati o'tgan
    // buyurtmaga ham yoziladi, ular esa chegaraga sanalmasligi kerak
    const [cfg, thisMonth, prevMonth] = await Promise.all([
      this.config.get(),
      this.prisma.order.count({ where: { status: 'DONE', closedAt: { gte: start } } }),
      this.prisma.order.count({ where: { status: 'DONE', closedAt: { gte: prevStart, lt: start } } }),
    ]);
    return { thisMonth, prevMonth, threshold: cfg.commissionThresholdOrders };
  }

  private async reveals(now: Date) {
    const from = new Date(now.getTime() - 30 * DAY);
    // ponytail: guruhlash bazada, qo'shish xotirada; oyiga minglab ochuvchi
    // bo'lsa bitta SQL ga (COUNT ... FILTER) ko'chiriladi
    const by = await this.prisma.auditLog.groupBy({
      by: ['actorId'],
      where: { action: 'contact.reveal', createdAt: { gte: from }, actorId: { not: null } },
      _count: { _all: true },
    });
    const ids = by.map((r) => r.actorId!).filter(Boolean);
    const [subs, cfg, wallRows] = await Promise.all([
      ids.length
        ? this.prisma.subscription.findMany({ where: { userId: { in: ids }, status: 'ACTIVE', endsAt: { gt: now } }, select: { userId: true }, distinct: ['userId'] })
        : Promise.resolve([] as { userId: string }[]),
      this.config.get(),
      /*
       * Konversiyaning MAXRAJI: to'lov devorida to'xtab ketgan odam. Yuqoridagi to'rt
       * son faqat suratni beradi, ya'ni "narxni tushiraymi yoki bepul oynani
       * kengaytiraymi" degan savolga javob chiqmasdi.
       *
       * Qator serverda, 402 tashlanadigan joyda, bir odam uchun kuniga bir marta
       * yoziladi (contacts.controller.ts va wagon.controller.ts), ya'ni bu son ham
       * yuqoridagi "odam ochdi" kabi ODAM sanog'i.
       *
       * Impression.day kun aniqligida saqlanadi: chegara kun boshiga tushiriladi, aks
       * holda eng chekka kun yarmi tushib qolardi.
       */
      this.prisma.impression.groupBy({
        by: ['targetId'],
        where: { kind: 'wall', day: { gte: new Date(from.toISOString().slice(0, 10)) } },
        _sum: { count: true },
      }),
    ]);
    const walls = { phone: 0, wagon: 0 };
    for (const w of wallRows) if (w.targetId === 'phone' || w.targetId === 'wagon') walls[w.targetId] = w._sum.count ?? 0;
    // freeTotal sonlar YONIDA: qaror "N ni oshiraymi" degan savol, hozirgi N
    // ko'rinmasa to'rt son bilan javob berib bo'lmaydi
    return { ...revealFunnel(by, new Set(subs.map((sb) => sb.userId))), freeTotal: cfg.phoneRevealFree, walls };
  }

  private async pingDb(): Promise<{ ok: boolean; ms?: number }> {
    const t = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, ms: Date.now() - t };
    } catch {
      return { ok: false };
    }
  }
}
