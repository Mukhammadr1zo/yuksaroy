import { ConflictException, Controller, Get, HttpCode, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { MARKET, MARKET_BOARDS, SERVICE_TYPES } from '@yuksaroy/domain';
import { AuditService } from '../../common/audit.service';
import { PrismaService } from '../../common/prisma.service';
import { clampInt } from '../catalog/presentation/catalog.controller';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { PlatformAdminGuard } from '../organizations/presentation/platform-admin.guard';
import { marketStatus } from './market.controller';
import { canMarketTransition } from './market.rules';
import { offerView, requestView } from './market.service';
import { profileView } from './services.controller';

const INCLUDE = { user: { select: { fullName: true } }, org: { select: { name: true, slug: true, kycStatus: true } } } as const;

/** Platforma egasi: bozor so'rovlari va xizmat profillarini ko'rish, kerak bo'lsa yashirish. Har amal auditda. */
@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtGuard, PlatformAdminGuard)
@ApiCookieAuth('ys_access')
export class AdminMarketController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get('market/requests')
  async requests(@Query('board') board?: string, @Query('status') status?: string, @Query('page') page?: string, @Query('limit') lim?: string) {
    const p = clampInt(page, 1, 1, 10_000);
    const take = clampInt(lim, 30, 1, MARKET.listTake);
    const where = { ...(board && (MARKET_BOARDS as readonly string[]).includes(board) ? { board } : {}), ...(marketStatus(status) ? { status } : {}) };
    const [total, rows] = await Promise.all([
      this.prisma.marketRequest.count({ where }),
      this.prisma.marketRequest.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (p - 1) * take, take, include: { offers: { orderBy: { createdAt: 'asc' } }, createdBy: { select: { fullName: true } } } }),
    ]);
    // Admin egasining telefonini ko'radi: shikoyat bo'lsa bog'lanish uchun
    return { items: rows.map(({ offers, createdBy, ...r }) => ({ ...requestView(r, offers.length, true), createdBy: createdBy.fullName, offers: offers.map((o) => offerView(o)) })), total, page: p, limit: take };
  }

  /**
   * Yashirish = bekor qilish: MarketRequest da alohida HIDDEN holati yo'q, CANCELLED ro'yxatdan tushadi.
   * Faqat OPEN dan (holat jadvali): tanlangan yoki yopilgan so'rov qayta yozilmaydi, yozuv o'qilgan holatga shartlangan.
   */
  @Post('market/requests/:id/hide') @HttpCode(200)
  async hideRequest(@CurrentUserId() adminId: string, @Param('id') id: string) {
    const r = await this.prisma.marketRequest.findUnique({ where: { id }, select: { status: true } });
    if (!r) throw new NotFoundException({ code: 'REQUEST_NOT_FOUND' });
    if (!canMarketTransition(r.status, 'CANCELLED')) throw new ConflictException({ code: 'MARKET_TRANSITION', from: r.status, to: 'CANCELLED' });
    const { count } = await this.prisma.marketRequest.updateMany({ where: { id, status: 'OPEN' }, data: { status: 'CANCELLED' } });
    if (!count) throw new ConflictException({ code: 'MARKET_TRANSITION', from: r.status, to: 'CANCELLED' });
    await this.audit.log({ actorId: adminId, action: 'admin.market.hide', entity: 'MarketRequest', entityId: id, meta: { from: r.status } });
    return { ok: true };
  }

  @Get('services/profiles')
  async profiles(@Query('type') type?: string, @Query('status') status?: string, @Query('page') page?: string, @Query('limit') lim?: string) {
    const p = clampInt(page, 1, 1, 10_000);
    const take = clampInt(lim, 30, 1, MARKET.listTake);
    const where = { ...(type && (SERVICE_TYPES as readonly string[]).includes(type) ? { serviceType: type } : {}), ...(status === 'ACTIVE' || status === 'HIDDEN' || status === 'BLOCKED' ? { status } : {}) };
    const [total, rows] = await Promise.all([
      this.prisma.serviceProfile.count({ where }),
      this.prisma.serviceProfile.findMany({ where, include: INCLUDE, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (p - 1) * take, take }),
    ]);
    return { items: rows.map((r) => profileView(r, true, true)), total, page: p, limit: take };
  }

  /** Admin yashirgani BLOCKED: egasining HIDDEN idan farqli, egasi PATCH bilan qayta ocha olmaydi. */
  @Post('services/profiles/:id/hide') @HttpCode(200)
  async hideProfile(@CurrentUserId() adminId: string, @Param('id') id: string) {
    const r = await this.prisma.serviceProfile.findUnique({ where: { id }, select: { id: true } });
    if (!r) throw new NotFoundException({ code: 'PROFILE_NOT_FOUND' });
    await this.prisma.serviceProfile.update({ where: { id }, data: { status: 'BLOCKED' } });
    await this.audit.log({ actorId: adminId, action: 'admin.service.profile.hide', entity: 'ServiceProfile', entityId: id });
    return { ok: true };
  }
}
