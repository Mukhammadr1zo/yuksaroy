import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags, PartialType } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { AD_PLACEMENTS, AD_STATUSES, type AdPlacement, type AdStatus } from '@yuksaroy/domain';
import { AuditService } from '../../common/audit.service';
import { PrismaService } from '../../common/prisma.service';
import { JwtGuard, CurrentUserId, optionalUserId } from '../identity/presentation/jwt.guard';
import { TokenService } from '../identity/application/token.service';
import { PlatformAdminGuard } from '../organizations/presentation/platform-admin.guard';
import { PlatformOwnerGuard } from '../organizations/presentation/platform-owner.guard';
import { SubscriptionService } from '../subscription/subscription.service';
import { pickIn } from '../catalog/presentation/catalog.controller';

class AdCreateDto {
  @IsIn(AD_PLACEMENTS) placement!: AdPlacement;
  @IsString() @MaxLength(80) title!: string;
  @IsOptional() @IsString() @MaxLength(200) body?: string;
  @IsOptional() @IsString() @MaxLength(500) imageUrl?: string;
  @IsString() @MaxLength(500) href!: string;
  @IsOptional() @IsString() @MaxLength(200) buyer?: string;
  @IsOptional() @IsInt() @Min(0) pricePaidSom?: number;
  @IsIn(AD_STATUSES) status!: AdStatus;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
}
class AdUpdateDto extends PartialType(AdCreateDto) {}

/** Ommaviy javob: sotuv ma'lumoti (kim oldi, qancha to'ladi) bu yerda yo'q. */
const publicAd = (a: { id: string; title: string; body: string | null; imageUrl: string | null; href: string }) => ({
  id: a.id, title: a.title, body: a.body, imageUrl: a.imageUrl, href: a.href,
});

/**
 * Yon tomondagi reklama, ommaviy tomoni.
 *
 * Kirish majburiy emas, lekin token bo'lsa o'qiladi: OBUNACHIGA REKLAMA KO'RSATILMAYDI.
 * Odam pul to'lab reklama ko'rsa obunaning ma'nosi pasayadi, shuning uchun bu qoida
 * serverda turadi, ekranda emas.
 */
@ApiTags('ads')
@Controller('ads')
export class AdsPublicController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly subs: SubscriptionService,
  ) {}

  /**
   * Bitta joy uchun bitta reklama yoki null.
   *
   * Bir vaqtda bir nechta faol bo'lsa eng keyin boshlangani olinadi: yangi shartnoma
   * eskisining ustiga chiqadi va bu operator uchun taxmin qilinadigan qoida.
   */
  @Get()
  async one(@Req() req: FastifyRequest, @Query('placement') placement?: string) {
    const p = pickIn(placement, AD_PLACEMENTS);
    if (!p) return { ad: null };
    const userId = optionalUserId(req, this.tokens);
    if (userId && (await this.subs.isActive(userId))) return { ad: null };
    const now = new Date();
    const ad = await this.prisma.adPlacement.findFirst({
      where: { placement: p, status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: [{ startsAt: 'desc' }, { id: 'asc' }],
    });
    return { ad: ad ? publicAd(ad) : null };
  }
}

/**
 * Reklamani panelda boshqarish.
 *
 * Ko'rish operatorga ham ochiq (u matnni tekshiradi), yaratish va o'zgartirish esa
 * faqat egada: bu sotuv va pul, ya'ni platformaning o'z shartnomasi.
 */
@ApiTags('ads')
@ApiCookieAuth('ys_access')
@Controller('admin/ads')
@UseGuards(JwtGuard, PlatformAdminGuard)
export class AdsAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(@Query('placement') placement?: string, @Query('status') status?: string) {
    return this.prisma.adPlacement.findMany({
      where: {
        placement: pickIn(placement, AD_PLACEMENTS),
        status: pickIn(status, AD_STATUSES),
      },
      orderBy: [{ startsAt: 'desc' }, { id: 'asc' }],
      take: 200,
    });
  }

  @Post()
  @UseGuards(PlatformOwnerGuard)
  async create(@CurrentUserId() userId: string, @Body() dto: AdCreateDto) {
    const data = range(dto.startsAt, dto.endsAt);
    const a = await this.prisma.adPlacement.create({ data: { ...dto, ...data } });
    await this.audit.log({ actorId: userId, action: 'admin.ad.create', entity: 'AdPlacement', entityId: a.id, meta: { placement: a.placement, buyer: a.buyer, pricePaidSom: a.pricePaidSom } });
    return a;
  }

  @Patch(':id')
  @UseGuards(PlatformOwnerGuard)
  async update(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: AdUpdateDto) {
    const cur = await this.prisma.adPlacement.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException({ code: 'AD_NOT_FOUND' });
    // Sanalar birga tekshiriladi: bittasi o'zgarsa ikkinchisi bazadagisidan olinadi
    const startsAt = dto.startsAt ?? cur.startsAt.toISOString();
    const endsAt = dto.endsAt ?? cur.endsAt.toISOString();
    const a = await this.prisma.adPlacement.update({ where: { id }, data: { ...dto, ...range(startsAt, endsAt) } });
    await this.audit.log({ actorId: userId, action: 'admin.ad.update', entity: 'AdPlacement', entityId: id, meta: { fields: Object.keys(dto) } });
    return a;
  }

  @Delete(':id')
  @UseGuards(PlatformOwnerGuard)
  async remove(@CurrentUserId() userId: string, @Param('id') id: string) {
    const a = await this.prisma.adPlacement.findUnique({ where: { id } });
    if (!a) throw new NotFoundException({ code: 'AD_NOT_FOUND' });
    await this.prisma.adPlacement.delete({ where: { id } });
    await this.audit.log({ actorId: userId, action: 'admin.ad.delete', entity: 'AdPlacement', entityId: id, meta: { placement: a.placement, title: a.title } });
    return { id, deleted: true };
  }
}

/** Sana oralig'i: tugash boshlanishdan keyin bo'lishi shart, aks holda reklama hech qachon chiqmaydi. */
function range(startsAt: string, endsAt: string) {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  if (!(e > s)) throw new BadRequestException({ code: 'AD_RANGE', field: 'endsAt' });
  return { startsAt: s, endsAt: e };
}
