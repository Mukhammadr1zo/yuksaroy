import { BadRequestException, Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsObject } from 'class-validator';
import { PLATFORM_DEFAULTS, type PlatformConfigKey } from '@yuksaroy/domain';
import { AuditService } from '../../common/audit.service';
import { PlatformConfigService } from '../../common/platform-config.service';
import { PrismaService } from '../../common/prisma.service';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { PlatformAdminGuard } from '../organizations/presentation/platform-admin.guard';

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
  slotHoldTtlMin: posInt,
  terminalConfirmMin: posInt,
  docSlaHours: posInt,
};

/** ISO sana. `to` da faqat kun berilsa (YYYY-MM-DD) kunning oxirigacha olamiz, aks holda o'sha kun tushib qolardi. */
function parseDate(s: string | undefined, endOfDay = false): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(s.trim())) d.setUTCDate(d.getUTCDate() + 1);
  return d;
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
  ) {}

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
    const where = {
      ...(actor ? { actorId: actor } : {}),
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
  @Put('settings')
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
  @Get('health')
  async health() {
    const since = new Date(Date.now() - 86400000);
    const [db, listingsPendingReview, orgsPendingKyc, terminalClaimsPending, premiumPending, ordersPending, users, orders, listings, oldest] =
      await Promise.all([
        this.pingDb(),
        this.prisma.listing.count({ where: { status: 'PENDING_REVIEW' } }),
        this.prisma.organization.count({ where: { kycStatus: 'PENDING' } }),
        this.prisma.terminal.count({ where: { claimStatus: 'PENDING' } }),
        this.prisma.premiumOrder.count({ where: { status: 'PENDING' } }), // PremiumOrder.status - String
        this.prisma.order.count({ where: { status: 'PENDING' } }),
        this.prisma.user.count({ where: { createdAt: { gte: since } } }),
        this.prisma.order.count({ where: { createdAt: { gte: since } } }),
        this.prisma.listing.count({ where: { createdAt: { gte: since } } }),
        this.prisma.listing.findFirst({ where: { status: 'PENDING_REVIEW' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
      ]);
    return {
      db,
      counts: { listingsPendingReview, orgsPendingKyc, terminalClaimsPending, premiumPending, ordersPending },
      recent: { users, orders, listings },
      oldestPending: oldest?.createdAt ?? null, // SLA signali: eng uzoq kutayotgan e'lon
    };
  }

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
