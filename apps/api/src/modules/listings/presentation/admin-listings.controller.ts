import { BadRequestException, Body, Controller, Get, HttpCode, HttpException, NotFoundException, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, Length } from 'class-validator';
import type { FastifyReply } from 'fastify';
import { LISTING_STATUSES } from '@yuksaroy/domain';
import { CurrentUserId, JwtGuard } from '../../identity/presentation/jwt.guard';
import { AuditService } from '../../../common/audit.service';
import { CSV_MAX, sendCsv, type CsvCols } from '../../../common/csv';
import { BULK_MAX, orderByOf, parseIds, type SortAllow } from '../../../common/list-sort';
import { PrismaService } from '../../../common/prisma.service';
import { clampInt, pickIn } from '../../catalog/presentation/catalog.controller';
import { noteCount } from '../../admin/admin-notes.controller';
import { ListingsUseCase } from '../application/listings.usecase';
import type { ListingRecord } from '../domain/listing-query';
import { PrismaListingRepository } from '../infrastructure/prisma-listing.repository';
import { DecideDto } from './dto';
import { ownerListing } from './mappers';
import { PlatformAdminGuard } from '../../organizations/presentation/platform-admin.guard';

/** Ommaviy tortib olish: sabab majburiy, u egasiga ko'rinadi va xabar bilan ketadi. */
class BulkArchiveDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(BULK_MAX) @IsString({ each: true }) ids!: string[];
  @IsString() @Length(1, 500) reason!: string;
}

/** Narxsiz e'lonlar narx bo'yicha tartibda oxirida turadi. */
const SORT: SortAllow<Prisma.ListingOrderByWithRelationInput> = {
  createdAt: { def: 'desc' }, updatedAt: { def: 'asc' }, title: { def: 'asc' },
  priceTiyin: { def: 'asc', by: (d) => ({ priceTiyin: { sort: d, nulls: 'last' } }) },
};

