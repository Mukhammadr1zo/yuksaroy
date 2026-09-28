import { BadRequestException, Body, Controller, Get, HttpCode, HttpException, Post, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { Prisma } from '@prisma/client';
import { normalizeWagonNo } from '@yuksaroy/domain';
import { AuditService } from '../../common/audit.service';
import { IpBucket } from '../../common/ip-bucket';
import { PlatformConfigService } from '../../common/platform-config.service';
import { PrismaService } from '../../common/prisma.service';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { InternalGuard } from '../identity/presentation/internal.guard';
import { SubscriptionService } from '../subscription/subscription.service';
import { DRailwayClient } from './d-railway.client';
import { CACHE_MS, canSearch, deriveCurrent, serialize, upstreamNo, type WagonEvent } from './wagon.rules';

class SearchDto {
  @IsString() @MaxLength(20) no!: string;
}

/** Bot -> API: qidiruvni kim so'raganini chat orqali aniqlaymiz. */
class TelegramSearchDto {
  @IsString() @MaxLength(32) chatId!: string;
  @IsString() @MaxLength(20) no!: string;
}

/**
 * Bazada saqlanadigan natija: kesh ham, foydalanuvchiga javob ham shu.
 * Harakat tarixi saqlanmaydi va yuborilmaydi: sahifa faqat joriy joylashuvni ko'rsatadi.
 */
type Stored = { current: WagonEvent | null; fetchedAt: string };

// Upstream ga chindan boradigan qidiruv: foydalanuvchi bo'yicha soatiga 30 ta
const searchBucket = new IpBucket(30, 3_600_000);
// Keshdan javob beradigan so'rov ham baza ishi va audit qatori: bo'ron uchun keng chegara
const floodBucket = new IpBucket(120, 3_600_000);

/**
 * Vagon qidiruvi. Egasining qoidasi: birinchi qidiruv(lar) hammaga bepul, keyin obuna.
 * Bir xil vagon 6 soat ichida qayta so'ralsa natija bazadan olinadi (upstream tinch turadi),
 * lekin kvota uchun qator baribir yoziladi: natijasiz, chunki kesh muddati upstream dan
 * olingan vaqtdan sanaladi (keshdan olingan qator "yangi" ko'rinib muddatni cho'zmasin).
 * O'zi 6 soat ichida so'ragan vagonni qayta ochsa kvota yemaydi: bir marta to'lagan
 * narsasini qayta ko'rish yangi qidiruv emas, oradan boshqa birov qidirgan bo'lsa ham.
 */
@ApiTags('wagon')
@ApiCookieAuth('ys_access')
@Controller('wagon')
// DIQQAT: guard sinf darajasida emas, har yo'lda alohida. Sababi: botning ichki yo'li
// sessiya bilan emas, umumiy sir bilan ishlaydi va JwtGuard uni rad etardi. Yangi yo'l
// qo'shsangiz guardni ham qo'shing, aks holda u himoyasiz qoladi.
export class WagonController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: PlatformConfigService,
    private readonly subs: SubscriptionService,
    private readonly audit: AuditService,
    private readonly upstream: DRailwayClient,
  ) {}

  @Get('me')
  @UseGuards(JwtGuard)
  async me(@CurrentUserId() userId: string) {
    const [q, rows] = await Promise.all([
      this.quota(userId),
      // Oxirgi qidirganlarim: yangi ustun yo'q, [userId, createdAt] indeksi so'rovni qoplaydi
      this.prisma.wagonSearch.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20, select: { wagonNo: true, found: true } }),
    ]);
    // Bir vagon 6 soatdan keyin qayta qidirilsa ikkita qator bo'ladi: ro'yxatda faqat
    // ENG YANGISI qolsin, aks holda kecha topilmagan vagon bugun ham "topilmadi" ko'rinardi
    const seen = new Set<string>();
    const recent = rows.filter((r) => !seen.has(r.wagonNo) && seen.add(r.wagonNo)).slice(0, 10);
    return { configured: this.upstream.configured, ...q, remainingFree: Math.max(0, q.freeTotal - q.freeUsed), recent };
  }

  @Post('search') @HttpCode(200)
  @UseGuards(JwtGuard)
  async search(@CurrentUserId() userId: string, @Body() dto: SearchDto) {
    return this.run(userId, dto.no);
  }

  /**
   * Bot -> API: Telegram chat egasining nomidan qidiruv.
   *
   * Nega alohida yo'l: bot foydalanuvchi sessiyasini ushlab turmaydi, uning qo'lida
   * faqat chat raqami bor. Chat raqami esa telefon tasdiqlanganda userId ga bog'langan
   * (TelegramLink), ya'ni qidiruvni kim so'raganini aniq bilamiz.
   *
   * Nega aynan shu yo'ldan boradi: kvota, obuna devori, 6 soatlik kesh, chegaralar va
   * audit qatori run() ichida. Bot uchun alohida yo'l yozilsa, telefon devori bot orqali
   * chetlab o'tilardi: obunasiz odam botdan cheksiz qidirar edi.
   */
  @Post('internal/telegram/search') @HttpCode(200)
  @UseGuards(InternalGuard)
  async telegramSearch(@Body() dto: TelegramSearchDto) {
    let chatId: bigint;
    try { chatId = BigInt(dto.chatId); } catch { throw new BadRequestException({ code: 'CHAT_ID_INVALID' }); }
    const link = await this.prisma.telegramLink.findUnique({ where: { chatId }, select: { userId: true } });
    // Bog'lanmagan chat: bot odamni /start ga yuboradi, telefonini tasdiqlagach ishlaydi
    if (!link) throw new HttpException({ code: 'NOT_LINKED' }, 403);
    return this.run(link.userId, dto.no);
  }

  private async run(userId: string, no: string) {
    const digits = normalizeWagonNo(no);
    if (!digits) throw new BadRequestException({ code: 'WAGON_NO_INVALID' });
    // Kalit upstream bilan bir xil: "01234567" va "1234567" bitta vagon, bitta kesh, bitta kvota
    const wagonNo = upstreamNo(digits);
    if (!this.upstream.configured) throw new ServiceUnavailableException({ code: 'WAGON_NOT_CONFIGURED' });
    if (!floodBucket.take(userId)) throw new HttpException({ code: 'RATE_LIMITED' }, 429);
    // Bir foydalanuvchi navbat bilan: kvota tekshiruvi va qator yozuvi orasiga ikkinchi oynadagi so'rov kirmasin
    return serialize(userId, () => this.lookup(userId, wagonNo));
  }

  private async lookup(userId: string, wagonNo: string) {
    const since = new Date(Date.now() - CACHE_MS);
    const [cached, ownRow, q] = await Promise.all([
      // Kesh: 6 soat ichida upstream dan olingan natija; natijasiz qator faqat kvota uchun, kesh emas
      this.prisma.wagonSearch.findFirst({
        where: { wagonNo, createdAt: { gt: since }, result: { not: Prisma.AnyNull } },
        orderBy: { createdAt: 'desc' }, select: { found: true, result: true },
      }),
      // Egalik alohida: eng yangi qator boshqa birovniki bo'lsa ham o'zining qatori turibdi
      this.prisma.wagonSearch.findFirst({ where: { userId, wagonNo, createdAt: { gt: since } }, select: { id: true } }),
      this.quota(userId),
    ]);
    const own = !!ownRow;
    if (!own && !canSearch(q.subscriber, q.freeUsed, q.freeTotal)) throw new HttpException({ code: 'SUBSCRIPTION_REQUIRED', ...q }, 402);

    let found: boolean; let result: Stored;
    if (cached) {
      found = cached.found; result = cached.result as unknown as Stored;
    } else {
      // Chegara kesh tekshiruvidan KEYIN: keshdagi raqam upstream ni bezovta qilmagani
      // uchun chegarani ham yemaydi, ya'ni bitta partiyani soatiga bir necha marta
      // yangilab bo'ladi
      if (!searchBucket.take(userId)) throw new HttpException({ code: 'RATE_LIMITED' }, 429);
      let h: Awaited<ReturnType<DRailwayClient['history']>>;
      try { h = await this.upstream.history(wagonNo); }
      catch (e) {
        // Sabab faqat logda: upstream manzili yoki javobi mijozga chiqmasin
        console.error('wagon upstream', (e as Error).message);
        await this.audit.log({ actorId: userId, action: 'wagon.search', entity: 'Wagon', entityId: wagonNo, meta: { error: true } });
        throw new HttpException({ code: 'WAGON_UPSTREAM' }, 502);
      }
      found = h !== null;
      result = { current: h ? deriveCurrent(h.events) : null, fetchedAt: new Date().toISOString() };
    }
    // ponytail: o'zining qatori bor, kesh esa eskirgan (kam uchraydi) bo'lsa yangi natija saqlanmaydi: har qator kvota sanaydi
    if (!own) {
      await this.prisma.wagonSearch.create({ data: { userId, wagonNo, found, result: cached ? Prisma.DbNull : (result as unknown as Prisma.InputJsonValue) } });
      q.freeUsed++;
    }
    await this.audit.log({ actorId: userId, action: 'wagon.search', entity: 'Wagon', entityId: wagonNo, meta: { found, fromCache: !!cached } });
    return { wagonNo, found, ...result, quota: q };
  }

  private async quota(userId: string) {
    const [subscriber, cfg, freeUsed] = await Promise.all([this.subs.isActive(userId, 'WAGON'), this.config.get(), this.prisma.wagonSearch.count({ where: { userId } })]);
    // Narx kvota bilan birga: 402 tanasi ham, /wagon/me ham shu yerdan oladi
    /*
     * Narx: vagon qidiruvini ochishning ENG ARZON yo'li.
     *
     * Ikki tarif bor va ikkalasi ham vagon qidiruvini ochadi: to'liq obuna va faqat
     * vagon tarifi. Devor odam chindan to'laydigan summani ko'rsatishi kerak, shuning
     * uchun kichigini oladi. Narxlar teng bo'lsa (bugungi sukut) farq bilinmaydi.
     */
    return { subscriber, freeUsed, freeTotal: cfg.wagonSearchFree, priceSom: Math.min(cfg.subscriptionMonthSom, cfg.wagonMonthSom) };
  }
}
