import { Controller, Get, Header, Inject, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EQUIPMENT_KINDS, REGIONS, RJUS, SEARCH_CATEGORIES, SERVICE_CODES, TERMINAL_KINDS, distanceKm, type ListingKind, type Rju, type ServiceCode, type TerminalKind } from '@yuksaroy/domain';
import { parseCorridor } from '../../listings/domain/listing-query';
import { PrismaListingRepository } from '../../listings/infrastructure/prisma-listing.repository';
import { CATALOG_REPOSITORY, type CatalogRepository } from '../domain/ports';
import { mapFeatures, parseBbox } from './map-geojson';
import { byDefault, fromPriceTiyin, publicSiding, publicTerminal, publicTerminalCard, summarize } from './mappers';

/** Ro'yxatdan tanlash: noto'g'ri qiymat = filtr yo'q. */
export const pickIn = <T extends string>(v: string | undefined, list: readonly T[]): T | undefined => (list as readonly string[]).includes(v ?? '') ? (v as T) : undefined;
/** Vergulli ro'yxat: `UZ-TO,UZ-TK` → tanilgan kodlar; noto'g'rilari tashlab yuboriladi. */
export const listIn = <T extends string>(v: string | undefined, list: readonly T[]): T[] =>
  (v ?? '').split(',').map((s) => s.trim()).filter((s): s is T => (list as readonly string[]).includes(s));
export const clampInt = (v: string | undefined, def: number, min: number, max: number) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const SORTS = ['default', 'rating', 'price', 'name', 'nearest'] as const;
/** `station` parametri: ESR kodi (raqamlar) yoki stansiya id (cuid). */
const stationParam = (v: string | undefined) => (v ? (/^\d{5,6}$/.test(v) ? { stationEsr: v } : { stationId: v }) : {});
/** Viloyat poligonlari (seed ma'lumoti, ODbL). Bir marta o'qiladi. */
const REGIONS_FILE = resolve(__dirname, '../../../../prisma/seed/data/uz-regions.geojson');
let regionsGeo: unknown; // ponytail: fayl ~160 KB (1 MB dan kichik), Douglas-Peucker soddalashtirish yo'q; fayl 1 MB dan oshsa qo'shiladi

