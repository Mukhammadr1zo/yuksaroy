import { BadRequestException, Body, Controller, Get, HttpCode, HttpException, Post, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import type { Prisma } from '@prisma/client';
import { normalizeWagonNo } from '@yuksaroy/domain';
import { AuditService } from '../../common/audit.service';
import { IpBucket } from '../../common/ip-bucket';
import { PlatformConfigService } from '../../common/platform-config.service';
import { PrismaService } from '../../common/prisma.service';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { SubscriptionService } from '../subscription/subscription.service';
import { DRailwayClient } from './d-railway.client';
import { CACHE_MS, canSearch, deriveCurrent, mapEvents, upstreamNo, type WagonEvent } from './wagon.rules';

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
 * lekin kvota uchun qator baribir yoziladi. O'zi so'ragan vagonni qayta ochsa
 * kvota yemaydi: bir marta to'lagan narsasini qayta ko'rish yangi qidiruv emas.
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
    const wagonNo = normalizeWagonNo(dto.no);
    if (!wagonNo) throw new BadRequestException({ code: 'WAGON_NO_INVALID' });
    if (!this.upstream.configured) throw new ServiceUnavailableException({ code: 'WAGON_NOT_CONFIGURED' });
    if (!searchBucket.take(userId)) throw new HttpException({ code: 'RATE_LIMITED' }, 429);

    const row = await this.prisma.wagonSearch.findFirst({
      where: { wagonNo, createdAt: { gt: new Date(Date.now() - CACHE_MS) } },
      orderBy: { createdAt: 'desc' }, select: { userId: true, found: true, result: true },
    });
    // Natijasiz qator kesh emas (hozir yozilmaydi, ehtiyot uchun)
    const cached = row?.result ? { userId: row.userId, found: row.found, result: row.result as unknown as Stored } : null;
    const own = cached?.userId === userId;
    const q = await this.quota(userId);
    if (!own && !canSearch(q.subscriber, q.freeUsed, q.freeTotal)) throw new HttpException({ code: 'SUBSCRIPTION_REQUIRED', ...q }, 402);

    let found: boolean; let result: Stored;
    if (cached) {
      found = cached.found; result = cached.result;
    } else {
      let h: Awaited<ReturnType<DRailwayClient['history']>>;
      try { h = await this.upstream.history(upstreamNo(wagonNo)); }
      catch (e) {
        // Sabab faqat logda: upstream manzili yoki javobi mijozga chiqmasin
        console.error('wagon upstream', (e as Error).message);
        await this.audit.log({ actorId: userId, action: 'wagon.search', entity: 'Wagon', entityId: wagonNo, meta: { error: true } });
        throw new HttpException({ code: 'WAGON_UPSTREAM' }, 502);
      }
      found = h !== null;
      result = { current: h ? deriveCurrent(h.events) : null, events: h ? mapEvents(h.events) : [], fetchedAt: new Date().toISOString() };
    }
    if (!own) {
      await this.prisma.wagonSearch.create({ data: { userId, wagonNo, found, result: result as unknown as Prisma.InputJsonValue } });
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
