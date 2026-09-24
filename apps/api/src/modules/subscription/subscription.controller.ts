import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AuditService } from '../../common/audit.service';
import { PlatformConfigService } from '../../common/platform-config.service';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { PlatformAdminGuard } from '../organizations/presentation/platform-admin.guard';
import { pickIn } from '../catalog/presentation/catalog.controller';
import { SUBSCRIPTION_STATUSES, SubscriptionService } from './subscription.service';

class OrderDto {
  @IsInt() @Min(1) @Max(12) months!: number;
}

/** Bekor qilish sababi majburiy: auditga yoziladi. */
class CancelDto {
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

/**
 * Ochiq: obuna nima berishi va narxi. Kirish shart emas, chunki narxlar sahifasi mehmonga
 * ham ko'rinadi: obunani faqat devorga urilgan odam topmasin.
 */
@ApiTags('subscription')
@Controller('subscription')
export class SubscriptionPublicController {
  constructor(private readonly config: PlatformConfigService) {}

  @Get('price')
  async price() {
    const cfg = await this.config.get();
    return { pricePerMonthSom: cfg.subscriptionMonthSom, phoneRevealDaily: cfg.phoneRevealDaily, wagonSearchFree: cfg.wagonSearchFree };
  }
}

/** Obuna: foydalanuvchi buyurtma beradi (PENDING), admin to'lovni tasdiqlaydi (ACTIVE). */
@ApiTags('subscription')
@ApiCookieAuth('ys_access')
@Controller()
@UseGuards(JwtGuard)
export class SubscriptionController {
  constructor(
    private readonly subs: SubscriptionService,
    private readonly audit: AuditService,
  ) {}

  /** Mening obunam: faolmi, qachongacha, kutilayotgan buyurtma, narx. */
  @Get('subscription/me')
  me(@CurrentUserId() userId: string) {
    return this.subs.me(userId);
  }

  @Post('subscription/orders') @HttpCode(201)
  async order(@CurrentUserId() userId: string, @Body() dto: OrderDto) {
    const r = await this.subs.order(userId, dto.months);
    if (!r.reused) await this.audit.log({ actorId: userId, action: 'subscription.create', entity: 'Subscription', entityId: r.order.id, meta: { months: dto.months, amountTiyin: r.order.amountTiyin } });
    return r;
  }

  /** Admin navbati: `status` (default PENDING), eski birinchi. */
  @Get('admin/subscriptions')
  @UseGuards(PlatformAdminGuard)
  list(@Query('status') status?: string) {
    return this.subs.list(pickIn(status, SUBSCRIPTION_STATUSES) ?? 'PENDING');
  }

  @Post('admin/subscriptions/:id/confirm') @HttpCode(200)
  @UseGuards(PlatformAdminGuard)
  async confirm(@CurrentUserId() userId: string, @Param('id') id: string) {
    const s = await this.subs.confirm(id);
    await this.audit.log({ actorId: userId, action: 'subscription.confirm', entity: 'Subscription', entityId: id, meta: { userId: s.userId, months: s.months, endsAt: s.endsAt } });
    return s;
  }

  @Post('admin/subscriptions/:id/cancel') @HttpCode(200)
  @UseGuards(PlatformAdminGuard)
  async cancel(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: CancelDto) {
    const reason = dto?.reason?.trim();
    if (!reason) throw new BadRequestException({ code: 'REASON_REQUIRED' });
    const s = await this.subs.cancel(id, reason);
    await this.audit.log({ actorId: userId, action: 'subscription.cancel', entity: 'Subscription', entityId: id, meta: { userId: s.userId, reason } });
    return s;
  }
}