/** CSV: narx so'mda (repo priceTiyin ni Number qilib beradi), egasi tashkilot yoki odam. */
const CSV: CsvCols<ListingRecord> = {
  id: (r) => r.id, title: (r) => r.title, slug: (r) => r.slug, kind: (r) => r.kind, status: (r) => r.status, regionCode: (r) => r.regionCode,
  priceSom: (r) => (r.priceTiyin === null ? null : r.priceTiyin / 100),
  owner: (r) => r.org?.name ?? r.ownerUser?.fullName ?? r.ownerUser?.phone, createdAt: (r) => r.createdAt,
};

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
    private readonly prisma: PrismaService,
  ) {}

  /** ?sort&dir jadval sarlavhasidan, ?orgId|ownerUserId|terminalId obyekt sahifalari uchun, ?ids tanlov, ?format=csv eksport. */
  @Get()
  async list(
    @CurrentUserId() userId: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
    @Query('dir') dir?: string,
    @Query('ids') ids?: string,
    @Query('orgId') orgId?: string,
    @Query('ownerUserId') ownerUserId?: string,
    @Query('terminalId') terminalId?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) reply?: FastifyReply,
  ) {
    const p = clampInt(page, 1, 1, 10_000);
    const take = clampInt(limit, 30, 1, 100);
    const st = pickIn(status, LISTING_STATUSES) ?? 'PENDING_REVIEW';
    const opts = { q, orgId, ownerUserId, terminalId, ids: parseIds(ids), orderBy: orderByOf(sort, dir, SORT, 'updatedAt') };
    if (format === 'csv') {
      return sendCsv({
        reply: reply!, audit: this.audit, actorId: userId, resource: 'listings',
        filters: { status: st, q, orgId, ownerUserId, terminalId, ids, sort, dir },
        total: await this.repo.countByStatus(st, opts),
        rows: async () => (await this.repo.listByStatus(st, { ...opts, take: CSV_MAX })).rows,
        cols: CSV,
      });
    }
    const { rows, total } = await this.repo.listByStatus(st, { ...opts, skip: (p - 1) * take, take });
    return { items: rows.map(ownerListing), total, page: p, limit: take };
  }

  /**
   * E'lon obyekt sahifasi: egasi ko'rinishi + sonlar. Har son qaror uchun: yozishmalar
   * (talab bor), shikoyatlar (shikoyat va Premium bir joyda bo'lsa firibgarlik belgisi),
   * izohlar (kimdir ishlaganmi), Premium to'lovlari (to'lagan e'lonni tortib olishda pul
   * qaytarish savoli). Statik yo'llar parametrikdan ustun, bu kontrollerda boshqa GET yo'q.
   */
  @Get(':id')
  async one(@Param('id') id: string) {
    const l = await this.repo.findById(id);
    if (!l) throw new NotFoundException({ code: 'LISTING_NOT_FOUND' });
    const [inquiries, reports, notesCount, premiumOrders] = await Promise.all([
      this.prisma.inquiry.count({ where: { listingId: id } }),
      this.prisma.report.count({ where: { targetKind: 'listing', targetId: id } }),
      noteCount(this.prisma, 'Listing', id),
      this.prisma.premiumOrder.findMany({ where: { listingId: id }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, months: true, amountTiyin: true, status: true, paidAt: true, createdAt: true } }),
    ]);
    return {
      ...ownerListing(l),
      inquiries, reports, notesCount,
      premiumOrders: premiumOrders.map((o) => ({ ...o, amountTiyin: Number(o.amountTiyin) })), // BigInt JSON ga chiqmaydi
    };
  }

  @Post(':id/decide')
  @HttpCode(200)
  async decide(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: DecideDto) {
    // Sabab egasiga ko'rinadi va qayta yuborilgan e'lonni tekshiruvda ushlab turadi:
    // sababsiz rad etilsa e'lon ikkinchi bosishda hech kim ko'rmasdan katalogga tushardi
    if (!dto.approve && !dto.reason?.trim()) throw new BadRequestException({ code: 'REASON_REQUIRED' });
    const l = await this.listings.decide(id, dto.approve, dto.reason ?? null);
    await this.audit.log({ actorId: userId, action: 'listing.decide', entity: 'Listing', entityId: id, meta: { approve: dto.approve, reason: dto.reason ?? null } });
    return ownerListing(l);
  }

  /**
   * Ommaviy tortib olish serverda: faqat ACTIVE qatorlar (ACTIVE -> ARCHIVED, egasiga sabab
   * ko'rinadi, xabar ketadi), boshqa holatdagilar o'tkaziladi. Har qator mavjud decide()
   * orqali: bir xil o'tish qoidasi, bir xil xabar; audit har qatorga (jurnalda listing-decide-no).
   * ponytail: 500 e'longa 500 xabar, qabul qilingan.
   */
  @Post('bulk-archive')
  @HttpCode(200)
  async bulkArchive(@CurrentUserId() userId: string, @Body() dto: BulkArchiveDto) {
    const reason = dto.reason.trim();
    const active = await this.prisma.listing.findMany({ where: { id: { in: dto.ids }, status: 'ACTIVE' }, select: { id: true } });
    let done = 0;
    for (const { id } of active) {
      try {
        await this.listings.decide(id, false, reason);
        await this.audit.log({ actorId: userId, action: 'listing.decide', entity: 'Listing', entityId: id, meta: { approve: false, reason, bulk: true } });
        done += 1;
      } catch (e) {
        // Holat o'rtada o'zgargan (egasi arxivlagan, muddati o'tgan): o'tish qoidasi ConflictException
        // tashlaydi, u o'tkaziladi; aks holda oldingi qatorlar arxivlanib javob faqat xato bo'lardi.
        // Baza yoki tarmoq xatosi butun amalni to'xtatadi (bulkBlock bilan bir xil)
        if (!(e instanceof HttpException)) throw e;
      }
    }
    return { done, skipped: dto.ids.length - done };
  }
}
