import { BadRequestException, Body, Controller, Get, Logger, Put, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsObject } from 'class-validator';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { PLATFORM_DEFAULTS, type PlatformConfigKey, uzLocalToUtc } from '@yuksaroy/domain';
import { AuditService } from '../../common/audit.service';
import { env } from '../../common/env';
import { PlatformConfigService } from '../../common/platform-config.service';
import { QUEUE_KEYS, queueStats, type QueueKey } from '../../common/admin-queues';
import { recentErrors, runtime } from '../../common/runtime';
import { ImpressionsService } from '../impressions/impressions.service';
import { PrismaService } from '../../common/prisma.service';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { UPLOADS_DIR } from '../listings/presentation/uploads.controller';
import { PlatformAdminGuard } from '../organizations/presentation/platform-admin.guard';
import { PlatformOwnerGuard } from '../organizations/presentation/platform-owner.guard';
import { isWagonConfigured } from '../wagon/d-railway.client';

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

type UploadsInfo = { files: number; bytes: number; scannedAt: Date; capped: boolean; disk: { freeBytes: number; totalBytes: number } | null };
const UPLOADS_TTL_MS = 600_000;
const UPLOADS_CAP = 100_000;
let uploadsCache: { at: number; value: UploadsInfo } | null = null;

/**
 * Yuklamalar hajmi: butun papka o'qiladi, 10 daqiqa keshlanadi (modul darajasida: kontroller
 * so'rovga yaratilmaydi, lekin kesh bitta bo'lsin). 100 000 faylda to'xtaydi (capped): undan
 * ko'p bo'lsa son taxminiy, so'rov esa soniyalarga cho'zilmaydi. Disk bo'sh joyi statfs dan;
 * Windows dev da yiqilsa null va sahifa qatorni chizmaydi.
 */
