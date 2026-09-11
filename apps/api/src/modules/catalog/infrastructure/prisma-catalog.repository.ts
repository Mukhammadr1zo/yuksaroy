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
const sidingInclude = { station: { select: { id: true, esrCode: true, nameUz: true, rju: true } }, ownerOrg: { select: { name: true } } } as const;
type SidingRow = Prisma.SidingGetPayload<{ include: typeof sidingInclude }>;

const toTariff = (t: Prisma.TariffGetPayload<object>): TariffRecord => ({
  id: t.id, terminalId: t.terminalId, serviceCode: t.serviceCode, cargoGroupCode: t.cargoGroupCode, version: t.version,
  validFrom: t.validFrom, validTo: t.validTo, priceTiyin: Number(t.priceTiyin), unit: t.unit,
  minTiyin: t.minTiyin === null ? null : Number(t.minTiyin), note: t.note, createdAt: t.createdAt,
});
const toTerminal = (t: TerminalRow): TerminalRecord => ({
  id: t.id, orgId: t.orgId, orgName: t.org?.name ?? null, stationId: t.stationId, station: t.station, regionCode: t.regionCode,
  kind: t.kind, slug: t.slug, name: t.name, description: t.description, address: t.address, phone: t.phone, lat: t.lat, lng: t.lng,
  is24h: t.is24h, hours: (t.hours as WeekHours | null) ?? null, passport: (t.passport as Record<string, unknown> | null) ?? null,
  photos: t.photos, status: t.status, claimedAt: t.claimedAt, ratingAvg: t.ratingAvg, ratingCount: t.ratingCount,
  claimStatus: t.claimStatus, claimOrgId: t.claimOrgId,
  services: t.services.map((s) => ({ serviceCode: s.serviceCode, isEnabled: s.isEnabled, leadTimeMin: s.leadTimeMin })),
  tariffs: t.tariffs.map(toTariff),
});
const toSiding = (s: SidingRow): SidingRecord => ({
  id: s.id, registryNo: s.registryNo, stationId: s.stationId, station: s.station, stationNameRaw: s.stationNameRaw, esrCode: s.esrCode, rju: s.rju,
  regionCode: s.regionCode, lat: s.lat, lng: s.lng,
  ownerNameRaw: s.ownerNameRaw, ownerOrgId: s.ownerOrgId, ownerOrgName: s.ownerOrg?.name ?? null, claimStatus: s.claimStatus, claimedAt: s.claimedAt,
  lengthM: s.lengthM, unloadCapacity: s.unloadCapacity, loadCapacity: s.loadCapacity, photos: s.photos,
});
const json = (v: unknown) => (v === null ? Prisma.JsonNull : (v as Prisma.InputJsonValue));
/** Ochiq e'lon: ACTIVE va muddati o'tmagan. */
export const activeListing = (now: Date): Prisma.ListingWhereInput => ({ status: 'ACTIVE', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] });
/** Ochiq kompaniya: tasdiqlangan yoki platformada kamida bitta faol obyekti bor. */
export const visibleCompany = (now: Date): Prisma.OrganizationWhereInput => ({
  kind: { not: 'PLATFORM' },
  OR: [{ kycStatus: 'VERIFIED' }, { terminals: { some: { status: 'ACTIVE' } } }, { listings: { some: activeListing(now) } }, { sidings: { some: { claimStatus: 'APPROVED' } } }],
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
  async listTerminals(f: TerminalFilter, now: Date) {
    const q = f.q ? apos(f.q) : undefined;
    // Bo'sh ro'yxat = filtr yo'q
    const regions = f.region === undefined ? [] : ([] as string[]).concat(f.region);
    const services = f.service === undefined ? [] : ([] as ServiceCode[]).concat(f.service);
    const rows = await this.prisma.terminal.findMany({
      where: {
        status: f.status === 'ANY' ? undefined : (f.status ?? 'ACTIVE'),
        stationId: f.stationId,
        station: f.stationEsr ? { esrCode: f.stationEsr } : f.rju ? { rju: f.rju } : undefined,
        kind: f.kind,
        orgId: f.orgIds ? { in: f.orgIds } : f.owned === undefined ? undefined : f.owned ? { not: null } : null,
        claimStatus: f.claimStatus,
        // Har bir so'ralgan xizmat yoqilgan bo'lishi shart
        AND: services.map((s) => ({ services: { some: { serviceCode: s, isEnabled: true } } })),
        regionCode: regions.length ? { in: regions } : undefined,
        // Radius bo'yicha qidiruvda avval to'rtburchak bilan qisqartiramiz, aniq masofa keyin
        ...(f.near ? bbox(f.near) : {}),
        OR: q ? [{ name: ci(q) }, { address: ci(q) }, { station: { nameUz: ci(q) } }] : undefined,
      },
      include: terminalInclude(now),
      orderBy: [{ ratingAvg: 'desc' }, { name: 'asc' }],
      take: 200, // ponytail: F1 da ≤ 50 obyekt; kursor pagination 20+ terminal bo'lganda
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

  // ── shahobcha ──
  async listSidings(f: SidingFilter, page: number, limit: number): Promise<Page<SidingRecord>> {
    const q = f.q ? apos(f.q) : undefined;
    const where: Prisma.SidingWhereInput = {
      stationId: f.stationId,
      esrCode: f.stationEsr,
      rju: f.rju,
      ownerOrgId: f.ownerOrgIds ? { in: f.ownerOrgIds } : f.owned === undefined ? undefined : f.owned ? { not: null } : null,
      claimStatus: f.claimStatus,
      regionCode: f.region,
      ...(f.near ? bbox(f.near) : {}),
      OR: q ? [{ stationNameRaw: ci(q) }, { station: { nameUz: ci(q) } }, { esrCode: { startsWith: q } }] : undefined,
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.siding.count({ where }),
      this.prisma.siding.findMany({ where, include: sidingInclude, orderBy: [{ rju: 'asc' }, { stationNameRaw: 'asc' }, { registryNo: 'asc' }], skip: (page - 1) * limit, take: limit }),
    ]);
    return { items: rows.map(toSiding), total, page, limit };
  }
  async findSidingById(id: string) {
    const s = await this.prisma.siding.findUnique({ where: { id }, include: sidingInclude });
    return s ? toSiding(s) : null;
  }
  async claimSiding(id: string, orgId: string, now: Date) {
    const r = await this.prisma.siding.updateMany({
      where: { id, claimStatus: { in: ['NONE', 'REJECTED'] } },
      data: { ownerOrgId: orgId, claimStatus: 'PENDING', claimedAt: now },
    });
    if (r.count === 0) throw new SidingClaimedError();
    return (await this.findSidingById(id))!;
  }
  async decideSidingClaim(id: string, approve: boolean) {
    const r = await this.prisma.siding.updateMany({ where: { id, claimStatus: 'PENDING' }, data: { claimStatus: approve ? 'APPROVED' : 'REJECTED' } });
    return r.count === 0 ? null : this.findSidingById(id);
  }
  async updateSidingByOwner(id: string, orgIds: string[], data: { photos?: string[] }) {
    // Egalik tekshiruvi shart qatorida: alohida o'qib keyin yozilsa, oradagi vaqtda egasi o'zgarishi mumkin
    const r = await this.prisma.siding.updateMany({ where: { id, claimStatus: 'APPROVED', ownerOrgId: { in: orgIds } }, data });
    return r.count === 0 ? null : this.findSidingById(id);
  }

  /**
   * Xarita obyektlari: platformadagi narsalar, temir yo'l tarmog'i emas.
   * Shahobcha yo'lning o'z koordinatasi yo'q, shuning uchun u tutashgan stansiya nuqtasida to'planadi.
   */
  async mapObjects() {
    const [terminals, sidingGroups] = await Promise.all([
      this.prisma.terminal.findMany({
        where: { status: 'ACTIVE', orgId: { not: null }, lat: { not: null }, lng: { not: null } },
        select: { id: true, slug: true, name: true, kind: true, lat: true, lng: true },
      }),
      this.prisma.siding.groupBy({ by: ['stationId', 'regionCode'], where: { stationId: { not: null }, ownerOrgId: { not: null } }, _count: { _all: true } }),
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

  async publicStats() {
    const now = new Date();
    const [terminals, sidings, stations, listings, companies, free] = await Promise.all([
      this.prisma.terminal.count({ where: { status: 'ACTIVE', orgId: { not: null } } }), this.prisma.siding.count({ where: { ownerOrgId: { not: null } } }), this.prisma.station.count(),
      this.prisma.listing.count({ where: activeListing(now) }), this.prisma.organization.count({ where: visibleCompany(now) }),
      this.freeToday({ terminal: { status: 'ACTIVE', orgId: { not: null } } }, now),
    ]);
    return { terminals, sidings, stations, listings, companies, freeSlotsToday: Object.values(free).reduce((a, b) => a + b, 0) };
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
