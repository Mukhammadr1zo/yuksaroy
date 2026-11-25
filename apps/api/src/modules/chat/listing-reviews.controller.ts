import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { AuditService } from '../../common/audit.service';
import { ListingReviewsService } from './listing-reviews.service';

class CreateReviewDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @Length(0, 1000) text?: string;
}
class ReplyDto {
  @IsString() @Length(1, 1000) reply!: string;
}

/** E'lon izohlari: ro'yxat ochiq, yozish uchun kirish va ikki tomonli yozishma kerak. */
@ApiTags('listings')
@Controller()
export class ListingReviewsController {
  constructor(private readonly reviews: ListingReviewsService, private readonly audit: AuditService) {}

  @Get('listings/:slug/reviews')
  list(@Param('slug') slug: string, @Query('page') page?: string) {
    return this.reviews.list(slug, Math.max(1, Number(page) || 1));
  }

  @Get('listings/:id/reviews/mine') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access')
  eligibility(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.reviews.eligibility(userId, id);
  }

  @Post('listings/:id/reviews') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access')
  async create(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: CreateReviewDto) {
    const r = await this.reviews.create(userId, id, dto.rating, dto.text?.trim() || null);
    await this.audit.log({ actorId: userId, action: 'listing.review.create', entity: 'ListingReview', entityId: r.id, meta: { listingId: id, rating: r.rating } });
    return r;
  }

  @Post('listing-reviews/:id/reply') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access')
  async reply(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: ReplyDto) {
    const { listingId, ...r } = await this.reviews.reply(userId, id, dto.reply);
    await this.audit.log({ actorId: userId, action: 'listing.review.reply', entity: 'ListingReview', entityId: id, meta: { listingId } });
    return r;
  }
}
