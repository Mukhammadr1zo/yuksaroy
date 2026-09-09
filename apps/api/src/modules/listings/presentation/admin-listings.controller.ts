import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { LISTING_STATUSES } from '@yuksaroy/domain';
import { CurrentUserId, JwtGuard } from '../../identity/presentation/jwt.guard';
import { AuditService } from '../../../common/audit.service';
import { pickIn } from '../../catalog/presentation/catalog.controller';
import { ListingsUseCase } from '../application/listings.usecase';
import { PlatformAdmin } from '../../organizations/application/platform-admin';
import { PrismaListingRepository } from '../infrastructure/prisma-listing.repository';
import { DecideDto } from './dto';
import { ownerListing } from './mappers';

/** Moderatsiya: faqat platforma admini (rol yoki PLATFORM_ADMIN_PHONES). */
@ApiTags('admin')
@ApiCookieAuth('ys_access')
@Controller('admin/listings')
@UseGuards(JwtGuard)
export class AdminListingsController {
  constructor(
    private readonly repo: PrismaListingRepository,
    private readonly listings: ListingsUseCase,
    private readonly admin: PlatformAdmin,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(@CurrentUserId() userId: string, @Query('status') status?: string) {
    await this.admin.assertPlatformAdmin(userId);
    return (await this.repo.listByStatus(pickIn(status, LISTING_STATUSES) ?? 'PENDING_REVIEW')).map(ownerListing);
  }

  @Post(':id/decide')
  @HttpCode(200)
  async decide(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: DecideDto) {
    await this.admin.assertPlatformAdmin(userId);
    const l = await this.listings.decide(id, dto.approve, dto.reason ?? null);
    await this.audit.log({ actorId: userId, action: 'listing.decide', entity: 'Listing', entityId: id, meta: { approve: dto.approve, reason: dto.reason ?? null } });
    return ownerListing(l);
  }
}
