import { Body, Controller, ConflictException, Get, HttpCode, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AuditService } from '../../common/audit.service';
import { PrismaService } from '../../common/prisma.service';
import { notifyBoth } from '../../common/telegram';
import { NotificationsService } from '../notifications/notifications.service';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { ListingsUseCase } from '../listings/application/listings.usecase';
import { pickIn } from '../catalog/presentation/catalog.controller';
import { extendPremium } from './extend-premium';
import { PlatformAdminGuard } from '../organizations/presentation/platform-admin.guard';

class PremiumDto {
  @IsInt() @Min(1) @Max(12) months!: number;
}

/** Bekor qilish sababi majburiy: u auditga yoziladi va egasiga aytiladi. */
class CancelDto {
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

const STATUSES = ['PENDING', 'PAID', 'CANCELLED'] as const;

type OrderRow = { id: string; listingId: string; orgId: string | null; userId: string; months: number; amountTiyin: bigint; status: string; provider: string | null; paidAt: Date | null; createdAt: Date };
/** BigInt -> Number (JSON). */
const orderView = (o: OrderRow) => ({ ...o, amountTiyin: Number(o.amountTiyin) });

/**
 * Premium buyurtmalari tarixi. E'lonni alohida ko'tarish endi sotilmaydi: obuna
 * egasining barcha e'lonlarini ko'taradi (subscription.service.ts). Bu yerda faqat
 * eski, to'lanmagan buyurtmalarni admin yopishi uchun ro'yxat va amallar qoldi.
 */
@ApiTags('premium')
@ApiCookieAuth('ys_access')
@Controller()
@UseGuards(JwtGuard)
export class PremiumController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listings: ListingsUseCase,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Admin navbati: `status` (default PENDING), eski birinchi. */
  @Get('admin/premium')
  @UseGuards(PlatformAdminGuard)
  async list(@CurrentUserId() userId: string, @Query('status') status?: string) {
    const rows = await this.prisma.premiumOrder.findMany({
      where: { status: pickIn(status, STATUSES) ?? 'PENDING' },
      include: { listing: { select: { slug: true, title: true, premiumUntil: true, org: { select: { name: true } } } } },
      orderBy: { createdAt: 'asc' }, take: 200,
    });
    return rows.map(({ listing, ...o }) => ({ ...orderView(o), listing: { slug: listing.slug, title: listing.title, premiumUntil: listing.premiumUntil, orgName: listing.org?.name ?? null } }));
  }

  /** To'lov qo'lda tasdiqlandi: PAID + listing.premiumUntil = max(hozir, joriy) + oylar. */
  @Post('admin/premium/:id/confirm') @HttpCode(200)
  @UseGuards(PlatformAdminGuard)
  async confirm(@CurrentUserId() userId: string, @Param('id') id: string) {
    const now = new Date();
    const r = await this.prisma.$transaction(async (tx) => {
      const o = await tx.premiumOrder.findUnique({ where: { id }, include: { listing: { select: { premiumUntil: true, title: true } } } });
      if (!o) throw new NotFoundException({ code: 'PREMIUM_ORDER_NOT_FOUND' });
      if (o.status !== 'PENDING') throw new ConflictException({ code: 'PREMIUM_NOT_PENDING', status: o.status });
      const premiumUntil = extendPremium(o.listing.premiumUntil, o.months, now);
      await tx.listing.update({ where: { id: o.listingId }, data: { premiumUntil } });
      const paid = await tx.premiumOrder.update({ where: { id }, data: { status: 'PAID', paidAt: now, provider: o.provider ?? 'manual' } });
      return { order: orderView(paid), premiumUntil, title: o.listing.title };
    });
    await this.audit.log({ actorId: userId, action: 'premium.confirm', entity: 'PremiumOrder', entityId: id, meta: { listingId: r.order.listingId, months: r.order.months, premiumUntil: r.premiumUntil } });
    this.tell(r.order.userId, 'premiumActive', { title: r.title, until: r.premiumUntil.toISOString().slice(0, 10) });
    return r;
  }

  /**
   * To'lov kelmadi yoki buyurtma noto'g'ri: navbatdan chiqariladi.
   *
   * Ilgari faqat tasdiqlash bor edi. To'lamagan odamning buyurtmasi navbatda abadiy
   * qolib ketardi va operatorda ikki yo'l bo'lardi: pulsiz Premium berish yoki qatorni
   * umrbod ko'rib yurish. Premium muddati bu yerda uzaytirilmaydi, ya'ni e'lon
   * o'zgarishsiz qoladi.
   */
  @Post('admin/premium/:id/cancel') @HttpCode(200)
  @UseGuards(PlatformAdminGuard)
  async cancel(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: CancelDto) {
    const reason = dto?.reason?.trim();
    if (!reason) throw new BadRequestException({ code: 'REASON_REQUIRED' });
    const o = await this.prisma.premiumOrder.findUnique({ where: { id }, select: { status: true, listingId: true, months: true, userId: true, listing: { select: { title: true } } } });
    if (!o) throw new NotFoundException({ code: 'PREMIUM_ORDER_NOT_FOUND' });
    if (o.status !== 'PENDING') throw new ConflictException({ code: 'PREMIUM_NOT_PENDING', status: o.status });
    const row = await this.prisma.premiumOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
    await this.audit.log({ actorId: userId, action: 'premium.cancel', entity: 'PremiumOrder', entityId: id, meta: { listingId: o.listingId, months: o.months, reason } });
    this.tell(o.userId, 'premiumCancelled', { title: o.listing.title, reason });
    return orderView(row);
  }

  /** E'lon egasiga qaror xabari: kabinetdagi qo'ng'iroq va Telegram; to'lov oqimini to'xtatmaydi. */
  private tell(userId: string, kind: 'premiumActive' | 'premiumCancelled', vars: Record<string, string>) {
    void notifyBoth(this.prisma, this.notifications, {
      target: { userIds: [userId] },
      kind,
      inApp: 'premium',
      href: '/dashboard/listings',
      vars,
    }).catch(() => {});
  }
}
