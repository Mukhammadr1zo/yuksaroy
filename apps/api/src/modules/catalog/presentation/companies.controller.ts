import { Controller, Get, Inject, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { ORG_KINDS, REGIONS } from '@yuksaroy/domain';
import { PrismaService } from '../../../common/prisma.service';
import { listingCard } from '../../listings/presentation/mappers';
import { listingInclude, toRecord as toListingRecord } from '../../listings/infrastructure/prisma-listing.repository';
import type { Storefront } from '../../organizations/domain/ports';
import { CATALOG_REPOSITORY, type CatalogRepository } from '../domain/ports';
import { activeListing, visibleCompany as visible } from '../infrastructure/prisma-catalog.repository';
import { clampInt, pickIn } from './catalog.controller';
import { publicTerminalCard } from './mappers';

const cardSelect = (now: Date) => ({
  id: true, slug: true, name: true, kind: true, kinds: true, kycStatus: true, regionCode: true,
  // Shahobcha ham terminal: da'vosi tasdiqlangani orgId bilan terminals ichida sanaladi, alohida sanoq yo'q
  _count: { select: { terminals: { where: { status: 'ACTIVE' as const } }, listings: { where: activeListing(now) } } },
});
type CardRow = Prisma.OrganizationGetPayload<{ select: ReturnType<typeof cardSelect> }>;
const companyCard = (o: CardRow) => ({
  id: o.id, slug: o.slug, name: o.name, kinds: o.kinds.length ? o.kinds : [o.kind], kyc: o.kycStatus, regionCode: o.regionCode,
  counts: { terminals: o._count.terminals, listings: o._count.listings },
});

@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CATALOG_REPOSITORY) private readonly repo: CatalogRepository,
  ) {}

  @Get()
  async list(@Query('kind') kind?: string, @Query('region') region?: string, @Query('q') q?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    const now = new Date(), k = pickIn(kind, ORG_KINDS), p = clampInt(page, 1, 1, 1000), l = clampInt(limit, 20, 1, 50);
    const where: Prisma.OrganizationWhereInput = {
      ...visible(now),
      kinds: k ? { has: k } : undefined,
      regionCode: pickIn(region, REGIONS),
      name: q?.trim() ? { contains: q.trim(), mode: 'insensitive' } : undefined,
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({ where, select: cardSelect(now), orderBy: [{ name: 'asc' }], skip: (p - 1) * l, take: l }),
    ]);
    return { items: rows.map(companyCard), total, page: p, limit: l };
  }

  /** Telefon hammaga ochiq (egasi qarori): so'rov yuborish esa kirishni talab qiladi. */
  @Get(':slug')
  async detail(@Param('slug') slug: string) {
    const now = new Date();
    const o = await this.prisma.organization.findFirst({
      where: { slug, ...visible(now) },
      select: { ...cardSelect(now), description: true, telegram: true, website: true, phone: true, storefront: true },
    });
    if (!o) throw new NotFoundException({ code: 'COMPANY_NOT_FOUND' });
    const [terminals, listings] = await Promise.all([
      this.repo.listTerminals({ orgIds: [o.id], status: 'ACTIVE' }, now),
      this.prisma.listing.findMany({ where: { orgId: o.id, ...activeListing(now) }, include: listingInclude, orderBy: [{ publishedAt: 'desc' }], take: 100 }),
    ]);
    const free = await this.repo.freeTodayByTerminal(terminals.map((t) => t.id), now);
    const storefront = (o.storefront as Storefront | null) ?? null;
    // Telefon hammaga ochiq: kompaniya sahifasi ommaviy tijorat profili (so'rov yuborish esa kirish bilan)
    return {
      ...companyCard(o),
      description: o.description, telegram: o.telegram, website: o.website, phone: o.phone, storefront,
      terminals: terminals.map((t) => publicTerminalCard(t, free[t.id] ?? 0)),
      listings: listings.map((l) => listingCard(toListingRecord(l), undefined, now)),
    };
  }
}
