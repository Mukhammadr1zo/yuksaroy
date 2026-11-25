import { Body, Controller, Get, HttpCode, HttpException, Ip, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import type { FastifyRequest } from 'fastify';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Length, Matches, MaxLength, ValidateNested } from 'class-validator';
import { IMPRESSION_SURFACES, type ImpressionSurface } from '@yuksaroy/domain';
import { ActivityService } from '../activity/activity.service';
import { env } from '../../common/env';
import { locate } from '../../common/geoip';
import { DailyBucket, IpBucket } from '../../common/ip-bucket';
import { PrismaService } from '../../common/prisma.service';
import { TokenService } from '../identity/application/token.service';
import { CurrentUserId, JwtGuard, optionalUserId } from '../identity/presentation/jwt.guard';
import { ListingsUseCase } from '../listings/application/listings.usecase';
import { OrderAccess } from '../orders/application/order-access';
import { SubscriptionService } from '../subscription/subscription.service';
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

/** Tashrif mayog'i tanasi. Eski mijoz tana yubormaydi: hammasi ixtiyoriy. */
export class VisitDto {
  // Faqat ichki yo'l: "//evil" (boshqa sayt), so'rov qatori va # rad etiladi
  @IsOptional() @IsString() @MaxLength(2000) @Matches(/^\/(?!\/)[^\s?#]*$/) path?: string;
  @IsOptional() @IsString() @MaxLength(300) referrer?: string;
  /** Kunlik sanoqqa tushadimi: brauzer kuniga bir marta true yuboradi. false = faqat Telegram xabari uchun. */
  @IsOptional() @IsBoolean() first?: boolean;
}

/**
 * Qayerdan kelgani: faqat host + yo'l (so'rov qatori va # tashlanadi, chunki unda
 * qidiruv matni bo'lishi mumkin). O'z saytimizdan bo'lsa faqat yo'l. Yaroqsiz bo'lsa undefined.
 */
export function reduceReferrer(raw: string | undefined, ownHost = new URL(env.WEB_ORIGIN).host): string | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;
    const path = u.pathname === '/' ? '' : u.pathname;
    return u.host === ownHost ? (u.pathname || '/') : `${u.host}${path}`;
  } catch { return undefined; }
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
/** Terminalga yozilgan so'rov: terminalning o'ziga (terminalId) ham, uning e'loniga (listing) ham. */
export const terminalInquiryWhere = (id: string, gte: Date) => ({ OR: [{ terminalId: id }, { listing: { terminalId: id } }], createdAt: { gte } });
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
    private readonly subs: SubscriptionService,
    private readonly tokens: TokenService,
    private readonly activity: ActivityService,
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
   * Tashrif mayog'i. Brauzer rozilikdan keyin har sahifada yuboradi: `first` kunlik
   * sanoq uchun (qaror brauzerda, chunki bitta mobil operator minglab odamni bitta
   * ommaviy IP ortiga qo'yadi), qolganlari faqat superadminga Telegram xabari uchun.
   *
   * Bazaga faqat kunlik yig'ma (davlat + viloyat) yoziladi: sahifa manzili, qayerdan
   * kelgani va IP saqlanmaydi, ular faqat adminning Telegram xabariga boradi.
   * Tana yo'q (eski mijoz) = avvalgidek bitta sanoq, xabarsiz.
   */
  @Post('events/visit') @HttpCode(200)
  async visit(@Ip() ip: string, @Req() req: FastifyRequest, @Body() dto: VisitDto) {
    if (!bucket.take(ip ?? '?')) throw new HttpException({ code: 'RATE_LIMITED' }, 429);
    // Kunlik chegara faqat sanoqqa tegadi (Telegram xabari uchun emas): u baland va
    // faqat suiiste'molga qarshi, past chegara oddiy foydalanuvchilarni ham kesib tashlardi
    if (dto?.first !== false && visitDaily.take(ip ?? '?', VISITS_PER_IP_DAY).ok) {
      await this.impressions.recordVisit(await locate(ip));
    }
    if (dto?.path) {
      // Xabar hech qachon so'rovni sindirmasin
      try {
        this.activity.visit({
          userId: optionalUserId(req, this.tokens), path: dto.path.slice(0, 200), referrer: reduceReferrer(dto.referrer),
          ip, ua: String(req.headers['user-agent'] ?? '').slice(0, 300),
        });
      } catch { /* jim */ }
    }
    return { ok: true };
  }

  /**
   * Egasi ko'rsatkichlari faqat obunachiga. Egasi qarori, 2026-11-02: ko'rsatkichlar
   * hamma uchun ochiq bo'lishi rad etildi, ular obunaning bir qismi (pricing.json a2).
   *
   * Server tekshiradi, faqat ekran emas: aks holda manzilni qo'lda ochgan odam raqamlarni olardi.
   * Qaysi ruxsat: telefon ham, vagon ham emas, HAR QANDAY faol obuna. Ko'rsatkichlar e'lon
   * egasiga kerak, vagon tarifli odam ham egasi bo'lishi mumkin; tarifga alohida belgi yo'q.
   * Javob telefon devori bilan bir shaklda (SUBSCRIPTION_REQUIRED, 402, narx): ekranda bitta
   * qaror shoxi. Narx telefonni ochadigan eng arzon tarifniki, bu ham telefon devori bilan bir xil.
   *
   * Egalik tekshiruvidan KEYIN chaqiriladi: begona obyektni so'ragan odam devorga urilgan
   * deb sanalmasin (u 403 oladi).
   */
  private async requireSubscriber(userId: string) {
    if (await this.subs.active(userId)) return;
    void this.impressions.paywallHit(userId, 'metrics').catch(() => {});
    throw new HttpException({ code: 'SUBSCRIPTION_REQUIRED', kind: 'metrics', priceSom: await this.subs.priceFor('PHONE') }, 402);
  }

  /** E'lon egasi: yuzalar bo'yicha ko'rsatishlar + so'rovlar (30 kun) + jami ko'rishlar. */
  @Get('listings/:id/analytics') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access')
  async listing(@CurrentUserId() userId: string, @Param('id') id: string) {
    await this.listings.owned(userId, id);
    await this.requireSubscriber(userId);
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
    await this.requireSubscriber(userId);
    const now = new Date(), gte = since30(now);
    const [s, inquiries, orders] = await Promise.all([
      this.impressions.series('terminal', id, now),
      this.prisma.inquiry.count({ where: terminalInquiryWhere(id, gte) }),
      this.prisma.order.count({ where: { terminalId: id, createdAt: { gte } } }),
    ]);
    return { ...s, inquiries, orders };
  }
}
