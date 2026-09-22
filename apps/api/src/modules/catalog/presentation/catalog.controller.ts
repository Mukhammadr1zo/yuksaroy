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
  constructor(
    @Inject(CATALOG_REPOSITORY) private readonly repo: CatalogRepository,
    private readonly listings: PrismaListingRepository,
  ) {}

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
    const s = pickIn(sort, SORTS) ?? 'default';
    const p = clampInt(page, 1, 1, 1000), l = clampInt(limit, 20, 1, 50);

    /*
     * Tanilmagan filtr qiymati bo'sh natija beradi, jimgina tashlab yuborilmaydi.
     *
     * Ilgari noto'g'ri yoki eskirgan kod (masalan ?region=UZ-YOQ) filtrni butunlay
     * yo'q qilar va katalog BUTUN ro'yxatni qaytarardi. Foydalanuvchi esa filtr
     * ishladi deb o'ylab, boshqa viloyatning terminallarini ko'rib o'tirardi.
     * Bo'sh natija esa rost: bunday viloyat yo'q va sahifa "topilmadi" deb aytadi.
     */
    const unknownRegion = !!region?.trim() && regions.length === 0;
    const unknownKind = !!kind?.trim() && pickIn(kind, TERMINAL_KINDS) === undefined;
    const unknownService = !!service?.trim() && services.length === 0;
    if (unknownRegion || unknownKind || unknownService) {
      return { items: [], total: 0, page: p, limit: l, summary: summarize([], {}, geo, services) };
    }
    const base = {
      ...stationParam(station), rju: pickIn(rju, RJUS), kind: pickIn(kind, TERMINAL_KINDS),
      service: services.length ? services : undefined, q: q?.trim() || undefined,
      region: regions.length ? regions : undefined, near: geo,
      // Ochiq katalog: egasi qo'shgan terminallar + reestrdan kelgan shahobchalar (temir yo'l terminali)
      publicCatalog: true,
    };

    /**
     * Ikki yo'l. "narx", "eng yaqin" va "bugun bo'sh joy" hisoblangan qiymatga tayanadi
     * (tarif, masofa, slot) va ularni baza tartiblay olmaydi. Lekin bunday qiymat faqat
     * egasi bor terminalda bo'ladi yoki radius bilan cheklangan, ya'ni to'plam kichik:
     * xotirada saralash xavfsiz. Qolgan tartiblar (sukut, baho, nom) butun katalog bo'ylab
     * ketadi, u yerda 1700+ obyekt bor, shuning uchun saralash ham, bo'lish ham bazada.
     */
    // `near` ham shu yo'ldan: baza to'rtburchakni sanaydi, radius esa doirani, ya'ni
    // bazadagi sanoq burchaklarga tushgan obyektlar hisobiga sal kattaroq chiqardi.
    // To'rtburchak to'plamni allaqachon kichraytirgani uchun aniq masofani shu yerda hisoblaymiz.
    const computed = s === 'nearest' || bookable === '1' || geo !== undefined;
    if (computed) {
      // Radius berilgan bo'lsa hamma tur (reestr ham) kiradi; aks holda faqat egali obyekt
      const pool = await this.repo.listTerminals(geo ? base : { ...base, publicCatalog: undefined, owned: true }, now);
      const free = await this.repo.freeTodayByTerminal(pool.map((t) => t.id), now);
      const all = bookable === '1' ? pool.filter((t) => (free[t.id] ?? 0) > 0) : pool;
      if (s === 'price') all.sort((a, b) => (fromPriceTiyin(a) ?? Infinity) - (fromPriceTiyin(b) ?? Infinity));
      // near berilganda koordinatasizlar repository'da allaqachon chiqarib tashlangan
      else if (s === 'nearest' && geo) all.sort((a, b) => distanceKm(geo.lat, geo.lng, a.lat!, a.lng!) - distanceKm(geo.lat, geo.lng, b.lat!, b.lng!));
      else all.sort(byDefault(geo));
      return {
        items: all.slice((p - 1) * l, p * l).map((t) => publicTerminalCard(t, free[t.id] ?? 0, geo)),
        total: all.length, page: p, limit: l,
        summary: summarize(all, free, geo, services),
      };
    }

    const off = (p - 1) * l;
    const [total, rich] = await Promise.all([
      this.repo.countTerminals(base),
      // Qaror satri (eng arzon, bugun bo'sh joy, baho) faqat egali obyektlarga tegishli:
      // reestr qatorida tarif ham, slot ham, baho ham yo'q, shuning uchun kichik to'plam yetarli
      this.repo.listTerminals({ ...base, publicCatalog: undefined, owned: true }, now),
    ]);

    /**
     * Narx bo'yicha saralash alohida yig'iladi. Tarif faqat egasi bor terminalda bo'ladi,
     * ya'ni narxlanganlar to'plami kichik (`rich`): ularni arzonidan tartiblab boshiga qo'yamiz,
     * qolganini (egasiz reestr) baza tartibida davom ettiramiz. Shunda ro'yxat ham, jami son ham
     * boshqa tartiblardagidek qoladi: ilgari bu saralash reestrni butunlay chiqarib yuborardi.
     */
    let pageRows: typeof rich;
    if (s === 'price') {
      const head = [...rich].sort((a, b) => (fromPriceTiyin(a) ?? Infinity) - (fromPriceTiyin(b) ?? Infinity));
      const fromHead = head.slice(off, off + l);
      const need = l - fromHead.length;
      const tail = need > 0
        // publicCatalog saqlanadi: u bilan birga `owned: false` aynan reestr quyrug'ini beradi
        // (egasiz VA temir yo'l). Olib tashlansa egasiz avto terminal ham kirib, boshqa
        // tartiblarda ko'rinmaydigan qator shu sahifada paydo bo'lardi.
        ? await this.repo.listTerminals({ ...base, owned: false, sort: 'default', skip: Math.max(0, off - head.length), take: need }, now)
        : [];
      pageRows = [...fromHead, ...tail];
    } else {
      pageRows = await this.repo.listTerminals(
        { ...base, sort: s === 'rating' ? 'rating' : s === 'name' ? 'name' : 'default', skip: off, take: l },
        now,
      );
    }
    const free = await this.repo.freeTodayByTerminal([...pageRows, ...rich].map((t) => t.id), now);
    return {
      items: pageRows.map((t) => publicTerminalCard(t, free[t.id] ?? 0, geo)),
      total, page: p, limit: l,
      summary: summarize(rich, free, geo, services),
    };
  }

  @Get('terminals/:slug')
  async terminal(@Param('slug') slug: string) {
    const now = new Date();
    const t = await this.repo.findTerminalBySlug(slug, now);
    // Shahobcha reestrdan keladi va egasi yo'q: uni ham ochiq ko'rsatamiz, egasi keyin da'vo qiladi
    const open = t !== null && t.status === 'ACTIVE' && (t.orgId !== null || t.kind === 'RAIL');
    if (!open) throw new NotFoundException({ code: 'TERMINAL_NOT_FOUND' });
    const free = await this.repo.freeTodayByTerminal([t.id], now);
    // Telefon raqami bu javobda yo'q: u obunachiga GET /contacts/terminal/:id orqali beriladi
    return publicTerminal(t, free[t.id] ?? 0);
  }

  @Get('sidings')
  async sidings(
    @Query('station') station?: string, @Query('rju') rju?: string, @Query('q') q?: string,
    @Query('page') page?: string, @Query('limit') limit?: string,
    @Query('region') region?: string, @Query('near') near?: string, @Query('radius') radius?: string,
  ) {
    const r = await this.repo.listSidings(
      // hozircha egasiz reestr shahobchalari ham ochiq katalogda: egalar o'z yo'lini topib da'vo qilsin
      { ...stationParam(station), rju: pickIn(rju, RJUS), q: q?.trim() || undefined, region: pickIn(region, REGIONS), near: geoNear(near, radius) },
      clampInt(page, 1, 1, 10000), clampInt(limit, 30, 1, 100),
    );
    return { ...r, items: r.items.map((x) => publicSiding(x)) };
  }

  @Get('sidings/:id')
  async siding(@Param('id') id: string) {
    const s = await this.repo.findSidingById(id, true);
    // hozircha egasiz reestr shahobchalari ham ochiq: egasi/rasm faqat da'vo tasdiqlanganda ko'rinadi (publicSiding)
    if (!s) throw new NotFoundException({ code: 'SIDING_NOT_FOUND' });
    return publicSiding(s);
  }

  /** Xarita: platformadagi obyektlar (temir yo'l tarmog'i emas). */
  @Get('map-objects')
  mapObjects() {
    return this.repo.mapObjects();
  }

  /**
   * Xaritadagi stansiya qatlami: nomi uch tilda, shahobcha soni bilan.
   * Faqat rasmiy ro'yxatdagi ("2026 yil stansiyalar" hujjati) va koordinatasi bor stansiyalar.
   * Obyekt qatlamlaridan alohida: stansiya bu katalog birligi emas, orientir.
   */
  @Get('stations.geojson')
  @Header('Cache-Control', 'public, max-age=300, s-maxage=300')
  async stationsGeojson() {
    const rows = await this.repo.listedStations();
    return {
      type: 'FeatureCollection',
      features: rows.map((s) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
        properties: {
          id: s.id, esrCode: s.esrCode, rju: s.rju, sidings: s.sidings,
          name: s.nameUz, nameRu: s.nameRu, nameEn: s.nameEn,
        },
      })),
    };
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
      cats.includes('terminal') ? this.repo.mapObjects() : null,
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
  @Header('Cache-Control', 'public, max-age=60')
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
