import { Injectable } from '@nestjs/common';
import { distanceKm, uzLocalDate } from '@yuksaroy/domain';
import { Prisma } from '@prisma/client';
import type { Rju, ServiceCode } from '@yuksaroy/domain';
import { PrismaService } from '../../../common/prisma.service';
import { sumFreeToday } from '../domain/free-today';
import {
  SidingClaimedError, TariffOverlapError, TariffValidFromError, TerminalClaimedError,
  type CargoTypeRecord, type CatalogRepository, type Page, type PublishTariffInput, type SidingFilter, type SidingRecord,
  type StationRecord, type TariffRecord, type TerminalFilter, type TerminalRecord, type TerminalServiceRecord, type TerminalWrite, type WeekHours,
} from '../domain/ports';

const stationSelect = { id: true, esrCode: true, nameUz: true, nameRu: true, rju: true, stationType: true, classRank: true, lat: true, lng: true } as const;
const ci = (s: string) => ({ contains: s, mode: 'insensitive' as const });
/** ʻ ’ ` → ': nomlar bazada to'g'ri apostrof bilan saqlanadi. */
const apos = (s: string) => s.replace(/[ʻ’`]/g, "'");

const currentTariff = (now: Date): Prisma.TariffWhereInput => ({ validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gt: now } }] });
const terminalInclude = (now: Date) => ({
  station: { select: stationSelect },
  org: { select: { name: true } },
  services: { orderBy: { serviceCode: 'asc' as const } },
  tariffs: { where: currentTariff(now), orderBy: [{ serviceCode: 'asc' as const }, { cargoGroupCode: 'asc' as const }] },
});
type TerminalRow = Prisma.TerminalGetPayload<{ include: ReturnType<typeof terminalInclude> }>;
// Shahobcha yo'l = temir yo'l terminali (kind RAIL); pasport ustunlari Terminal ichida.
const railInclude = { station: { select: { id: true, esrCode: true, nameUz: true, rju: true } }, org: { select: { name: true } } } as const;
type RailRow = Prisma.TerminalGetPayload<{ include: typeof railInclude }>;

const toTariff = (t: Prisma.TariffGetPayload<object>): TariffRecord => ({
  id: t.id, terminalId: t.terminalId, serviceCode: t.serviceCode, cargoGroupCode: t.cargoGroupCode, version: t.version,
  validFrom: t.validFrom, validTo: t.validTo, priceTiyin: Number(t.priceTiyin), unit: t.unit,
  minTiyin: t.minTiyin === null ? null : Number(t.minTiyin), note: t.note, createdAt: t.createdAt,
});
const toTerminal = (t: TerminalRow): TerminalRecord => ({
  id: t.id, orgId: t.orgId, orgName: t.org?.name ?? null, stationId: t.stationId, station: t.station, regionCode: t.regionCode,
  kind: t.kind, slug: t.slug, name: t.name, description: t.description, address: t.address, phone: t.phone, lat: t.lat, lng: t.lng,
  is24h: t.is24h, hours: (t.hours as WeekHours | null) ?? null, passport: (t.passport as Record<string, unknown> | null) ?? null,
  photos: t.photos, status: t.status, claimedAt: t.claimedAt, isDemo: t.isDemo, ratingAvg: t.ratingAvg, ratingCount: t.ratingCount,
  claimStatus: t.claimStatus, claimOrgId: t.claimOrgId,
  services: t.services.map((s) => ({ serviceCode: s.serviceCode, isEnabled: s.isEnabled, leadTimeMin: s.leadTimeMin })),
  tariffs: t.tariffs.map(toTariff),
  // Temir yo'l pasporti faqat RAIL turida to'ladi; avto terminalda null
  rail: t.kind === 'RAIL' ? {
    registryNo: t.registryNo, stationNameRaw: t.stationNameRaw, esrCode: t.esrCode, rju: t.rju,
    ownerNameRaw: t.ownerNameRaw, lengthM: t.lengthM, loadCapacity: t.loadCapacity, unloadCapacity: t.unloadCapacity,
    ...passportOf(t),
  } : null,
});

/** Terminal qatoridan texnik pasport maydonlari (temir yo'lda to'la, avtoda bo'sh). */
const passportOf = (t: {
  name: string | null; registryRef: string | null; trackCount: number | null; capacityWagons: number | null;
  occupiedWagons: number | null; deadEndDistanceM: number | null; junctionSwitch: string | null; brakeShoes: number | null;
  nogabarit: string | null; equipment: string | null; loadNorm: string | null; unloadNorm: string | null;
  loadFront: string | null; unloadFront: string | null; locoType: string | null; locoNote: string | null;
  processingHours: number | null; contractNo: string | null; contractStart: Date | null; contractEnd: Date | null;
  contractState: string | null; category: string | null; usageType: string | null; operStatus: string | null;
  note: string | null; contactName: string | null; contactPhone: string | null;
}) => ({
  name: t.name, registryRef: t.registryRef, trackCount: t.trackCount, capacityWagons: t.capacityWagons,
  occupiedWagons: t.occupiedWagons, deadEndDistanceM: t.deadEndDistanceM, junctionSwitch: t.junctionSwitch,
  brakeShoes: t.brakeShoes, nogabarit: t.nogabarit, equipment: t.equipment,
  loadNorm: t.loadNorm, unloadNorm: t.unloadNorm, loadFront: t.loadFront, unloadFront: t.unloadFront,
  locoType: t.locoType, locoNote: t.locoNote, processingHours: t.processingHours,
  contractNo: t.contractNo, contractStart: t.contractStart, contractEnd: t.contractEnd,
  contractState: t.contractState, category: t.category, usageType: t.usageType,
  status: t.operStatus, note: t.note, contactName: t.contactName, contactPhone: t.contactPhone,
});
const toSiding = (s: RailRow): SidingRecord => ({
  id: s.id, registryNo: s.registryNo, stationId: s.stationId, station: s.station, stationNameRaw: s.stationNameRaw ?? '', esrCode: s.esrCode, rju: s.rju,
  regionCode: s.regionCode, lat: s.lat, lng: s.lng, slug: s.slug,
  ownerNameRaw: s.ownerNameRaw ?? '', ownerOrgId: s.orgId, ownerOrgName: s.org?.name ?? null, claimStatus: s.claimStatus, claimedAt: s.claimedAt,
  lengthM: s.lengthM, unloadCapacity: s.unloadCapacity, loadCapacity: s.loadCapacity, photos: s.photos,
  // Texnik pasport (Taminot reestridan), mas'ul shaxs bilan birga.
  // Telefonni ochiq javobga chiqarish/chiqarmaslikni mapper hal qiladi (publicSiding/publicTerminal).
  name: s.name, registryRef: s.registryRef, trackCount: s.trackCount,
  capacityWagons: s.capacityWagons, occupiedWagons: s.occupiedWagons,
  deadEndDistanceM: s.deadEndDistanceM, junctionSwitch: s.junctionSwitch, brakeShoes: s.brakeShoes,
  nogabarit: s.nogabarit, equipment: s.equipment,
  loadNorm: s.loadNorm, unloadNorm: s.unloadNorm, loadFront: s.loadFront, unloadFront: s.unloadFront,
  locoType: s.locoType, locoNote: s.locoNote, processingHours: s.processingHours,
  contractNo: s.contractNo, contractStart: s.contractStart, contractEnd: s.contractEnd,
  contractState: s.contractState, category: s.category, usageType: s.usageType,
  status: s.operStatus, note: s.note,
  contactName: s.contactName, contactPhone: s.contactPhone,
});
const json = (v: unknown) => (v === null ? Prisma.JsonNull : (v as Prisma.InputJsonValue));
/** Ochiq e'lon: ACTIVE va muddati o'tmagan. */
export const activeListing = (now: Date): Prisma.ListingWhereInput => ({ status: 'ACTIVE', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] });
/** Ochiq kompaniya: tasdiqlangan yoki platformada kamida bitta faol obyekti bor. */
export const visibleCompany = (now: Date): Prisma.OrganizationWhereInput => ({
  kind: { not: 'PLATFORM' },
  // Shahobcha ham terminal bo'lgani uchun alohida shart kerak emas: da'vosi tasdiqlangani ham shu yerga kiradi
  OR: [{ kycStatus: 'VERIFIED' }, { terminals: { some: { OR: [{ status: 'ACTIVE' }, { claimStatus: 'APPROVED' }] } } }, { listings: { some: activeListing(now) } }],
});

@Injectable()
export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── stansiya, yuk turi ──
  searchStations(q: string, rju: Rju | undefined, limit: number) {
    const s = apos(q);
    return this.prisma.station.findMany({
      where: { rju, ...(s ? { OR: [{ nameUz: ci(s) }, { nameRu: ci(s) }, { esrCode: { startsWith: s } }] } : {}) },
      orderBy: [{ nameUz: 'asc' }], take: limit, select: stationSelect,
    });
  }
  findStationByEsr(esrCode: string) { return this.prisma.station.findUnique({ where: { esrCode }, select: stationSelect }); }
  findStationById(id: string) { return this.prisma.station.findUnique({ where: { id }, select: stationSelect }); }
  searchCargoTypes(q: string, limit: number): Promise<CargoTypeRecord[]> {
    return this.prisma.cargoType.findMany({
      where: q ? { OR: [{ name: ci(q) }, { nameUz: ci(q) }, { groupName: ci(q) }, { code: { startsWith: q } }] } : {},
      orderBy: [{ code: 'asc' }], take: limit,
    });
  }
  findCargoTypeByCode(code: string) { return this.prisma.cargoType.findUnique({ where: { code } }); }

  // ── terminal ──
  /** Filtr shartlari: ro'yxat ham, sanoq ham shu bitta manbadan quriladi. */
  private terminalWhere(f: TerminalFilter): Prisma.TerminalWhereInput {
    const q = f.q ? apos(f.q) : undefined;
    // Bo'sh ro'yxat = filtr yo'q
    const regions = f.region === undefined ? [] : ([] as string[]).concat(f.region);
    const services = f.service === undefined ? [] : ([] as ServiceCode[]).concat(f.service);
    return {
      status: f.status === 'ANY' ? undefined : (f.status ?? 'ACTIVE'),
      stationId: f.stationId,
      station: f.stationEsr ? { esrCode: f.stationEsr } : f.rju ? { rju: f.rju } : undefined,
      kind: f.kind,
      orgId: f.orgIds ? { in: f.orgIds } : f.owned === undefined ? undefined : f.owned ? { not: null } : null,
      claimStatus: f.claimStatus,
      regionCode: regions.length ? { in: regions } : undefined,
      // Radius bo'yicha qidiruvda avval to'rtburchak bilan qisqartiramiz, aniq masofa keyin
      ...(f.near ? bbox(f.near) : {}),
      // Hamma OR shartlari AND ichida: bitta obyektda ikkita OR kaliti bo'lsa biri ikkinchisini yeb qo'yadi
      AND: [
        // Har bir so'ralgan xizmat yoqilgan bo'lishi shart
        ...services.map((s) => ({ services: { some: { serviceCode: s, isEnabled: true } } })),
        // Ochiq katalog: egasi bor obyekt yoki reestrdan kelgan temir yo'l terminali
        ...(f.publicCatalog ? [{ OR: [{ orgId: { not: null } }, { kind: 'RAIL' as const }] }] : []),
        ...(q ? [{ OR: [{ name: ci(q) }, { address: ci(q) }, { station: { nameUz: ci(q) } }, { stationNameRaw: ci(q) }] }] : []),
      ],
    };
  }

  countTerminals(f: TerminalFilter) {
    return this.prisma.terminal.count({ where: this.terminalWhere(f) });
  }

  async listTerminals(f: TerminalFilter, now: Date) {
    // Sukut tartib: egasi bor obyektlar oldinda (reestr qatori ulardan keyin), keyin baho va nom.
    // Ilgari bu saralash xotirada qilinardi va faqat birinchi 200 qatorga ta'sir qilardi.
    const orderBy: Prisma.TerminalOrderByWithRelationInput[] =
      // Da'vo navbati ish ro'yxati: eng uzoq kutgani birinchi chiqsin, aks holda operator
      // yuqoridan ishlaganda eski da'vo pastda qolib ketardi. Da'vo qachon berilgani alohida
      // ustunda yo'q (claimedAt faqat tasdiqlanganda to'ladi), shuning uchun oxirgi o'zgarish vaqti.
      f.claimStatus === 'PENDING' ? [{ updatedAt: 'asc' }, { id: 'asc' }]
      : f.sort === 'name' ? [{ name: 'asc' }, { id: 'asc' }]
      : f.sort === 'rating' ? [{ ratingAvg: 'desc' }, { name: 'asc' }, { id: 'asc' }]
      : f.sort === 'default' ? [{ orgId: { sort: 'desc', nulls: 'last' } }, { ratingAvg: 'desc' }, { name: 'asc' }, { id: 'asc' }]
      : [{ ratingAvg: 'desc' }, { name: 'asc' }, { id: 'asc' }];
    // Oxirgi kalit `id`: reestr qatorlarining ko'pi bir xil baho va egasiz, ya'ni tartib noaniq bo'lardi
    // va OFFSET bilan sahifalaganda bitta obyekt ikki sahifada yoki umuman ko'rinmay qolardi.
    // `take` berilsa baza bo'ladi; berilmasa chaqiruvchi kichik to'plam so'ragan (egasi bo'yicha, xarita, hisob-kitob).
    // ponytail: sahifasiz chaqiruvlarda 500 chegara; ular hammasi `owned`/`orgIds` bilan keladi va
    // bitta tashkilotda yuzlab obyekt bo'lmaydi. Ochiq katalog esa har doim `take` bilan so'raydi.
    // Radius berilganda chegara yo'q: to'rtburchak to'plamni allaqachon cheklaydi va
    // geoNear radiusni 300 km bilan kesadi, 500 chegarasi esa katta radiusda qatorlarni yo'qotardi.
    const take = f.take ?? (f.near ? undefined : 500);
    const skip = f.skip ?? 0;
    const rows = await this.prisma.terminal.findMany({
      where: this.terminalWhere(f),
      include: terminalInclude(now),
      orderBy,
      skip,
      take,
    });
    const near = f.near;
    return rows
      .map(toTerminal)
      .filter((t) => !near || (t.lat != null && t.lng != null && distanceKm(near.lat, near.lng, t.lat, t.lng) <= near.radiusKm));
  }
  /** Booking moduli import qilinmaydi (aylanma bog'liqlik), shuning uchun slot yig'indisi shu yerda. */
  async freeTodayByTerminal(terminalIds: string[], now: Date) {
    return terminalIds.length ? this.freeToday({ terminalId: { in: terminalIds } }, now) : {};
  }
  private async freeToday(where: Prisma.TimeSlotWhereInput, now: Date) {
    const rows = await this.prisma.timeSlot.findMany({
      where: { ...where, localDate: new Date(`${uzLocalDate(now)}T00:00:00.000Z`), status: 'OPEN', endsAt: { gt: now } },
      select: { terminalId: true, capacity: true, booked: true, held: true, bookings: { where: { status: 'HOLD', holdExpiresAt: { lt: now } }, select: { id: true } } },
    });
    return sumFreeToday(rows.map((r) => ({ terminalId: r.terminalId, capacity: r.capacity, booked: r.booked, held: r.held, staleHolds: r.bookings.length })));
  }
  async findTerminalBySlug(slug: string, now: Date) {
    const t = await this.prisma.terminal.findUnique({ where: { slug }, include: terminalInclude(now) });
    return t ? toTerminal(t) : null;
  }
  async findTerminalById(id: string, now: Date) {
    const t = await this.prisma.terminal.findUnique({ where: { id }, include: terminalInclude(now) });
    return t ? toTerminal(t) : null;
  }
  async slugExists(slug: string) { return (await this.prisma.terminal.count({ where: { slug } })) > 0; }
  async claimTerminal(id: string, orgId: string) {
    const r = await this.prisma.terminal.updateMany({ where: { id, orgId: null, claimStatus: { not: 'PENDING' } }, data: { claimOrgId: orgId, claimStatus: 'PENDING' } });
    if (r.count === 0) throw new TerminalClaimedError();
    return (await this.findTerminalById(id, new Date()))!;
  }
  async decideTerminalClaim(id: string, approve: boolean, now: Date) {
    const t = await this.prisma.terminal.findUnique({ where: { id }, select: { claimStatus: true, claimOrgId: true } });
    if (!t || t.claimStatus !== 'PENDING') return null;
    await this.prisma.terminal.update({
      where: { id },
      data: approve ? { orgId: t.claimOrgId, claimedAt: now, claimStatus: 'APPROVED' } : { claimStatus: 'REJECTED' },
    });
    return this.findTerminalById(id, now);
  }
  async createTerminal(d: TerminalWrite, now: Date) {
    const t = await this.prisma.terminal.create({
      data: { ...d, hours: d.hours === undefined ? undefined : json(d.hours), passport: d.passport === undefined ? undefined : json(d.passport) },
      include: terminalInclude(now),
    });
    return toTerminal(t);
  }
  async updateTerminal(id: string, d: Partial<TerminalWrite>, now: Date) {
    const t = await this.prisma.terminal.update({
      where: { id },
      data: { ...d, hours: d.hours === undefined ? undefined : json(d.hours), passport: d.passport === undefined ? undefined : json(d.passport) },
      include: terminalInclude(now),
    });
    return toTerminal(t);
  }
  async replaceServices(terminalId: string, services: TerminalServiceRecord[]) {
    await this.prisma.$transaction([
      this.prisma.terminalService.deleteMany({ where: { terminalId } }),
      this.prisma.terminalService.createMany({ data: services.map((s) => ({ terminalId, ...s })) }),
    ]);
  }
  async listTariffs(terminalId: string, history: boolean, now: Date) {
    const rows = await this.prisma.tariff.findMany({
      where: { terminalId, ...(history ? {} : currentTariff(now)) },
      orderBy: [{ serviceCode: 'asc' }, { cargoGroupCode: 'asc' }, { version: 'desc' }],
    });
    return rows.map(toTariff);
  }
  async publishTariff(t: PublishTariffInput) {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const scope = { terminalId: t.terminalId, serviceCode: t.serviceCode, cargoGroupCode: t.cargoGroupCode };
        const open = await tx.tariff.findFirst({ where: { ...scope, OR: [{ validTo: null }, { validTo: { gt: t.validFrom } }] }, orderBy: { validFrom: 'desc' } });
        if (open) {
          if (open.validFrom >= t.validFrom) throw new TariffValidFromError();
          await tx.tariff.update({ where: { id: open.id }, data: { validTo: t.validFrom } });
        }
        const last = await tx.tariff.findFirst({ where: { terminalId: t.terminalId, serviceCode: t.serviceCode }, orderBy: { version: 'desc' }, select: { version: true } });
        return tx.tariff.create({
          data: { ...scope, version: (last?.version ?? 0) + 1, validFrom: t.validFrom, priceTiyin: BigInt(t.priceTiyin), unit: t.unit,
            minTiyin: t.minTiyin === null ? null : BigInt(t.minTiyin), note: t.note, createdById: t.createdById },
        });
      });
      return toTariff(row);
    } catch (e) {
      if (e instanceof TariffValidFromError) throw e;
      if (String((e as Error).message).includes('Tariff_no_overlap')) throw new TariffOverlapError();
      throw e;
    }
  }

  // ── shahobcha (temir yo'l terminali) ──
  // Shahobcha yo'l endi alohida jadval emas: u Terminal, turi RAIL. Eski /sidings
  // manzillari ishlashda davom etadi, shunchaki manba Terminal jadvali.
  async listSidings(f: SidingFilter, page: number, limit: number): Promise<Page<SidingRecord>> {
    const q = f.q ? apos(f.q) : undefined;
    const where: Prisma.TerminalWhereInput = {
      kind: 'RAIL',
      // Ochiq ro'yxat faqat ACTIVE: admin yashirgan (HIDDEN) yo'l ilgari ham ro'yxatda, ham sahifasida ochiq qolardi.
      // Egasi o'z kabinetida ko'radi, u yerda ownerOrgIds bilan alohida so'rov ketadi.
      status: f.ownerOrgIds ? { not: 'DRAFT' } : 'ACTIVE',
      stationId: f.stationId,
      esrCode: f.stationEsr,
      rju: f.rju,
      orgId: f.ownerOrgIds ? undefined : f.owned === undefined ? undefined : f.owned ? { not: null } : null,
      claimStatus: Array.isArray(f.claimStatus) ? { in: f.claimStatus } : f.claimStatus,
      regionCode: f.region,
      ...(f.near ? bbox(f.near) : {}),
      // Kabinet ro'yxati: egalik tasdiqlanganlar (orgId) ham, hali hal bo'lmagan da'vo (claimOrgId) ham.
      // Faqat orgId ga qaralsa, da'vo yuborgan odam o'z kabinetida hech narsa ko'rmasdi.
      AND: f.ownerOrgIds ? [{ OR: [{ orgId: { in: f.ownerOrgIds } }, { claimOrgId: { in: f.ownerOrgIds } }] }] : undefined,
      OR: q ? [{ name: ci(q) }, { stationNameRaw: ci(q) }, { station: { nameUz: ci(q) } }, { esrCode: { startsWith: q } }] : undefined,
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.terminal.count({ where }),
      this.prisma.terminal.findMany({
        where, include: railInclude,
        orderBy: [{ rju: 'asc' }, { stationNameRaw: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit, take: limit,
      }),
    ]);
    return { items: rows.map(toSiding), total, page, limit };
  }
  /** Ochiq tafsilot: ro'yxat kabi faqat ACTIVE (admin yashirgan yo'l pasporti ochiq qolmasin). */
  async findSidingById(id: string, publicOnly = false) {
    const s = await this.prisma.terminal.findFirst({ where: { id, kind: 'RAIL', ...(publicOnly ? { status: 'ACTIVE' as const } : {}) }, include: railInclude });
    return s ? toSiding(s) : null;
  }
  // claimedAt faqat TASDIQLANGANDA qo'yiladi: u "egasi bor" degani va ochiq sahifa shunga qarab
  // pasport, tarif va bron bo'limlarini chizadi. Ilgari u PENDING da qo'yilib, rad etilganda ham qolib ketardi.
  async claimSiding(id: string, orgId: string, _now: Date) {
    const r = await this.prisma.terminal.updateMany({
      where: { id, kind: 'RAIL', orgId: null, claimStatus: { in: ['NONE', 'REJECTED'] } },
      data: { claimOrgId: orgId, claimStatus: 'PENDING' },
    });
    if (r.count === 0) throw new SidingClaimedError();
    return (await this.findSidingById(id))!;
  }
  async decideSidingClaim(id: string, approve: boolean) {
    // Tasdiqlansa da'vo qilgan tashkilot haqiqiy egaga aylanadi
    const row = await this.prisma.terminal.findFirst({ where: { id, kind: 'RAIL', claimStatus: 'PENDING' }, select: { claimOrgId: true } });
    if (!row) return null;
    await this.prisma.terminal.update({
      where: { id },
      data: approve
        ? { claimStatus: 'APPROVED', orgId: row.claimOrgId, claimedAt: new Date() }
        // claimOrgId saqlanadi: xabar shu tashkilotga ketadi va keyin qayta da'vo qilsa tarixi ko'rinadi
        : { claimStatus: 'REJECTED', claimedAt: null },
    });
    return this.findSidingById(id);
  }
  async updateSidingByOwner(id: string, orgIds: string[], data: { photos?: string[] }) {
    // Egalik tekshiruvi shart qatorida: alohida o'qib keyin yozilsa, oradagi vaqtda egasi o'zgarishi mumkin
    const r = await this.prisma.terminal.updateMany({ where: { id, kind: 'RAIL', claimStatus: 'APPROVED', orgId: { in: orgIds } }, data });
    return r.count === 0 ? null : this.findSidingById(id);
  }

  /**
   * Xarita obyektlari: platformadagi narsalar, temir yo'l tarmog'i emas.
   * Shahobcha yo'lning o'z koordinatasi yo'q, shuning uchun u tutashgan stansiya nuqtasida to'planadi.
   */
  async mapObjects() {
    const [terminals, sidingGroups] = await Promise.all([
      this.prisma.terminal.findMany({
        // Egasi bor hamma terminal o'z nuqtasi bilan (temir yo'l ham): egasi qo'shgan obyekt aniq joyda turadi
        where: { status: 'ACTIVE', orgId: { not: null }, lat: { not: null }, lng: { not: null } },
        select: { id: true, slug: true, name: true, kind: true, lat: true, lng: true },
      }),
      // Temir yo'l terminallari (shahobchalar) stansiya nuqtasida to'planadi; egasiz reestr qatorlari ham
      // Stansiya bo'yicha to'planadiganlar: yuqorida o'z nuqtasini OLMAGANLAR, ya'ni egasiz
      // yoki koordinatasi yo'q qatorlar. Ikkala shart ham kerak: faqat "egasiz" desak,
      // tasdiqlangan lekin koordinatasiz shahobcha xaritadan butunlay yo'qolardi.
      this.prisma.terminal.groupBy({
        by: ['stationId', 'regionCode'],
        where: { kind: 'RAIL', stationId: { not: null }, status: 'ACTIVE', OR: [{ orgId: null }, { lat: null }, { lng: null }] },
        _count: { _all: true },
      }),
    ]);
    // Stansiya bo'yicha yig'indi; viloyat kodi birinchi bo'sh bo'lmagani (bir stansiya odatda bitta viloyatda).
    const byStation = new Map<string, { count: number; regionCode: string | null }>();
    for (const g of sidingGroups) {
      const cur = byStation.get(g.stationId!);
      if (!cur) byStation.set(g.stationId!, { count: g._count._all, regionCode: g.regionCode });
      else { cur.count += g._count._all; if (cur.regionCode === null) cur.regionCode = g.regionCode; }
    }
    const ids = [...byStation.keys()];
    const stations = ids.length
      ? await this.prisma.station.findMany({
          where: { id: { in: ids }, lat: { not: null }, lng: { not: null } },
          select: { id: true, nameUz: true, lat: true, lng: true },
        })
      : [];
    const byId = new Map(stations.map((s) => [s.id, s]));
    const sidings: { id: string; name: string; lat: number; lng: number; count: number; regionCode: string | null }[] = [];
    for (const [stationId, g] of byStation) {
      const st = byId.get(stationId);
      if (st?.lat != null && st.lng != null) sidings.push({ id: st.id, name: st.nameUz, lat: st.lat, lng: st.lng, count: g.count, regionCode: g.regionCode });
    }
    return { terminals, sidings };
  }

  /** Xaritadagi stansiya qatlami: faqat rasmiy ro'yxatdagi va koordinatasi bor qatorlar. */
  async listedStations() {
    const rows = await this.prisma.station.findMany({
      where: { isListed: true, lat: { not: null }, lng: { not: null } },
      select: {
        id: true, esrCode: true, nameUz: true, nameRu: true, nameEn: true, rju: true,
        lat: true, lng: true, _count: { select: { terminals: { where: { kind: 'RAIL' } } } },
      },
      orderBy: { nameUz: 'asc' },
    });
    return rows.map((s) => ({
      id: s.id, esrCode: s.esrCode, nameUz: s.nameUz, nameRu: s.nameRu, nameEn: s.nameEn,
      rju: s.rju, lat: s.lat!, lng: s.lng!, sidings: s._count.terminals,
    }));
  }

  async publicStats() {
    const now = new Date();
    // Tashriflar oxirgi 30 kun bo'yicha: bitta kunning soni juda o'zgaruvchan va
    // bosh sahifada u ishonch emas, tasodif ko'rsatardi
    const from = new Date(now.getTime() - 30 * 86_400_000);
    const [terminals, sidings, stations, listings, companies, free, visits, visitRows] = await Promise.all([
      // terminals: ochiq katalog bilan bir xil son (egasi bor avto/aralash + butun temir yo'l reestri),
      // aks holda bosh sahifa "2 terminal" deb turib katalog 1 700 ta ko'rsatardi.
      // sidings: faqat temir yo'l turi, admin panel uchun; ochiq sahifalar alohida ko'rsatmaydi.
      this.prisma.terminal.count({ where: { status: 'ACTIVE', OR: [{ orgId: { not: null } }, { kind: 'RAIL' }] } }),
      this.prisma.terminal.count({ where: { status: 'ACTIVE', kind: 'RAIL' } }),
      this.prisma.station.count(),
      this.prisma.listing.count({ where: activeListing(now) }), this.prisma.organization.count({ where: visibleCompany(now) }),
      this.freeToday({ terminal: { status: 'ACTIVE', orgId: { not: null } } }, now),
      this.prisma.visit.aggregate({ _sum: { count: true }, where: { day: { gte: from } } }),
      this.prisma.visit.groupBy({ by: ['region'], where: { day: { gte: from }, region: { not: '' } }, _sum: { count: true } }),
    ]);
    return {
      terminals, sidings, stations, listings, companies,
      freeSlotsToday: Object.values(free).reduce((a, b) => a + b, 0),
      visits30: visits._sum.count ?? 0,
      visitRegions: visitRows
        .map((r) => ({ region: r.region, count: r._sum.count ?? 0 }))
        .sort((a, b) => b.count - a.count),
    };
  }
}


/**
 * Radius bo'yicha oldindan qisqartirish: 1 daraja kenglik ~111 km, uzunlik esa kenglikka bog'liq.
 * Aniq masofa keyin haversine bilan tekshiriladi, chunki to'rtburchak biroz kengroq oladi.
 */
function bbox(n: { lat: number; lng: number; radiusKm: number }) {
  const dLat = n.radiusKm / 111;
  const dLng = n.radiusKm / (111 * Math.max(0.2, Math.cos((n.lat * Math.PI) / 180)));
  return {
    lat: { gte: n.lat - dLat, lte: n.lat + dLat },
    lng: { gte: n.lng - dLng, lte: n.lng + dLng },
  };
}
