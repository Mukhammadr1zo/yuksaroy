import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { DealKind, ListingInput, ListingKind, ListingStatus } from '@yuksaroy/domain';
import { PrismaService } from '../../../common/prisma.service';
import type { ListingRecord, Route } from '../domain/listing-query';

export const listingInclude = {
  org: { select: { name: true, slug: true, kycStatus: true } },
  ownerUser: { select: { fullName: true, phone: true } },
  // Shahobcha ham terminal (kind RAIL), shuning uchun bitta bog'lanish yetarli
  terminal: { select: { id: true, name: true, slug: true, orgId: true, kind: true, registryNo: true, stationNameRaw: true, station: { select: { nameUz: true } } } },
} as const;
const include = listingInclude;
type Row = Prisma.ListingGetPayload<{ include: typeof include }>;
const ci = (s: string) => ({ contains: s, mode: 'insensitive' as const });

export const toRecord = (r: Row): ListingRecord => ({ ...r, priceTiyin: r.priceTiyin === null ? null : Number(r.priceTiyin), routes: (r.routes as Route[] | null) ?? [] });

/** Domen kiritmasi + hisoblangan nuqta. Narx tiyin BigInt, yo'nalishlar Json. */
export type ListingWrite = ListingInput & { lat: number | null; lng: number | null };
const writeData = <T extends ListingWrite>({ ownerType: _o, ...d }: T) => ({ ...d, priceTiyin: d.priceTiyin === null ? null : BigInt(d.priceTiyin), routes: d.routes as unknown as Prisma.InputJsonValue });

@Injectable()
export class PrismaListingRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Faqat ACTIVE va muddati o'tmagan. Radius va koridor filtri xotirada (chaqiruvchi). */
  async listPublic(f: { kinds: ListingKind[]; deal?: DealKind; regions: string[]; q?: string }, now: Date) {
    const rows = await this.prisma.listing.findMany({
      where: {
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        kind: f.kinds.length ? { in: f.kinds } : undefined,
        deal: f.deal,
        AND: [
          f.regions.length ? { OR: [{ regionCode: { in: f.regions } }, { serviceRegions: { hasSome: f.regions } }] } : {},
          f.q ? { OR: [{ title: ci(f.q) }, { model: ci(f.q) }] } : {},
        ],
      },
      include, orderBy: [{ publishedAt: 'desc' }],
      take: 500, // ponytail: F1 da yuzlab e'lon; kursor pagination 500+ faol e'londa
    });
    return rows.map(toRecord);
  }
  /** Mening e'lonlarim: tashkilotlarimniki + shaxsan meniki (ownerUserId). */
  async listMine(userId: string, orgIds: string[]) {
    return (await this.prisma.listing.findMany({ where: { OR: [{ orgId: { in: orgIds } }, { ownerUserId: userId }] }, include, orderBy: [{ updatedAt: 'desc' }] })).map(toRecord);
  }
  /**
   * Moderatsiya va admin ro'yxati. Ilgari qat'iy `take: 200` edi va jami son ham
   * qaytmasdi: platforma 200 ta faol e'londan oshgach yangisiga yetib borib bo'lmasdi,
   * qidiruv esa faqat brauzerdagi 200 qator ichida ishlardi.
   */
  async listByStatus(status: ListingStatus, opts: { q?: string; skip?: number; take?: number } = {}) {
    const text = opts.q?.trim();
    const where: Prisma.ListingWhereInput = {
      status,
      ...(text ? { OR: [{ title: ci(text) }, { slug: ci(text) }, { org: { name: ci(text) } }] } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.listing.count({ where }),
      this.prisma.listing.findMany({ where, include, orderBy: [{ updatedAt: 'asc' }], skip: opts.skip ?? 0, take: opts.take ?? 30 }),
    ]);
    return { rows: rows.map(toRecord), total };
  }
  async findBySlug(slug: string) {
    const r = await this.prisma.listing.findUnique({ where: { slug }, include });
    return r ? toRecord(r) : null;
  }
  async findById(id: string) {
    const r = await this.prisma.listing.findUnique({ where: { id }, include });
    return r ? toRecord(r) : null;
  }
  async slugExists(slug: string) { return (await this.prisma.listing.count({ where: { slug } })) > 0; }
  async create(d: ListingWrite & { slug: string; orgId: string | null; ownerUserId: string | null; createdById: string }) {
    return toRecord(await this.prisma.listing.create({ data: writeData(d), include }));
  }
  async update(id: string, d: ListingWrite) {
    return toRecord(await this.prisma.listing.update({ where: { id }, data: writeData(d), include }));
  }
  async setStatus(id: string, d: { status: ListingStatus; publishedAt?: Date; expiresAt?: Date; rejectReason: string | null }) {
    return toRecord(await this.prisma.listing.update({ where: { id }, data: d, include }));
  }
  async remove(id: string) { await this.prisma.listing.delete({ where: { id } }); }
  /** Bog'langan obyekt nuqtasi; obyekt yo'q yoki egasiz bo'lsa null. */
  async objectPoint(id: string): Promise<{ lat: number | null; lng: number | null } | null> {
    // Egasiz obyekt ochiq mahsulotda yo'q: unga e'lon ham bog'lanmaydi
    const t = await this.prisma.terminal.findUnique({ where: { id }, select: { lat: true, lng: true, orgId: true } });
    return t && t.orgId !== null ? { lat: t.lat, lng: t.lng } : null;
  }

  // ── so'rovlar ──
  async createInquiry(d: { listingId: string; fromOrgId: string | null; fromUserId: string; message: string; toOrgId: string | null; toUserId: string | null }) {
    return this.prisma.inquiry.create({ data: { ...d, lastMessageAt: new Date() } });
  }
}