async function uploadsInfo(now: Date): Promise<UploadsInfo> {
  if (uploadsCache && now.getTime() - uploadsCache.at < UPLOADS_TTL_MS) return uploadsCache.value;
  let files = 0, bytes = 0, capped = false;
  for (const e of await fs.readdir(UPLOADS_DIR, { recursive: true, withFileTypes: true })) {
    if (!e.isFile()) continue;
    if (files >= UPLOADS_CAP) { capped = true; break; }
    const st = await fs.stat(join(e.parentPath, e.name)).catch(() => null);
    if (!st) continue; // skan paytida o'chgan fayl
    files++;
    bytes += st.size;
  }
  let disk: UploadsInfo['disk'] = null;
  try {
    const s = await fs.statfs(UPLOADS_DIR);
    disk = { freeBytes: s.bavail * s.bsize, totalBytes: s.blocks * s.bsize };
  } catch { /* statfs yo'q (Windows dev): qator chizilmaydi */ }
  const value = { files, bytes, scannedAt: now, capped, disk };
  uploadsCache = { at: now.getTime(), value };
  return value;
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

  /**
   * Qobiq uchun: baza tirikmi, navbatlarda nechta ish bor, sutkada nima bo'ldi.
   *
   * Panel har o'tishda shu yo'lni so'raydi (menyu badge), shuning uchun faqat sonlar:
   * navbat yoshi, komissiya va voronka /admin/home da, u bir marta ochiladi.
   *
   * Har so'rov ALOHIDA bajariladi. Ilgari hammasi bitta Promise.all da edi va bittasi
   * yiqilsa butun javob 500 bo'lardi: panelda "Ma'lumot yuklanmadi" chiqar, qaysi qismi
   * ishlamayotgani esa umuman ko'rinmasdi. Endi ishlaganlari ko'rsatiladi, yiqilganlari
   * null bo'lib qoladi va `failed` ro'yxatida nomi bilan qaytadi.
   */
  @Get('health')
  async health() {
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

    const [db, queues, users, orders, listings] = await Promise.all([
      this.pingDb(),
      safe('queues', () => queueStats(this.prisma, false)),
      safe('recentUsers', () => this.prisma.user.count({ where: { createdAt: { gte: since } } })),
      safe('recentOrders', () => this.prisma.order.count({ where: { createdAt: { gte: since } } })),
      safe('recentListings', () => this.prisma.listing.count({ where: { createdAt: { gte: since } } })),
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
      failed, // bo'sh bo'lsa hammasi joyida
    };
  }

  /**
   * Tizim holati, faqat ega: versiya, baza, vagon manbasi, navbatlar, kunlik sikl, xatolar,
   * Telegram, reklama va tarif, yuklamalar. Har blok safe() bilan (health uslubi): bittasi
   * yiqilsa qolgani ko'rinadi, yiqilgani failed[] da. Xatolar, kunlik sikl va Telegram belgisi
   * jarayon xotirasidan (runtime.ts): restartda tozalanadi, sahifa "ishga tushgandan beri" deydi.
   */
  @Get('system')
  @UseGuards(PlatformOwnerGuard)
  async system() {
    const now = new Date();
    const failed: string[] = [];
    const safe = async <T>(name: string, fn: () => Promise<T>): Promise<T | null> => {
      try {
        return await fn();
      } catch (e) {
        failed.push(name);
        this.log.error(`admin/system: ${name} yiqildi: ${(e as Error).message.split(String.fromCharCode(10)).pop()}`);
        return null;
      }
    };
    const h24 = new Date(now.getTime() - 86_400_000);
    const d7 = new Date(now.getTime() - 7 * 86_400_000);
    const in7 = new Date(now.getTime() + 7 * 86_400_000);
    const [db, sizeMb, wagon, queues, ads, plans, uploads] = await Promise.all([
      this.pingDb(),
      safe('dbSize', async () => {
        const [r] = await this.prisma.$queryRaw<{ b: bigint }[]>`SELECT pg_database_size(current_database())::bigint b`;
        return Math.round(Number(r.b) / 1048576);
      }),
      // Bitta raw SQL: 7 kunlik oyna, 24 soat FILTER bilan. meta.error faqat xato qatorida bor
      // (muvaffaqiyat qatorida kalit yo'q), Prisma NOT + JSON path NULL tufayli uni tashlab
      // yuborardi; coalesce(...,false) ikkalasini ham to'g'ri sanaydi. lastOk 7 kun oynasida:
      // null = "7 kunda muvaffaqiyat yo'q". [action, createdAt] indeksi.
      safe('wagon', async () => {
        const [r] = await this.prisma.$queryRaw<{ t24: bigint; e24: bigint; t7: bigint; e7: bigint; lastOk: Date | null; lastErr: Date | null }[]>`
          SELECT count(*) FILTER (WHERE "createdAt" >= ${h24}) t24,
                 count(*) FILTER (WHERE "createdAt" >= ${h24} AND coalesce((meta->>'error')::boolean, false)) e24,
                 count(*) t7,
                 count(*) FILTER (WHERE coalesce((meta->>'error')::boolean, false)) e7,
                 max("createdAt") FILTER (WHERE NOT coalesce((meta->>'error')::boolean, false)) "lastOk",
                 max("createdAt") FILTER (WHERE coalesce((meta->>'error')::boolean, false)) "lastErr"
          FROM "AuditLog" WHERE action = 'wagon.search' AND "createdAt" >= ${d7}`;
        return {
          configured: isWagonConfigured(),
          h24: { total: Number(r.t24), errors: Number(r.e24) },
          d7: { total: Number(r.t7), errors: Number(r.e7) },
          lastOkAt: r.lastOk, lastErrorAt: r.lastErr,
        };
      }),
      safe('queues', async () => {
        const st = await queueStats(this.prisma, true);
        return QUEUE_KEYS.map((key) => ({ key, count: st[key].count, oldestAt: st[key].oldest }));
      }),
      safe('ads', async () => {
        const [active, expired, ending7, draft] = await Promise.all([
          this.prisma.adPlacement.count({ where: { status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gte: now } } }),
          this.prisma.adPlacement.count({ where: { status: 'ACTIVE', endsAt: { lt: now } } }),
          this.prisma.adPlacement.count({ where: { status: 'ACTIVE', endsAt: { gte: now, lte: in7 } } }),
          this.prisma.adPlacement.count({ where: { status: 'DRAFT' } }),
        ]);
        return { active, expired, ending7, draft };
      }),
      // Telefon ochadigan faol tarif nol bo'lsa hech kim obuna sotib ololmaydi
      safe('plans', async () => {
        const [active, phoneActive] = await Promise.all([
          this.prisma.plan.count({ where: { active: true } }),
          this.prisma.plan.count({ where: { active: true, grants: { has: 'PHONE' } } }),
        ]);
        return { active, phoneActive };
      }),
      safe('uploads', () => uploadsInfo(now)),
    ]);
    return {
      // Obraz yoshi = ishga tushgan vaqt ("deploy" emas: restart ham nolga qaytaradi)
      api: { sha: env.GIT_SHA ?? null, startedAt: runtime.startedAt, uptimeSec: Math.round(process.uptime()), rssMb: Math.round(process.memoryUsage().rss / 1048576) },
      db: db.ok ? { ok: true, ms: db.ms, ...(sizeMb == null ? {} : { sizeMb }) } : { ok: false },
      wagon,
      queues,
      daily: runtime.daily,
      errors: recentErrors(),
      telegram: runtime.telegram,
      ads,
      plans,
      uploads,
      failed,
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
