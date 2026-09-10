import { Controller, Get, NotFoundException, Param, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { DEAL_KINDS, LISTING_KINDS, REGIONS, distanceKm } from '@yuksaroy/domain';
import { TokenService } from '../../identity/application/token.service';
import { ACCESS_COOKIE } from '../../identity/presentation/jwt.guard';
import { clampInt, geoNear, listIn, pickIn } from '../../catalog/presentation/catalog.controller';
import { corridorMatch, parseCorridor, summarizeListings } from '../domain/listing-query';
import { PrismaListingRepository } from '../infrastructure/prisma-listing.repository';
import { listingCard, listingDetail } from './mappers';

const SORTS = ['new', 'price', 'nearest'] as const;

/** Ochiq e'lonlar: narx hammaga, telefon faqat kirganlarga (cookie yoki Bearer bo'lsa). */
@ApiTags('listings')
@Controller('listings')
export class ListingsController {
  constructor(private readonly repo: PrismaListingRepository, private readonly tokens: TokenService) {}

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
    return {
      items: all.slice((p - 1) * l, p * l).map((x) => listingCard(x, geo, now)),
      total: all.length, page: p, limit: l,
      summary: summarizeListings(all, geo),
    };
  }

  @Get(':slug')
  async detail(@Param('slug') slug: string, @Req() req: FastifyRequest) {
    const l = await this.repo.findBySlug(slug);
    if (!l || l.status !== 'ACTIVE') throw new NotFoundException({ code: 'LISTING_NOT_FOUND' });
    this.repo.bumpViews(l.id);
    return listingDetail(l);
  }

  /** Ixtiyoriy kirish: token bo'lsa va to'g'ri bo'lsa foydalanuvchi, aks holda mehmon. */
  private userIdOf(req: FastifyRequest): string | null {
    const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined;
    const token = bearer ?? (req as any).cookies?.[ACCESS_COOKIE];
    if (!token) return null;
    try { return this.tokens.verifyAccess(token).sub; } catch { return null; }
  }
}
