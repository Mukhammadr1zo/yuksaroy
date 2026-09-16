import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { LISTING_STATUSES } from '@yuksaroy/domain';
import { CurrentUserId, JwtGuard } from '../../identity/presentation/jwt.guard';
import { AuditService } from '../../../common/audit.service';
import { clampInt, pickIn } from '../../catalog/presentation/catalog.controller';
import { ListingsUseCase } from '../application/listings.usecase';
import { PrismaListingRepository } from '../infrastructure/prisma-listing.repository';
import { DecideDto } from './dto';
import { ownerListing } from './mappers';
import { PlatformAdminGuard } from '../../organizations/presentation/platform-admin.guard';

/** Moderatsiya: faqat platforma admini (rol yoki PLATFORM_ADMIN_PHONES). */
@ApiTags('admin')
@ApiCookieAuth('ys_access')
@Controller('admin/listings')
@UseGuards(JwtGuard, PlatformAdminGuard)
export class AdminListingsController {
  constructor(
    private readonly repo: PrismaListingRepository,
    private readonly listings: ListingsUseCase,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(
    @CurrentUserId() userId: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = clampInt(page, 1, 1, 10_000);
    const take = clampInt(limit, 30, 1, 100);
    const { rows, total } = await this.repo.listByStatus(pickIn(status, LISTING_STATUSES) ?? 'PENDING_REVIEW', { q, skip: (p - 1) * take, take });
    return { items: rows.map(ownerListing), total, page: p, limit: take };
  }

  @Post(':id/decide')
  @HttpCode(200)
  async decide(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: DecideDto) {
    const l = await this.listings.decide(id, dto.approve, dto.reason ?? null);
    await this.audit.log({ actorId: userId, action: 'listing.decide', entity: 'Listing', entityId: id, meta: { approve: dto.approve, reason: dto.reason ?? null } });
    return ownerListing(l);
  }
}
