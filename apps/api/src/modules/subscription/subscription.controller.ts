import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AuditService } from '../../common/audit.service';
import { PlatformConfigService } from '../../common/platform-config.service';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { PlatformAdminGuard } from '../organizations/presentation/platform-admin.guard';
import { clampInt, pickIn } from '../catalog/presentation/catalog.controller';
import { PlatformOwnerGuard } from '../organizations/presentation/platform-owner.guard';
import { SUBSCRIPTION_GRANTS, type SubscriptionGrant } from '@yuksaroy/domain';
import { SUBSCRIPTION_STATUSES, SubscriptionService } from './subscription.service';

class OrderDto {
  @IsInt() @Min(1) @Max(12) months!: number;
  /** Qaysi tarif. Berilmasa telefon tarifi: eski mijozlar va bot shu yo'ldan keladi. */
  @IsOptional() @IsIn(SUBSCRIPTION_GRANTS) grant?: SubscriptionGrant;
  /**
   * Admin yaratgan tarifning kodi. Berilsa narx, ruxsat va chegara o'sha tarifdan
   * olinadi va `grant` e'tiborga olinmaydi.
   */
  @IsOptional() @IsString() @MaxLength(30) planCode?: string;
}

/** Bekor qilish sababi majburiy: auditga yoziladi. */
class CancelDto {
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

/** Bekor qilish: sabab majburiy, pul kelgan-kelmagani esa daromad varag'iga ta'sir qiladi. */
class RevokeDto {
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
  @IsBoolean() moneyReceived!: boolean;
}

/**
 * Tasdiqda operator ko'chirmadan ko'chiradi: haqiqatan qancha tushgani va qaysi o'tkazma.
 * Ikkalasi ham ixtiyoriy va farq tasdiqni to'smaydi, faqat auditda iz qoldiradi.
 */
class ConfirmDto {
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000_000) receivedSom?: number;
  @IsOptional() @IsString() @MaxLength(200) payRef?: string;
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
    // pricePerMonthSom eski nom bo'lib qoladi: uni narxlar sahifasi va bot o'qiydi
    return {
      pricePerMonthSom: cfg.subscriptionMonthSom,
      wagonPerMonthSom: cfg.wagonMonthSom,
      phoneRevealDaily: cfg.phoneRevealDaily,
      wagonSearchFree: cfg.wagonSearchFree,
    };
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
    const r = await this.subs.order(userId, dto.months, dto.grant, dto.planCode);
    if (!r.reused) await this.audit.log({ actorId: userId, action: 'subscription.create', entity: 'Subscription', entityId: r.order.id, meta: { no: r.order.no, months: dto.months, grants: r.order.grants, planCode: dto.planCode ?? null, amountTiyin: r.order.amountTiyin } });
    return r;
  }

  /** O'z kutilayotgan buyurtmasini bekor qilish. Sabab so'ralmaydi: pul o'tmagan va odam darhol qayta bera oladi. */
  @Post('subscription/orders/:id/cancel') @HttpCode(200)
  async cancelOwn(@CurrentUserId() userId: string, @Param('id') id: string) {
    const me = await this.subs.cancelOwn(userId, id);
    await this.audit.log({ actorId: userId, action: 'subscription.cancel.self', entity: 'Subscription', entityId: id });
    return me;
  }

  /** Admin navbati: `status` (default PENDING), eski birinchi. */
  @Get('admin/subscriptions')
  @UseGuards(PlatformAdminGuard)
  list(@Query('status') status?: string) {
    return this.subs.list(pickIn(status, SUBSCRIPTION_STATUSES) ?? 'PENDING');
  }

  /**
   * Obunachilar reyestri: hamma holat, qidiruv va sahifalash bilan.
   *
   * Navbat yo'lidan alohida: u guruhlangan va faqat to'lanmaganini beradi. Reyestrsiz
   * "nechta to'lovchi bor", "kimniki tugayapti", "bu odam to'laganmi" degan savollarga
   * paneldan javob topib bo'lmasdi.
   */
  @Get('admin/subscriptions/registry')
  @UseGuards(PlatformAdminGuard)
  registry(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.subs.registry({
      status: pickIn(status, SUBSCRIPTION_STATUSES),
      q,
      page: clampInt(page, 1, 1, 100_000),
      limit: clampInt(limit, 30, 1, 100),
    });
  }

  @Post('admin/subscriptions/:id/confirm') @HttpCode(200)
  @UseGuards(PlatformAdminGuard)
  async confirm(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: ConfirmDto) {
    const s = await this.subs.confirm(id);
    const receivedTiyin = dto?.receivedSom == null ? null : dto.receivedSom * 100;
    // Kutilgan va olingan summa yonma-yon yoziladi: keyin "qancha keldi" savoliga faqat shu javob beradi
    await this.audit.log({ actorId: userId, action: 'subscription.confirm', entity: 'Subscription', entityId: id, meta: { userId: s.userId, months: s.months, endsAt: s.endsAt, expectedTiyin: s.amountTiyin, receivedTiyin, payRef: dto?.payRef?.trim() || null } });
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

  /**
   * Tasdiqlangan obunani bekor qilish: faqat platforma egasi.
   *
   * Nega egaga: bu pulga va odamning allaqachon olgan huquqiga tegadi, ya'ni tasdiqlashning
   * teskarisi. Tasdiqlashning o'zi operatorga ochiq, lekin uni qaytarish egada qolsin.
   */
  @Post('admin/subscriptions/:id/revoke') @HttpCode(200)
  @UseGuards(PlatformOwnerGuard)
  async revoke(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: RevokeDto) {
    const reason = dto?.reason?.trim();
    if (!reason) throw new BadRequestException({ code: 'REASON_REQUIRED' });
    const s = await this.subs.revoke(id, reason, dto.moneyReceived);
    // Eski tugash sanasi ham yoziladi: "qancha kun olib qo'yildi" savoliga keyin faqat shu javob beradi
    await this.audit.log({
      actorId: userId, action: 'subscription.revoke', entity: 'Subscription', entityId: id,
      meta: { userId: s.userId, reason, moneyReceived: dto.moneyReceived, wasEndsAt: s.wasEndsAt, amountTiyin: s.amountTiyin },
    });
    return s;
  }
}
