import { Body, Controller, Get, HttpCode, HttpException, Ip, Param, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsString, Length, ValidateNested } from 'class-validator';
import { IMPRESSION_SURFACES, type ImpressionSurface } from '@yuksaroy/domain';
import { IpBucket } from '../../common/ip-bucket';
import { PrismaService } from '../../common/prisma.service';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { ListingsUseCase } from '../listings/application/listings.usecase';
import { OrderAccess } from '../orders/application/order-access';
import { ImpressionsService, type ImpressionKind } from './impressions.service';

class ImpressionItemDto {
  @IsIn(['listing', 'terminal', 'org']) kind!: ImpressionKind;
  @IsString() @Length(1, 40) targetId!: string;
  @IsIn(IMPRESSION_SURFACES) surface!: ImpressionSurface;
}
class ImpressionsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => ImpressionItemDto) items!: ImpressionItemDto[];
}

const bucket = new IpBucket(60, 60_000); // bitta IP: daqiqasiga 60 ta so'rov
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
  record(@Ip() ip: string, @Body() dto: ImpressionsDto) {
    if (!bucket.take(ip ?? '?')) throw new HttpException({ code: 'RATE_LIMITED' }, 429);
    return this.impressions.record(dto.items);
  }

  /** E'lon egasi: yuzalar bo'yicha ko'rsatishlar + so'rovlar (30 kun) + jami ko'rishlar. */
  @Get('listings/:id/analytics') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access')
  async listing(@CurrentUserId() userId: string, @Param('id') id: string) {
    const l = await this.listings.owned(userId, id);
    const now = new Date();
    const [s, inquiries] = await Promise.all([
      this.impressions.series('listing', id, now),
      this.prisma.inquiry.count({ where: { listingId: id, createdAt: { gte: since30(now) } } }),
    ]);
    return { ...s, inquiries, views: l.views };
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
