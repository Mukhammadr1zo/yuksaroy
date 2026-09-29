import { BadRequestException, Body, Controller, Get, Logger, Put, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsObject } from 'class-validator';
import { PLATFORM_DEFAULTS, type PlatformConfigKey, uzLocalToUtc } from '@yuksaroy/domain';
import { AuditService } from '../../common/audit.service';
import { PlatformConfigService } from '../../common/platform-config.service';
import { QUEUE_KEYS, queueStats, type QueueKey } from '../../common/admin-queues';
import { ImpressionsService } from '../impressions/impressions.service';
import { PrismaService } from '../../common/prisma.service';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { PlatformAdminGuard } from '../organizations/presentation/platform-admin.guard';
import { PlatformOwnerGuard } from '../organizations/presentation/platform-owner.guard';
import { monthWindow, monthlyRevenue } from './revenue';

class SettingsDto {
  // { commissionPct: 300, commissionPayer: 'CLIENT' } - faqat o'zgartiriladigan kalitlar
  @IsObject() values!: Record<string, string | number>;
}

const DEFAULTS = PLATFORM_DEFAULTS as unknown as Record<string, string | number>;
const posInt = (v: unknown) => Number.isInteger(v) && (v as number) > 0;

/** Har bir kalitning o'z qoidasi: tur mos kelgani yetarli emas (masalan -5 daqiqa). */
const CHECK: Record<PlatformConfigKey, (v: unknown) => boolean> = {
  commissionPct: (v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 10000, // bazis punkt: 300 = 3,00 %
  commissionPayer: (v) => v === 'TERMINAL' || v === 'CLIENT',
  commissionThresholdOrders: posInt, // 0 chegara ma'nosiz: komissiya birinchi kundanoq kerak bo'lib qolardi
  slotHoldTtlMin: posInt,
  terminalConfirmMin: posInt,
  // Obuna narxi va kunlik raqam soni sozlamada emas, tarifda (admin/plans)
  phoneRevealFree: (v) => Number.isInteger(v) && (v as number) >= 0, // 0 = bepul raqam yo'q (sukut)
  wagonSearchFree: (v) => Number.isInteger(v) && (v as number) >= 0, // 0 = bepul urinish yo'q
  helpAskDaily: posInt,
  // Rekvizit: bo'sh saqlanmaydi (bo'shatish uchun qator o'chiriladi), 500 belgi yetarli
  payDetails: (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 500,
};

/**
 * Voronka: guruhlangan qatorlardan to'rtta son.
 *
 * "Obunachi" HOZIR faol obunasi borlar: ochilish paytidagi holat audit qatorida yo'q.
 * Bu 30 kunlik tendensiya uchun yetarli, hisob-kitob uchun emas.
 */
export function revealFunnel(by: readonly { actorId: string | null; _count: { _all: number } }[], paid: ReadonlySet<string>) {
  let reveals = 0;
  let freeReveals = 0;
  let subscribers = 0;
  for (const r of by) {
    reveals += r._count._all;
    if (r.actorId && paid.has(r.actorId)) subscribers += 1;
    else freeReveals += r._count._all;
  }
  return { people: by.length, reveals, subscribers, freeReveals };
}

/**
 * Audit filtridagi sana. Faqat kun berilsa (YYYY-MM-DD) u TOSHKENT kuni deb olinadi.
 *
 * Ilgari `new Date('2026-09-16')` ishlatilardi va JS uni UTC yarim tuni deb o'qirdi.
 * Sahifadagi vaqtlar esa Toshkent bo'yicha chiziladi, ya'ni "16-kun" so'ralganda
 * mahalliy 00:00 dan 05:00 gacha bo'lgan amallar tushib qolar, o'rniga 17-kunning
 * birinchi besh soati qo'shilib ketardi. Farq besh soat, jimgina.
 */
function parseDate(s: string | undefined, endOfDay = false): Date | undefined {
  if (!s) return undefined;
  const day = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const at = uzLocalToUtc(day, '00:00');
    // `to` uchun kunning oxiri: keyingi kun boshigacha, aks holda o'sha kun tushib qolardi
    return endOfDay ? new Date(at.getTime() + 24 * 60 * 60_000) : at;
  }
  const d = new Date(day);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Platforma egasi uchun tizim ekrani: audit izi, sozlamalar va salomatlik.
 *
 * Audit ilgari faqat yozilardi - hech kim o'qiy olmasdi. Sozlamalarni o'zgartirish uchun
 * to'g'ridan-to'g'ri bazaga kirish kerak edi. Ikkalasi ham shu yerda yopiladi.
 */
@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtGuard, PlatformAdminGuard)
@ApiCookieAuth('ys_access')
export class AdminSystemController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: PlatformConfigService,
    private readonly impressions: ImpressionsService,
  ) {}

  /**
   * Tashriflar: oxirgi 30 kun, kunlar qatori hamda viloyat va davlat kesimi.
   *
   * Joy IP dan aniqlanadi. O'zbekiston ichida bu ishonchsiz: mobil operatorlar va
   * Uztelecom trafikni Toshkentdagi manzil bloklaridan chiqaradi, ya'ni viloyat
   * kesimi haqiqiy taqsimotdan ko'ra Toshkentga og'adi. Davlat darajasi ishonchli.
   */
  @Get('visits')
  visits() {
    return this.impressions.visits();
  }

  /**
   * Oylik tushum: obuna va Premium to'lovlari, tasdiqlangan sana (paidAt) bo'yicha, 12 oy.
   * paidAt faqat tasdiqda to'ldiriladi, ya'ni bu yerga to'lanmagan buyurtma tushmaydi.
   */
  @Get('revenue')
  @UseGuards(PlatformOwnerGuard)
  async revenue() {
    // 400 kun: 12 to'liq oy chetidan chiqmasin, ortiqchasini monthlyRevenue kesadi.
    // orderBy majburiy: chegara ishga tushsa eng ESKI qatorlar tushib qolsin, aks holda
    // varaqdagi oxirgi oylar jimgina kam ko'rinib, hisob ko'chirmaga to'g'ri kelmasdi
    const gte = new Date(Date.now() - 400 * 86_400_000);
    const [subs, prems] = await Promise.all([
      this.prisma.subscription.findMany({ where: { paidAt: { gte } }, select: { paidAt: true, startsAt: true, amountTiyin: true }, orderBy: { paidAt: 'desc' }, take: 5000 }),
      this.prisma.premiumOrder.findMany({ where: { paidAt: { gte } }, select: { paidAt: true, amountTiyin: true }, orderBy: { paidAt: 'desc' }, take: 5000 }),
    ]);
    return { months: monthlyRevenue(subs, prems) };
  }

  /** Audit izi: kim, nima, qachon. `action` prefiks bo'yicha ("admin." barcha admin amallarini beradi). */
  @Get('audit')
  async auditList(
    @Query('actor') actor?: string,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const take = Math.min(200, Math.max(1, Number(limit) || 50));
    const gte = parseDate(from);
    const lte = parseDate(to, true);
    /*
     * "Kim" maydoni. Ilgari bu faqat aniq User.id ga tenglik edi, lekin id ni panelning
     * hech bir ekrani ko'rsatmaydi: operator uni yozib qo'ya olmasdi va filtr amalda
     * ishlamasdi. Endi id ga o'xshamagan matn telefon, ism va pochta bo'yicha
     * qidiriladi. Hech kim topilmasa ataylab bo'sh natija qaytadi, aks holda filtr
     * e'tiborsiz qolib, butun jurnal ko'rsatilardi.
     */
    const actorText = actor?.trim();
    let actorIds: string[] | null = null;
    if (actorText && !/^c[a-z0-9]{20,}$/.test(actorText)) {
      const like = { contains: actorText, mode: 'insensitive' as const };
      const found = await this.prisma.user.findMany({
        where: { OR: [{ phone: like }, { fullName: like }, { email: like }] },
        select: { id: true },
        take: 50,
      });
      actorIds = found.map((u) => u.id);
    }
    const where = {
      ...(actorIds ? { actorId: { in: actorIds } } : actorText ? { actorId: actorText } : {}),
      ...(entity ? { entity } : {}),
      ...(entityId ? { entityId } : {}),
      ...(action ? { action: { startsWith: action } } : {}),
      ...(gte || lte ? { createdAt: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (p - 1) * take, take }),
    ]);
    // AuditLog da User ga relation yo'q (o'chirilgan hisob izini uzmaslik uchun): ismlarni alohida so'rov bilan olamiz
    const ids = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => !!x))];
    const users = ids.length
      ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, phone: true, fullName: true } })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    return {
      items: rows.map((r) => ({ ...r, actor: (r.actorId && byId.get(r.actorId)) || null })),
      total,
      page: p,
      limit: take,
    };
  }

  /** Filtr ro'yxati uchun: mavjud action lar va har birining soni. */
  @Get('audit/actions')
  async auditActions() {
    const rows = await this.prisma.auditLog.groupBy({ by: ['action'], _count: true });
    return rows
      .map((r) => ({ action: r.action, count: r._count as unknown as number }))
      .sort((a, b) => b.count - a.count);
  }

  /** Barcha kalitlar: saqlangani bo'lsa u, bo'lmasa default (UI "default: 0" deb ko'rsatsin). */
  @Get('settings')
  async settings() {
    const rows = await this.prisma.platformConfig.findMany();
    const byKey = new Map(rows.map((r) => [r.key, r]));
    return {
      items: (Object.keys(DEFAULTS) as PlatformConfigKey[]).map((key) => {
        const row = byKey.get(key);
        return {
          key,
          value: row ? (row.value as string | number) : DEFAULTS[key],
          default: DEFAULTS[key],
          isDefault: !row,
          updatedAt: row?.updatedAt ?? null,
        };
      }),
    };
  }

  /** Sozlamani yangilash: noma'lum kalit yoki noto'g'ri qiymat 400. Audit ga faqat haqiqatan o'zgargani tushadi. */
  // Komissiya foizi va muddatlar: platformaning pul qoidasi, faqat ega o'zgartiradi
  @Put('settings')
  @UseGuards(PlatformOwnerGuard)
  async updateSettings(@CurrentUserId() userId: string, @Body() dto: SettingsDto) {
    const entries = Object.entries(dto.values ?? {});
    for (const [key, value] of entries) {
      if (!(key in DEFAULTS)) throw new BadRequestException({ code: 'UNKNOWN_KEY', key });
      if (typeof value !== typeof DEFAULTS[key]) throw new BadRequestException({ code: 'BAD_VALUE', key });
      if (!CHECK[key as PlatformConfigKey](value)) throw new BadRequestException({ code: 'BAD_VALUE', key });
    }
    const keys = entries.map(([k]) => k);
    const current = await this.prisma.platformConfig.findMany({ where: { key: { in: keys } } });
    const cur = new Map(current.map((r) => [r.key, r.value as string | number]));
    const changed: Record<string, { from: string | number; to: string | number }> = {};
    for (const [key, value] of entries) {
      const before = cur.has(key) ? (cur.get(key) as string | number) : DEFAULTS[key];
      if (before !== value) changed[key] = { from: before, to: value };
    }
    await this.prisma.$transaction(
      entries.map(([key, value]) =>
        this.prisma.platformConfig.upsert({ where: { key }, create: { key, value }, update: { value } }),
      ),
    );
    // Bo'sh o'zgarish audit ni shovqinga to'ldirmasin
    if (Object.keys(changed).length) {
      await this.audit.log({ actorId: userId, action: 'admin.settings.update', entity: 'PlatformConfig', meta: { changed } });
    }
    this.config.invalidate(); // 60 s kesh: yangi qiymat darhol kuchga kirsin
    return this.settings();
  }

  /** Bitta ekran: baza tirikmi, qancha ish odam kutyapti, sutkada nima bo'ldi. */
  /**
   * Bosh sahifa uchun: navbatlar, oxirgi sutka va baza holati.
   *
   * Har so'rov ALOHIDA bajariladi. Ilgari hammasi bitta Promise.all da edi va bittasi
   * yiqilsa butun javob 500 bo'lardi: panelda "Ma'lumot yuklanmadi" chiqar, qaysi qismi
   * ishlamayotgani esa umuman ko'rinmasdi. Endi ishlaganlari ko'rsatiladi, yiqilganlari
   * null bo'lib qoladi va `failed` ro'yxatida nomi bilan qaytadi.
   */
  @Get('health')
  async health(@Query('full') full?: string) {
    // Navbat yoshi faqat bosh sahifaga kerak, u esa bir marta ochiladi. Panelning
    // qolgan ekranlari har o'tishda shu yo'lni qayta so'raydi va ulardan faqat
    // sonlar o'qiladi, ya'ni yetti qo'shimcha so'rov behuda bo'lardi.
    const withAge = full === '1';
    const since = new Date(Date.now() - 86400000);
    const failed: string[] = [];
    const safe = async <T>(name: string, fn: () => Promise<T>): Promise<T | null> => {
      try {
        return await fn();
      } catch (e) {
        failed.push(name);
        this.log.error(`admin/health: ${name} yiqildi: ${(e as Error).message.split(String.fromCharCode(10)).pop()}`);
        return null;
      }
    };

    // Komissiya chegarasi: va'da bo'yicha komissiya faqat oyiga N ta bajarilgan
    // buyurtmadan oshgach kiritiladi va kamida 30 kun oldin e'lon qilinadi. Demak ega
    // chegaraga YETGUNCHA qaror qilishi kerak; shu ikki son aynan shu qaror uchun.
    const [db, queues, users, orders, listings, commission, reveals] = await Promise.all([
      this.pingDb(),
      safe('queues', () => queueStats(this.prisma, withAge)),
      safe('recentUsers', () => this.prisma.user.count({ where: { createdAt: { gte: since } } })),
      safe('recentOrders', () => this.prisma.order.count({ where: { createdAt: { gte: since } } })),
      safe('recentListings', () => this.prisma.listing.count({ where: { createdAt: { gte: since } } })),
      withAge
        ? safe('commission', async () => {
            const { start, prevStart } = monthWindow();
            // status DONE shart: closedAt rad etilgan, bekor qilingan va muddati o'tgan
            // buyurtmaga ham yoziladi, ular esa chegaraga sanalmasligi kerak
            const [cfg, thisMonth, prevMonth] = await Promise.all([
              this.config.get(),
              this.prisma.order.count({ where: { status: 'DONE', closedAt: { gte: start } } }),
              this.prisma.order.count({ where: { status: 'DONE', closedAt: { gte: prevStart, lt: start } } }),
            ]);
            return { thisMonth, prevMonth, threshold: cfg.commissionThresholdOrders };
          })
        : null,
      withAge
        ? safe('reveals', async () => {
            const from = new Date(Date.now() - 30 * 86_400_000);
            // ponytail: guruhlash bazada, qo'shish xotirada; oyiga minglab ochuvchi
            // bo'lsa bitta SQL ga (COUNT ... FILTER) ko'chiriladi
            const by = await this.prisma.auditLog.groupBy({
              by: ['actorId'],
              where: { action: 'contact.reveal', createdAt: { gte: from }, actorId: { not: null } },
              _count: { _all: true },
            });
            const ids = by.map((r) => r.actorId!).filter(Boolean);
            const [subs, cfg] = await Promise.all([
              ids.length
                ? this.prisma.subscription.findMany({ where: { userId: { in: ids }, status: 'ACTIVE', endsAt: { gt: new Date() } }, select: { userId: true }, distinct: ['userId'] })
                : Promise.resolve([] as { userId: string }[]),
              this.config.get(),
            ]);
            // freeTotal sonlar YONIDA: qaror "N ni oshiraymi" degan savol, hozirgi N
            // ko'rinmasa to'rt son bilan javob berib bo'lmaydi
            return { ...revealFunnel(by, new Set(subs.map((sb) => sb.userId))), freeTotal: cfg.phoneRevealFree };
          })
        : null,
    ]);
    const count = (k: QueueKey) => queues?.[k].count ?? 0;
    return {
      db,
      counts: {
        listingsPendingReview: count('listingsPendingReview'),
        orgsPendingKyc: count('orgsPendingKyc'),
        terminalClaimsPending: count('terminalClaimsPending'),
        premiumPending: count('premiumPending'),
        subscriptionPending: count('subscriptionPending'),
        ordersPending: count('ordersPending'),
        urgentOpen: count('urgentOpen'),
        contactNew: count('contactNew'),
        reportsNew: count('reportsNew'),
      },
      recent: { users: users ?? 0, orders: orders ?? 0, listings: listings ?? 0 },
      // Har navbatning eng eskisi: faqat ?full=1 bilan, ya'ni faqat bosh sahifaga
      oldest: withAge && queues
        ? Object.fromEntries(QUEUE_KEYS.map((k) => [k, queues[k].oldest])) as Record<QueueKey, Date | null>
        : undefined,
      // Uch oylik tarix ataylab yo'q: qaror ikkita songa qaraydi
      // ponytail: sana kaliti va tashkilot kesimi keyinroq, chegara yarmiga yetganda
      commission: commission ?? undefined,
      // Raqam ochish voronkasi, 30 kun. Bepul oyna o'chiq ekan brauzer kartani chizmaydi.
      reveals: reveals ?? undefined,
      failed, // bo'sh bo'lsa hammasi joyida
    };
  }

  private readonly log = new Logger('AdminHealth');

  private async pingDb(): Promise<{ ok: boolean; ms?: number; error?: string }> {
    const t = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, ms: Date.now() - t };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}
