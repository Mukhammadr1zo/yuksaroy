import { Body, Controller, Get, HttpCode, HttpException, Ip, Param, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsString, Length, ValidateNested } from 'class-validator';
import { IMPRESSION_SURFACES, type ImpressionSurface } from '@yuksaroy/domain';
import { locate } from '../../common/geoip';
import { DailyBucket, IpBucket } from '../../common/ip-bucket';
import { PrismaService } from '../../common/prisma.service';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { ListingsUseCase } from '../listings/application/listings.usecase';
import { OrderAccess } from '../orders/application/order-access';
import { AD_SURFACES, ImpressionsService, type AdSurface, type ImpressionKind } from './impressions.service';

export class ImpressionItemDto {
  // 'ad' ham shu yerda: reklama banneri ko'rilgani va bosilgani ham kunlik yig'ma qator,
  // alohida jadval kerak emas. Haqiqiy banner ekani keyin serverda tekshiriladi.
  //
  // 'wall' bu ro'yxatda YO'Q: to'lov devoriga urilgan odam faqat serverda, 402
  // tashlanadigan joyda sanaladi. Bu yo'l kirishsiz, ya'ni undan kelgan 'wall' shunchaki
  // shishirilgan son bo'lardi va devor sonining o'zi narx qarori uchun yaroqsiz bo'lib qolardi.
  @IsIn(['listing', 'terminal', 'org', 'ad']) kind!: ImpressionKind;
  @IsString() @Length(1, 40) targetId!: string;
  // 'contact' bu ro'yxatda yo'q: telefon ochilgani faqat serverda, raqam haqiqatan
  // berilganda yoziladi. Bu yo'l kirishsiz, ya'ni undan kelgan 'contact' shunchaki
  // shishirilgan son bo'lardi.
  @IsIn([...IMPRESSION_SURFACES.filter((s) => s !== 'contact'), ...AD_SURFACES]) surface!: ImpressionSurface | AdSurface;
}
class ImpressionsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => ImpressionItemDto) items!: ImpressionItemDto[];
}

const bucket = new IpBucket(60, 60_000); // bitta IP: daqiqasiga 60 ta so'rov
const visitDaily = new DailyBucket();
/**
 * Bitta ommaviy IP dan kuniga nechta tashrif yoziladi. Chegara ataylab baland:
 * Ucell, Beeline va Uztelecom minglab abonentni bitta manzil ortiga qo'yadi, ya'ni
 * past chegara haqiqiy odamlarni sanoqdan chiqarib yuborardi. Bu chelak takrorni
 * emas, faqat skript bilan raqam shishirishni to'xtatadi.
 */
const VISITS_PER_IP_DAY = 2000;
const adsDaily = new DailyBucket();
/**
 * Bitta IP dan kuniga nechta reklama mayog'i yoziladi.
 *
 * Nega alohida chelak: bu son brendga hisobot bo'lib ketadi, ya'ni uni shishirish
 * to'g'ridan-to'g'ri pul. Chegara VISITS_PER_IP_DAY kabi baland, chunki bitta operator
 * IP si ortida minglab abonent turadi va past chegara haqiqiy odamlarni sanoqdan
 * chiqarardi. Katalog mayoqlari bu chelakka kirmaydi: u yerda son sotilmaydi.
 */
const ADS_PER_IP_DAY = 2000;
const since30 = (now: Date) => new Date(now.getTime() - 30 * 86_400_000);

/** Ko'rsatish hodisalari (ochiq, IP limit) va egasi analitikasi (oxirgi 30 kun). */
@ApiTags('impressions')
@Controller()
export class ImpressionsController {
  constructor(
    private readonly impressions: ImpressionsService,
    private readonly prisma: PrismaService,
    private readonly listings: ListingsUseCase,
    private readonly access: OrderAccess,
  ) {}

  @Post('events/impressions') @HttpCode(200)
  async record(@Ip() ip: string, @Body() dto: ImpressionsDto) {
    const key = ip ?? '?';
    if (!bucket.take(key)) throw new HttpException({ code: 'RATE_LIMITED' }, 429);
    // Reklama mayoqlari yozishdan oldin tekshiriladi: notanish banner id jim tashlanadi
    const items = await this.impressions.keepRealAds(dto.items);
    // Kunlik chegaradan oshgan reklama mayog'i ham JIM tashlanadi: bitta element uchun
    // butun so'rov yiqilmasin va katalog mayoqlari o'z yo'lida qolsin
    return this.impressions.record(items.filter((i) => i.kind !== 'ad' || adsDaily.take(key, ADS_PER_IP_DAY).ok));
  }

  /**
   * Tashrif mayog'i: brauzer kuniga bir marta yuboradi (qaror brauzerda, chunki bitta
   * mobil operator minglab odamni bitta ommaviy IP ortiga qo'yadi va IP bo'yicha
   * ajratish haqiqiy tashriflarni yo'qotib qo'yardi).
   *
   * Tanasi yo'q: sahifa manzili ham, boshqa hech narsa ham yuborilmaydi. Serverga
   * faqat IP keladi va undan davlat bilan viloyat chiqariladi, IP esa saqlanmaydi.
   */
  @Post('events/visit') @HttpCode(200)
  async visit(@Ip() ip: string) {
    if (!bucket.take(ip ?? '?')) throw new HttpException({ code: 'RATE_LIMITED' }, 429);
    // Chegara baland va faqat suiiste'molga qarshi: yuqoridagi sababga ko'ra past
    // chegara oddiy foydalanuvchilarni ham kesib tashlardi
    if (!visitDaily.take(ip ?? '?', VISITS_PER_IP_DAY).ok) return { ok: true };
    await this.impressions.recordVisit(await locate(ip));
    return { ok: true };
  }

  /** E'lon egasi: yuzalar bo'yicha ko'rsatishlar + so'rovlar (30 kun) + jami ko'rishlar. */
  @Get('listings/:id/analytics') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access')
  async listing(@CurrentUserId() userId: string, @Param('id') id: string) {
    const l = await this.listings.owned(userId, id);
    const now = new Date();
    const [s, inquiries, views] = await Promise.all([
      this.impressions.series('listing', id, now),
      this.prisma.inquiry.count({ where: { listingId: id, createdAt: { gte: since30(now) } } }),
      this.impressions.detailViews('listing', [id]),
    ]);
    // Umumiy son ham mayoqlardan: 30 kunlik qator bilan bir manbadan bo'lsin
    return { ...s, inquiries, views: views[id] ?? 0 };
  }

  /** Terminal xodimi: ko'rsatishlar + shu terminaldagi e'lonlarga so'rovlar + buyurtmalar (30 kun). */
  @Get('terminals/:id/analytics') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access')
  async terminal(@CurrentUserId() userId: string, @Param('id') id: string) {
    await this.access.assertTerminalOf(userId, id);
    const now = new Date(), gte = since30(now);
    const [s, inquiries, orders] = await Promise.all([
      this.impressions.series('terminal', id, now),
      this.prisma.inquiry.count({ where: { listing: { terminalId: id }, createdAt: { gte } } }),
      this.prisma.order.count({ where: { terminalId: id, createdAt: { gte } } }),
    ]);
    return { ...s, inquiries, orders };
  }
}
