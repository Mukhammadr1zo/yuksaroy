import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, Req, UnsupportedMediaTypeException, UseGuards } from '@nestjs/common';
import { ApiConsumes, ApiCookieAuth, ApiTags, PartialType } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { AD_PLACEMENTS, AD_RAILS, AD_STATUSES, type AdPlacement, type AdStatus } from '@yuksaroy/domain';
import { AuditService } from '../../common/audit.service';
import { PrismaService } from '../../common/prisma.service';
import { ImpressionsService } from '../impressions/impressions.service';
import { JwtGuard, CurrentUserId, optionalUserId } from '../identity/presentation/jwt.guard';
import { TokenService } from '../identity/application/token.service';
import { PlatformAdminGuard } from '../organizations/presentation/platform-admin.guard';
import { PlatformOwnerGuard } from '../organizations/presentation/platform-owner.guard';
import { SubscriptionService } from '../subscription/subscription.service';
import { pickIn } from '../catalog/presentation/catalog.controller';
import { detectAdMediaExt, detectImageExt } from '../../common/security';
import { storeFile, takeFile } from '../listings/presentation/uploads.controller';

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

/**
 * Banner uchun ruxsat etilgan turlar: rasm, harakatlanuvchi rasm va ovozsiz video.
 *
 * Bu ro'yxat katalog fotosining ro'yxatidan boshqa: e'lon surati qimirlab turmasligi
 * kerak, reklama banneri esa aynan shuning uchun sotiladi.
 */
const MEDIA_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm',
};

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

  /**
   * Sahifaning ikki yonidagi ustun, BITTA so'rovda.
   *
   * Nega alohida yo'l: bu ikki ustun har ochiq sahifada chiziladi. Har biri o'z
   * so'rovini yuborsa har sahifa ochilishida ikki marta obuna tekshiruvi va ikki
   * marta baza so'rovi ketardi.
   */
  @Get('rails')
  async rails(@Req() req: FastifyRequest) {
    const userId = optionalUserId(req, this.tokens);
    if (userId && (await this.subs.isActive(userId))) return { left: null, right: null };
    const now = new Date();
    const rows = await this.prisma.adPlacement.findMany({
      where: { placement: { in: [...AD_RAILS] }, status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: [{ startsAt: 'desc' }, { id: 'asc' }],
      take: 20,
    });
    // Bir ustunda bir nechta faol bo'lsa eng keyin boshlangani: `one` bilan bir xil qoida
    const pick = (p: string) => { const a = rows.find((r) => r.placement === p); return a ? publicAd(a) : null; };
    return { left: pick('site-left'), right: pick('site-right') };
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
    private readonly impressions: ImpressionsService,
  ) {}

  /**
   * Ro'yxat + har qator uchun sanoq: ko'rildi, bosildi (jami va 30 kun).
   *
   * Sanoq faqat shu yerda: bannerni sotgan odamga "necha marta ko'rildi" degan savolga
   * javob kerak. Sonlar bitta adStats chaqirig'ida olinadi, qator boshiga so'rov yo'q.
   */
  @Get()
  async list(@Query('placement') placement?: string, @Query('status') status?: string) {
    const ads = await this.prisma.adPlacement.findMany({
      where: {
        placement: pickIn(placement, AD_PLACEMENTS),
        status: pickIn(status, AD_STATUSES),
      },
      orderBy: [{ startsAt: 'desc' }, { id: 'asc' }],
      take: 200,
    });
    const stats = await this.impressions.adStats(ads.map((a) => a.id));
    return ads.map((a) => ({ ...a, stats: stats.get(a.id)! }));
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

  /**
   * Banner faylini yuklash: rasm, GIF yoki OVOZSIZ video.
   *
   * Nega havola emas: brend bannerni fayl bilan beradi, uni birovning saytiga
   * joylashtirib havola olish kerak emas. Bundan tashqari begona manzil har ochiq
   * sahifadan brauzerni o'sha saytga murojaat qilishga majbur qilardi, ya'ni bizning
   * "kuzatuvchi yo'q" yozuvimiz yolg'on bo'lib qolardi.
   *
   * Faqat platforma egasi: yaratish va o'zgartirish ham egada, bu sotuv.
   * Tur mazmun imzosidan aniqlanadi va video ovozsiz chiziladi (chizuvchi tomonda).
   */
  @Post('media')
  @UseGuards(PlatformOwnerGuard)
  @ApiConsumes('multipart/form-data')
  async media(@CurrentUserId() userId: string, @Req() req: FastifyRequest) {
    const { part, buf } = await takeFile(req);
    const ext = MEDIA_EXT[part.mimetype];
    if (!ext) throw new BadRequestException({ code: 'FILE_TYPE', allowed: Object.keys(MEDIA_EXT) });
    const actual = detectImageExt(buf) ?? detectAdMediaExt(buf);
    if (actual !== ext) throw new UnsupportedMediaTypeException({ code: 'FILE_CONTENT_MISMATCH', allowed: Object.keys(MEDIA_EXT) });
    const { url, path } = await storeFile(buf, ext, true);
    await this.audit.log({ actorId: userId, action: 'admin.ad.media', entity: 'Upload', entityId: path, meta: { bytes: buf.length, mimetype: part.mimetype } });
    return { url, size: buf.length, mime: part.mimetype };
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
