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
import { SubscriptionService } from '../subscription/subscription.service';
import { DRailwayClient } from './d-railway.client';
import { CACHE_MS, canSearch, deriveCurrent, mapEvents, serialize, upstreamNo, type WagonEvent } from './wagon.rules';

class SearchDto {
  @IsString() @MaxLength(20) no!: string;
}

/** Bazada saqlanadigan natija: kesh ham, foydalanuvchiga javob ham shu. */
type Stored = { current: WagonEvent | null; events: WagonEvent[]; fetchedAt: string };

// Har qidiruv upstream ga so'rov: foydalanuvchi bo'yicha soatiga 30 ta
const searchBucket = new IpBucket(30, 3_600_000);

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
@UseGuards(JwtGuard)
export class WagonController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: PlatformConfigService,
    private readonly subs: SubscriptionService,
    private readonly audit: AuditService,
    private readonly upstream: DRailwayClient,
  ) {}

  @Get('me')
  async me(@CurrentUserId() userId: string) {
    const q = await this.quota(userId);
    return { configured: this.upstream.configured, ...q, remainingFree: Math.max(0, q.freeTotal - q.freeUsed) };
  }

  @Post('search') @HttpCode(200)
  async search(@CurrentUserId() userId: string, @Body() dto: SearchDto) {
    const digits = normalizeWagonNo(dto.no);
    if (!digits) throw new BadRequestException({ code: 'WAGON_NO_INVALID' });
    // Kalit upstream bilan bir xil: "01234567" va "1234567" bitta vagon, bitta kesh, bitta kvota
    const wagonNo = upstreamNo(digits);
    if (!this.upstream.configured) throw new ServiceUnavailableException({ code: 'WAGON_NOT_CONFIGURED' });
    if (!searchBucket.take(userId)) throw new HttpException({ code: 'RATE_LIMITED' }, 429);
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
      let h: Awaited<ReturnType<DRailwayClient['history']>>;
      try { h = await this.upstream.history(wagonNo); }
      catch (e) {
        // Sabab faqat logda: upstream manzili yoki javobi mijozga chiqmasin
        console.error('wagon upstream', (e as Error).message);
        await this.audit.log({ actorId: userId, action: 'wagon.search', entity: 'Wagon', entityId: wagonNo, meta: { error: true } });
        throw new HttpException({ code: 'WAGON_UPSTREAM' }, 502);
      }
      found = h !== null;
      result = { current: h ? deriveCurrent(h.events) : null, events: h ? mapEvents(h.events) : [], fetchedAt: new Date().toISOString() };
    }
    // ponytail: o'zining qatori bor, kesh esa eskirgan (kam uchraydi) bo'lsa yangi natija saqlanmaydi: har qator kvota sanaydi
    if (!own) {
      await this.prisma.wagonSearch.create({ data: { userId, wagonNo, found, result: cached ? Prisma.DbNull : (result as unknown as Prisma.InputJsonValue) } });
      q.freeUsed++;
    }
    await this.audit.log({ actorId: userId, action: 'wagon.search', entity: 'Wagon', entityId: wagonNo, meta: { found, fromCache: !!cached } });
    return { wagonNo, found, ...result, fromCache: !!cached, quota: q };
  }

  private async quota(userId: string) {
    const [subscriber, cfg, freeUsed] = await Promise.all([this.subs.isActive(userId), this.config.get(), this.prisma.wagonSearch.count({ where: { userId } })]);
    return { subscriber, freeUsed, freeTotal: cfg.wagonSearchFree };
  }
}
