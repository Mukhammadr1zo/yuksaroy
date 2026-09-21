import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserId, JwtGuard } from '../../identity/presentation/jwt.guard';
import { AuditService } from '../../../common/audit.service';
import { ImpressionsService } from '../../impressions/impressions.service';
import { ListingAccess } from '../application/listing-access';
import { ListingsUseCase } from '../application/listings.usecase';
import { PrismaListingRepository } from '../infrastructure/prisma-listing.repository';
import { CreateListingDto, InquiryDto, UpdateListingDto, listingPatch, toListingInput } from './dto';
import { ownerListing } from './mappers';

/** Egasi kabineti va so'rovlar: faqat kirgan foydalanuvchi; ruxsat use-case ichida (ListingAccess). */
@ApiTags('listings-owner')
@ApiCookieAuth('ys_access')
@Controller()
@UseGuards(JwtGuard)
export class ListingsOwnerController {
  constructor(
    private readonly repo: PrismaListingRepository,
    private readonly listings: ListingsUseCase,
    private readonly access: ListingAccess,
    private readonly audit: AuditService,
    private readonly impressions: ImpressionsService,
  ) {}

  /** Foydalanuvchi tashkilotlarining va shaxsiy e'lonlari (har qanday holat). */
  @Get('listings/mine')
  async mine(@CurrentUserId() userId: string) {
    const rows = await this.repo.listMine(userId, await this.access.orgIdsOf(userId));
    // Ko'rishlar soni mayoqlardan: Listing.views kesh sababli kam sanaydi va egasini chalg'itardi
    const views = await this.impressions.detailViews('listing', rows.map((r) => r.id));
    return rows.map((r) => ({ ...ownerListing(r), views: views[r.id] ?? 0 }));
  }

  @Post('listings')
  async create(@CurrentUserId() userId: string, @Body() dto: CreateListingDto) {
    const { orgId, ...body } = dto;
    const { listing, warnings } = await this.listings.create(userId, orgId ?? null, toListingInput(body));
    await this.audit.log({ actorId: userId, action: 'listing.create', entity: 'Listing', entityId: listing.id, meta: { orgId: orgId ?? null, ownerUserId: listing.ownerUserId, kind: listing.kind } });
    return { ...ownerListing(listing), warnings };
  }

  @Patch('listings/:id')
  async update(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: UpdateListingDto) {
    const patch = listingPatch(dto);
    const { listing, warnings } = await this.listings.update(userId, id, patch);
    await this.audit.log({ actorId: userId, action: 'listing.update', entity: 'Listing', entityId: id, meta: { fields: Object.keys(patch) } });
    return { ...ownerListing(listing), warnings };
  }

  /** DRAFT/REJECTED/ARCHIVED/EXPIRED -> PENDING_REVIEW; tashkilot KYC VERIFIED bo'lsa darhol ACTIVE. */
  @Post('listings/:id/publish')
  @HttpCode(200)
  async publish(@CurrentUserId() userId: string, @Param('id') id: string) {
    const l = await this.listings.publish(userId, id);
    await this.audit.log({ actorId: userId, action: 'listing.publish', entity: 'Listing', entityId: id, meta: { status: l.status } });
    return ownerListing(l);
  }

  @Post('listings/:id/archive')
  @HttpCode(200)
  async archive(@CurrentUserId() userId: string, @Param('id') id: string) {
    const l = await this.listings.archive(userId, id);
    await this.audit.log({ actorId: userId, action: 'listing.archive', entity: 'Listing', entityId: id });
    return ownerListing(l);
  }

  /** Faqat qoralama o'chiriladi; qolganlari arxivlanadi. */
  @Delete('listings/:id')
  async remove(@CurrentUserId() userId: string, @Param('id') id: string) {
    const l = await this.listings.remove(userId, id);
    await this.audit.log({ actorId: userId, action: 'listing.delete', entity: 'Listing', entityId: id, meta: { slug: l.slug } });
    return { id, deleted: true };
  }

  /** Narx so'rash: xabar e'lon egasiga; tashkilot ixtiyoriy. */
  @Post('listings/:id/inquiries')
  async inquire(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: InquiryDto) {
    const i = await this.listings.inquire(userId, id, dto.message, dto.orgId ?? null, dto.attachments);
    await this.audit.log({ actorId: userId, action: 'inquiry.create', entity: 'Inquiry', entityId: i.id, meta: { listingId: id, orgId: dto.orgId ?? null } });
    return i;
  }
}
