import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { REVIEW } from '@yuksaroy/domain';
import { AuditService } from '../../common/audit.service';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { clampInt } from '../catalog/presentation/catalog.controller';
import { ReviewsService } from './reviews.service';

class CreateReviewDto {
  @IsInt() @Min(REVIEW.min) @Max(REVIEW.max) rating!: number;
  @IsOptional() @IsString() @MaxLength(REVIEW.maxText) text?: string;
}
class ReplyDto {
  @IsString() @Length(1, REVIEW.maxText) reply!: string;
}

/** Baholar: yozish faqat kirganlarga (ruxsat servis ichida), o'qish ochiq. */
@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService, private readonly audit: AuditService) {}

  /** Faqat DONE buyurtmaning yuk egasi tashkiloti a'zosi; bitta buyurtmaga bitta baho. */
  @Post('orders/:no/review') @HttpCode(201) @UseGuards(JwtGuard) @ApiCookieAuth('ys_access')
  async create(@CurrentUserId() userId: string, @Param('no') no: string, @Body() dto: CreateReviewDto) {
    const r = await this.reviews.create(userId, no, dto.rating, dto.text?.trim() || null);
    await this.audit.log({ actorId: userId, action: 'review.create', entity: 'Review', entityId: r.id, meta: { orderNo: no, terminalId: r.terminalId, rating: dto.rating } });
    return r;
  }

  /** Buyurtma sahifasi: baho bormi (tomonlar uchun). */
  @Get('orders/:no/review') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access')
  forOrder(@CurrentUserId() userId: string, @Param('no') no: string) {
    return this.reviews.forOrder(userId, no);
  }

  /** Terminal xodimi javobi. */
  @Post('reviews/:id/reply') @HttpCode(200) @UseGuards(JwtGuard) @ApiCookieAuth('ys_access')
  async reply(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: ReplyDto) {
    const r = await this.reviews.reply(userId, id, dto.reply.trim());
    await this.audit.log({ actorId: userId, action: 'review.reply', entity: 'Review', entityId: id, meta: { terminalId: r.terminalId } });
    return r;
  }

  @Get('terminals/:slug/reviews')
  list(@Param('slug') slug: string, @Query('page') page?: string) {
    return this.reviews.listForTerminal(slug, clampInt(page, 1, 1, 1000));
  }
}
