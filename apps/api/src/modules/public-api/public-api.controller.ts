import { CanActivate, Controller, ExecutionContext, Get, HttpException, Inject, Injectable, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { LISTING_KINDS, PUBLIC_API, REGIONS, SERVICE_CODES, TERMINAL_KINDS } from '@yuksaroy/domain';
import { IpBucket } from '../../common/ip-bucket';
import { clampInt, listIn, pickIn } from '../catalog/presentation/catalog.controller';
import { publicTerminalCard } from '../catalog/presentation/mappers';
import { CATALOG_REPOSITORY, type CatalogRepository } from '../catalog/domain/ports';
import { PrismaListingRepository } from '../listings/infrastructure/prisma-listing.repository';
import { listingCard } from '../listings/presentation/mappers';
import { facets } from './facets';
import { CHANGELOG, buildOntology } from './ontology';

const bucket = new IpBucket(PUBLIC_API.ratePerMinute, 60_000);

/** IP limiti va kontrakt sarlavhalari: 429 da ham x-ratelimit-* qaytadi. */
@Injectable()
class PublicRateGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>(), res = ctx.switchToHttp().getResponse<FastifyReply>();
    const ip = req.ip ?? '?', ok = bucket.take(ip);
    res.header('x-contract-version', PUBLIC_API.version);
    res.header('x-ratelimit-limit', String(PUBLIC_API.ratePerMinute));
    res.header('x-ratelimit-remaining', String(bucket.remaining(ip)));
    if (!ok) throw new HttpException({ code: 'RATE_LIMITED', limit: PUBLIC_API.ratePerMinute }, 429);
    res.header('Cache-Control', 'public, s-maxage=60');
    return true;
  }
}

/** Ochiq o'qish API: login yo'q, faqat ACTIVE obyektlar, telefon hech qachon chiqmaydi. */
@ApiTags('public')
@Controller('public')
@UseGuards(PublicRateGuard)
export class PublicApiController {
  constructor(@Inject(CATALOG_REPOSITORY) private readonly repo: CatalogRepository, private readonly listings: PrismaListingRepository) {}

  /** `kind`, `region` vergulli. Karta shakli /v1/listings bilan bir xil (telefon yo'q). */
  @Get('listings')
  async list(@Query('kind') kind?: string, @Query('region') region?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    const now = new Date(), p = clampInt(page, 1, 1, 1000), l = clampInt(limit, 20, 1, 50);
    const all = await this.listings.listPublic({ kinds: listIn(kind, LISTING_KINDS), regions: listIn(region, REGIONS) }, now);
    return { items: all.slice((p - 1) * l, p * l).map((x) => listingCard(x, undefined, now)), total: all.length, page: p, limit: l };
  }

  /** `region`, `service` vergulli (region IN, service AND). Karta shakli /v1/terminals bilan bir xil (telefon yo'q). */
  @Get('terminals')
  async terminals(@Query('region') region?: string, @Query('kind') kind?: string, @Query('service') service?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    const now = new Date(), p = clampInt(page, 1, 1, 1000), l = clampInt(limit, 20, 1, 50);
    const services = listIn(service, SERVICE_CODES), regions = listIn(region, REGIONS);
    const all = await this.repo.listTerminals({ kind: pickIn(kind, TERMINAL_KINDS), service: services.length ? services : undefined, region: regions.length ? regions : undefined }, now);
    const pageRows = all.slice((p - 1) * l, p * l);
    const free = await this.repo.freeTodayByTerminal(pageRows.map((t) => t.id), now);
    return { items: pageRows.map((t) => publicTerminalCard(t, free[t.id] ?? 0)), total: all.length, page: p, limit: l };
  }

  /** Sonlar: terminal turi, viloyat, xizmat; e'lon turi, viloyat, bitim. */
  @Get('facets')
  async facets() {
    const now = new Date();
    // ponytail: xotirada sanash (repo cheklovlari 200 terminal / 500 e'lon); undan oshsa Prisma groupBy
    const [terminals, listings] = await Promise.all([this.repo.listTerminals({}, now), this.listings.listPublic({ kinds: [], regions: [] }, now)]);
    return { version: PUBLIC_API.version, generatedAt: now.toISOString(), ...facets(terminals, listings) };
  }

  @Get('ontology')
  ontology() {
    return buildOntology();
  }

  @Get('changelog')
  changelog() {
    return CHANGELOG;
  }
}
