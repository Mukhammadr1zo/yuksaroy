import { Body, Controller, Delete, Get, HttpException, Param, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { Prisma } from '@prisma/client';
import { DEAL_KINDS, LISTING_KINDS, REGIONS, TRUCK_TYPES, WATCH_KINDS, WATCH_MAX, pickParams, watchSlot, type WatchKind } from '@yuksaroy/domain';
import { IpBucket } from '../../common/ip-bucket';
import { PrismaService } from '../../common/prisma.service';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { serialize } from '../wagon/wagon.rules';

/**
 * Oq ro'yxat bu yerda ham amal qiladi: ValidationPipe `whitelist: true` bilan ishlaydi,
 * ya'ni e'lon qilinmagan maydon so'rovdan butunlay tushadi, @IsIn esa qiymatni
 * chegaralaydi. pickParams bazaga yozishdan oldin ikkinchi marta filtrlaydi: qoida
 * bitta joyda (domen) va nazoratchi unga faqat suyanadi.
 */
class WatchDto {
  @IsIn(WATCH_KINDS) kind!: WatchKind;
  @IsOptional() @IsIn(REGIONS) fromRegion?: string;
  @IsOptional() @IsIn(REGIONS) toRegion?: string;
  @IsOptional() @IsIn(REGIONS) regionCode?: string;
  @IsOptional() @IsIn(TRUCK_TYPES) truckType?: string;
  @IsOptional() @IsIn(LISTING_KINDS) listingKind?: string;
  @IsOptional() @IsIn(DEAL_KINDS) deal?: string;
}

// Kuzatuv qo'shish kamdan-kam amal: soatiga 20 ta urinish yetadi
const addBucket = new IpBucket(20, 3_600_000);

@ApiTags('watch')
@ApiCookieAuth('ys_access')
@Controller('watches')
@UseGuards(JwtGuard)
export class WatchController {
  constructor(private readonly prisma: PrismaService) {}

  /** Mening kuzatuvlarim. Ro'yxat qisqa (WATCH_MAX), sahifalash kerak emas. */
  @Get()
  async list(@CurrentUserId() userId: string) {
    const items = await this.prisma.watch.findMany({
      where: { userId }, select: { id: true, kind: true, params: true, createdAt: true }, orderBy: { createdAt: 'desc' },
    });
    return { items, max: WATCH_MAX };
  }

  /**
   * Kuzatuv qo'shish.
   *
   * Bitta odam navbat bilan: sanoq o'qilishi va yozuv orasiga uning ikkinchi
   * oynasidagi so'rovi kirmasin, aks holda chegara 10 dan oshib ketardi.
   */
  @Post()
  add(@CurrentUserId() userId: string, @Body() dto: WatchDto) {
    if (!addBucket.take(userId)) throw new HttpException({ code: 'RATE_LIMITED' }, 429);
    return serialize(`watch:${userId}`, () => this.save(userId, dto));
  }

  /** Bitta o'qish ikki qoidaga javob beradi: aynan shunday kuzatuv bormi va joy bormi. */
  private async save(userId: string, dto: WatchDto) {
    const params = pickParams(dto.kind, dto as unknown as Record<string, unknown>);
    const mine = await this.prisma.watch.findMany({ where: { userId }, select: { id: true, userId: true, kind: true, params: true } });
    const slot = watchSlot(mine, dto.kind, params);
    // Takroriy bosish yangi kuzatuv ochmaydi va o'ninchi joyni yemaydi
    if ('same' in slot) return { id: slot.same, kind: dto.kind, params };
    if ('full' in slot) throw new HttpException({ code: 'WATCH_LIMIT', max: WATCH_MAX }, 409);
    return this.prisma.watch.create({
      data: { userId, kind: dto.kind, params: params as Prisma.InputJsonValue },
      select: { id: true, kind: true, params: true, createdAt: true },
    });
  }

  /** O'chirish faqat o'ziniki: begona id hech narsa qilmaydi va bor-yo'qligini aytmaydi. */
  @Delete(':id')
  async remove(@CurrentUserId() userId: string, @Param('id') id: string) {
    const r = await this.prisma.watch.deleteMany({ where: { id, userId } });
    return { removed: r.count };
  }
}
