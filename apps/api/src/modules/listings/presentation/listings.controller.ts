import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DEAL_KINDS, LISTING_KINDS, REGIONS, distanceKm } from '@yuksaroy/domain';
import { PrismaService } from '../../../common/prisma.service';
import { ImpressionsService } from '../../impressions/impressions.service';
import { clampInt, geoNear, listIn, pickIn } from '../../catalog/presentation/catalog.controller';
import { corridorMatch, parseCorridor, summarizeListings } from '../domain/listing-query';
import { ownerSignal } from '../application/owner-signal';
import { PrismaListingRepository } from '../infrastructure/prisma-listing.repository';
import { listingCard, listingDetail } from './mappers';

const SORTS = ['new', 'price', 'nearest'] as const;

/** Ochiq e'lonlar: hamma ko'radi, telefon raqami javobda yo'q (u /contacts orqali). */
@ApiTags('listings')
@Controller('listings')
export class ListingsController {
  constructor(
    private readonly repo: PrismaListingRepository,
    private readonly prisma: PrismaService,
    private readonly impressions: ImpressionsService,
  ) {}

  /** `kind`, `region` vergulli; `region` bazaviy viloyat YOKI xizmat hududi; `corridor=A>B`; `near=lng,lat&radius`. */
  @Get()
  async list(
    @Query('kind') kind?: string, @Query('deal') deal?: string, @Query('region') region?: string,
    @Query('near') near?: string, @Query('radius') radius?: string, @Query('corridor') corridor?: string,
    @Query('q') q?: string, @Query('sort') sort?: string, @Query('page') page?: string, @Query('limit') limit?: string,
  ) {
    const now = new Date(), geo = geoNear(near, radius), path = parseCorridor(corridor);
    let all = await this.repo.listPublic({ kinds: listIn(kind, LISTING_KINDS), deal: pickIn(deal, DEAL_KINDS), regions: listIn(region, REGIONS), q: q?.trim() || undefined }, now);
    if (geo) all = all.filter((l) => l.lat != null && l.lng != null && distanceKm(geo.lat, geo.lng, l.lat, l.lng) <= geo.radiusKm);
    if (path) all = all.filter((l) => corridorMatch(l, path));
    const s = pickIn(sort, SORTS) ?? 'new';
    if (s === 'price') all.sort((a, b) => (a.priceTiyin ?? Infinity) - (b.priceTiyin ?? Infinity));
    if (s === 'nearest' && geo) all.sort((a, b) => distanceKm(geo.lat, geo.lng, a.lat!, a.lng!) - distanceKm(geo.lat, geo.lng, b.lat!, b.lng!));
    // Premium (premiumUntil > now) tanlangan tartib ichida oldinga; barqaror sort guruh ichidagi tartibni saqlaydi
    const prem = (l: { premiumUntil: Date | null }) => l.premiumUntil !== null && l.premiumUntil > now;
    all.sort((a, b) => Number(prem(b)) - Number(prem(a)));
    const p = clampInt(page, 1, 1, 1000), l = clampInt(limit, 20, 1, 50);
    const pageRows = all.slice((p - 1) * l, p * l);
    // Bitta guruhli so'rov butun sahifaga: e'lon boshiga so'rov yuborilmaydi
    const views = await this.impressions.detailViews('listing', pageRows.map((x) => x.id));
    return {
      items: pageRows.map((x) => ({ ...listingCard(x, geo, now), views: views[x.id] ?? 0 })),
      total: all.length, page: p, limit: l,
      summary: summarizeListings(all, geo),
    };
  }

  @Get(':slug')
  async detail(@Param('slug') slug: string) {
    const l = await this.repo.findBySlug(slug);
    if (!l || l.status !== 'ACTIVE') throw new NotFoundException({ code: 'LISTING_NOT_FOUND' });
    // Signal faqat tafsilotda: kartaga ham qo'yilsa har ro'yxat uchun o'nlab
    // qo'shimcha so'rov bo'lardi va karta bu gap uchun baribir juda tor
    const [views, signal] = await Promise.all([
      this.impressions.detailViews('listing', [l.id]),
      ownerSignal(this.prisma, l),
    ]);
    return { ...listingDetail(l), views: views[l.id] ?? 0, signal };
  }
}
