import { Body, Controller, ConflictException, Get, HttpCode, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PRICING, premiumAmountTiyin } from '@yuksaroy/domain';
import { AuditService } from '../../common/audit.service';
import { PrismaService } from '../../common/prisma.service';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { ListingsUseCase } from '../listings/application/listings.usecase';
import { pickIn } from '../catalog/presentation/catalog.controller';
import { extendPremium } from './extend-premium';
import { payInstructions } from './pay-instructions';
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

/** Premium: egasi buyurtma beradi (PENDING), admin to'lovni tasdiqlaydi (PAID) va listing.premiumUntil uzayadi. */
@ApiTags('premium')
@ApiCookieAuth('ys_access')
@Controller()
@UseGuards(JwtGuard)
export class PremiumController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listings: ListingsUseCase,
    private readonly audit: AuditService,
  ) {}

  @Post('listings/:id/premium') @HttpCode(201)
  async create(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: PremiumDto) {
    const l = await this.listings.owned(userId, id);
    const o = await this.prisma.premiumOrder.create({
      data: { listingId: id, orgId: l.orgId, userId, months: dto.months, amountTiyin: BigInt(premiumAmountTiyin(dto.months)), status: 'PENDING', provider: 'manual' },
    });
    await this.audit.log({ actorId: userId, action: 'premium.create', entity: 'PremiumOrder', entityId: o.id, meta: { listingId: id, months: dto.months, amountTiyin: Number(o.amountTiyin) } });
    return {
      order: orderView(o),
      pricePerMonthSom: PRICING.premiumPerListingPerMonthSom,
      payInstructions: payInstructions(),
    };
  }

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
      const o = await tx.premiumOrder.findUnique({ where: { id }, include: { listing: { select: { premiumUntil: true } } } });
      if (!o) throw new NotFoundException({ code: 'PREMIUM_ORDER_NOT_FOUND' });
      if (o.status !== 'PENDING') throw new ConflictException({ code: 'PREMIUM_NOT_PENDING', status: o.status });
      const premiumUntil = extendPremium(o.listing.premiumUntil, o.months, now);
      await tx.listing.update({ where: { id: o.listingId }, data: { premiumUntil } });
      const paid = await tx.premiumOrder.update({ where: { id }, data: { status: 'PAID', paidAt: now, provider: o.provider ?? 'manual' } });
      return { order: orderView(paid), premiumUntil };
    });
    await this.audit.log({ actorId: userId, action: 'premium.confirm', entity: 'PremiumOrder', entityId: id, meta: { listingId: r.order.listingId, months: r.order.months, premiumUntil: r.premiumUntil } });
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
    const o = await this.prisma.premiumOrder.findUnique({ where: { id }, select: { status: true, listingId: true, months: true } });
    if (!o) throw new NotFoundException({ code: 'PREMIUM_ORDER_NOT_FOUND' });
    if (o.status !== 'PENDING') throw new ConflictException({ code: 'PREMIUM_NOT_PENDING', status: o.status });
    const row = await this.prisma.premiumOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
    await this.audit.log({ actorId: userId, action: 'premium.cancel', entity: 'PremiumOrder', entityId: id, meta: { listingId: o.listingId, months: o.months, reason } });
    return orderView(row);
  }
}