/** Ochiq katalog: login talab qilinmaydi, ISR/`use cache` bilan web'da keshlanadi. */
@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(@Inject(CATALOG_REPOSITORY) private readonly repo: CatalogRepository, private readonly listings: PrismaListingRepository) {}

  @Get('stations')
  stations(@Query('q') q = '', @Query('rju') rju?: string, @Query('limit') limit?: string) {
    return this.repo.searchStations(q.trim(), pickIn(rju, RJUS), clampInt(limit, 20, 1, 300));
  }

  @Get('stations/:esr')
  async station(@Param('esr') esr: string) {
    const s = await this.repo.findStationByEsr(esr);
    if (!s) throw new NotFoundException({ code: 'STATION_NOT_FOUND' });
    return s;
  }

  @Get('cargo-types')
  cargoTypes(@Query('q') q = '', @Query('limit') limit?: string) {
    return this.repo.searchCargoTypes(q.trim(), clampInt(limit, 20, 1, 500));
  }

  /** `region` va `service` vergulli ro'yxat bo'lishi mumkin: region IN, service AND. */
  @Get('terminals')
  async terminals(
    @Query('station') station?: string, @Query('rju') rju?: string, @Query('kind') kind?: string, @Query('service') service?: string,
    @Query('q') q?: string, @Query('sort') sort?: string, @Query('page') page?: string, @Query('limit') limit?: string,
    @Query('region') region?: string, @Query('near') near?: string, @Query('radius') radius?: string, @Query('bookable') bookable?: string,
  ) {
    const now = new Date(), geo = geoNear(near, radius);
    const services = listIn(service, SERVICE_CODES), regions = listIn(region, REGIONS);
    const found = await this.repo.listTerminals(
      {
        ...stationParam(station), rju: pickIn(rju, RJUS), kind: pickIn(kind, TERMINAL_KINDS),
        service: services.length ? services : undefined, q: q?.trim() || undefined,
        region: regions.length ? regions : undefined, near: geo,
        owned: true, // terminalni faqat egasi qo'shadi: egasiz obyekt ochiq katalogda yo'q
      },
      now,
    );
    const free = await this.repo.freeTodayByTerminal(found.map((t) => t.id), now);
    // bookable=1: faqat bugun bo'sh sloti borlar (bron sahifasi CTA)
    const all = bookable === '1' ? found.filter((t) => (free[t.id] ?? 0) > 0) : found;
    const s = pickIn(sort, SORTS) ?? 'default';
    // Sukut: egasi bor obyektlar oldinda; 'rating' repository tartibida (ratingAvg desc) qoladi
    if (s === 'default') all.sort(byDefault(geo));
    if (s === 'price') all.sort((a, b) => (fromPriceTiyin(a) ?? Infinity) - (fromPriceTiyin(b) ?? Infinity));
    if (s === 'name') all.sort((a, b) => a.name.localeCompare(b.name));
    // near berilganda koordinatasizlar repository'da allaqachon chiqarib tashlangan
    if (s === 'nearest' && geo) all.sort((a, b) => distanceKm(geo.lat, geo.lng, a.lat!, a.lng!) - distanceKm(geo.lat, geo.lng, b.lat!, b.lng!));
    const p = clampInt(page, 1, 1, 1000), l = clampInt(limit, 20, 1, 50);
    return {
      items: all.slice((p - 1) * l, p * l).map((t) => publicTerminalCard(t, free[t.id] ?? 0, geo)),
      total: all.length, page: p, limit: l,
      summary: summarize(all, free, geo, services),
    };
  }

  @Get('terminals/:slug')
  async terminal(@Param('slug') slug: string) {
    const now = new Date();
    const t = await this.repo.findTerminalBySlug(slug, now);
    if (!t || t.status !== 'ACTIVE' || t.orgId === null) throw new NotFoundException({ code: 'TERMINAL_NOT_FOUND' });
    const free = await this.repo.freeTodayByTerminal([t.id], now);
    return publicTerminal(t, free[t.id] ?? 0);
  }

  @Get('sidings')
  async sidings(
    @Query('station') station?: string, @Query('rju') rju?: string, @Query('q') q?: string,
    @Query('page') page?: string, @Query('limit') limit?: string,
    @Query('region') region?: string, @Query('near') near?: string, @Query('radius') radius?: string,
  ) {
    const r = await this.repo.listSidings(
      { ...stationParam(station), rju: pickIn(rju, RJUS), q: q?.trim() || undefined, region: pickIn(region, REGIONS), near: geoNear(near, radius) },
      clampInt(page, 1, 1, 10000), clampInt(limit, 30, 1, 100),
    );
    return { ...r, items: r.items.map(publicSiding) };
  }

  @Get('sidings/:id')
  async siding(@Param('id') id: string) {
    const s = await this.repo.findSidingById(id);
    if (!s) throw new NotFoundException({ code: 'SIDING_NOT_FOUND' });
    return publicSiding(s);
  }

  /** Xarita: platformadagi obyektlar (temir yo'l tarmog'i emas). */
  @Get('map-objects')
  mapObjects() {
    return this.repo.mapObjects();
  }

  /**
   * Xarita sahifasi: to'rt kategoriya bitta FeatureCollection'da (accuracy: exact / station / region).
   * `cat` vergulli (default hammasi), `bbox=W,S,E,N`, `region` vergulli, `corridor=A>B`. Eski `map-objects` o'zgarmagan.
   */
  @Get('map-objects.geojson')
  @Header('Cache-Control', 'public, max-age=60, s-maxage=60')
  async mapGeojson(@Query('cat') cat?: string, @Query('bbox') bbox?: string, @Query('region') region?: string, @Query('corridor') corridor?: string) {
    const now = new Date(), regions = listIn(region, REGIONS);
    const picked = listIn(cat, SEARCH_CATEGORIES), cats = picked.length ? picked : [...SEARCH_CATEGORIES];
    const kinds: ListingKind[] = [...(cats.includes('equipment') ? EQUIPMENT_KINDS : []), ...(cats.includes('truck') ? (['TRUCK'] as const) : [])];
    const [terminals, objects, listings] = await Promise.all([
      cats.includes('terminal') ? this.repo.listTerminals({ region: regions.length ? regions : undefined, owned: true }, now) : [],
      cats.includes('siding') ? this.repo.mapObjects() : null,
      kinds.length ? this.listings.listPublic({ kinds, regions }, now) : [],
    ]);
    const free = terminals.length ? await this.repo.freeTodayByTerminal(terminals.map((t) => t.id), now) : {};
    const sidings = (objects?.sidings ?? []).filter((g) => !regions.length || (g.regionCode !== null && (regions as string[]).includes(g.regionCode)));
    return mapFeatures({ terminals, free, sidings, listings }, { cats, bbox: parseBbox(bbox), corridor: parseCorridor(corridor) });
  }

  /** 14 viloyat poligoni: { code, name }. Statik, bir kun keshlanadi. */
  @Get('regions.geojson')
  @Header('Cache-Control', 'public, max-age=86400')
  regionsGeojson() {
    return (regionsGeo ??= JSON.parse(readFileSync(REGIONS_FILE, 'utf8')));
  }

  /** Landing ishonch belgilari: jonli raqamlar. */
  @Get('stats')
  stats() {
    return this.repo.publicStats();
  }
}

export type { Rju, ServiceCode, TerminalKind };


/** `?near=69.24,41.20&radius=25` → radius bo'yicha qidiruv. Noto'g'ri qiymat e'tiborsiz qoldiriladi. */
export function geoNear(near?: string, radius?: string) {
  if (!near) return undefined;
  const [lng, lat] = near.split(',').map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  const r = Number(radius);
  return { lat: lat!, lng: lng!, radiusKm: Number.isFinite(r) ? Math.min(300, Math.max(1, r)) : 25 };
}
