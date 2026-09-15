import { Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags, PartialType } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { IsBoolean, IsDateString, IsIn, IsInt, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, Length, Matches, MaxLength, Min } from 'class-validator';
import {
  CLAIM_STATUSES, REGIONS, RJUS, TERMINAL_KINDS, TERMINAL_STATUSES, slugify,
  type ClaimStatus, type RegionCode, type Rju, type TerminalKind, type TerminalStatus,
} from '@yuksaroy/domain';
import { AuditService } from '../../common/audit.service';
import { PrismaService } from '../../common/prisma.service';
import { clampInt, pickIn } from '../catalog/presentation/catalog.controller';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { PlatformAdminGuard } from '../organizations/presentation/platform-admin.guard';

/** Terminal (shahobcha yo'l ham shu jadvalda): nom va tur majburiy, qolgani pasport ustunlari. */
class TerminalCreateDto {
  @IsString() @Length(2, 200) name!: string;
  @IsIn(TERMINAL_KINDS) kind!: TerminalKind;
  // Slug bu sahifaning manzili: bo'sh joy yoki kirill bo'lsa havola ochilmaydi
  @IsOptional() @IsString() @Length(2, 120) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug: faqat kichik lotin, raqam va defis' }) slug?: string;
  @IsOptional() @IsString() stationId?: string;
  @IsOptional() @IsString() orgId?: string;
  @IsOptional() @IsIn(REGIONS) regionCode?: RegionCode;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsLatitude() lat?: number;
  @IsOptional() @IsLongitude() lng?: number;
  @IsOptional() @IsBoolean() is24h?: boolean;
  @IsOptional() @IsIn(TERMINAL_STATUSES) status?: TerminalStatus;

  // Temir yo'l pasporti (Taminot reestri)
  @IsOptional() @IsInt() @Min(1) taminotId?: number;
  @IsOptional() @IsInt() @Min(1) registryNo?: number;
  @IsOptional() @IsString() @MaxLength(120) registryRef?: string;
  @IsOptional() @IsString() @MaxLength(200) stationNameRaw?: string;
  @IsOptional() @Matches(/^\d{5,6}$/) esrCode?: string;
  @IsOptional() @IsIn(RJUS) rju?: Rju;
  @IsOptional() @IsString() @MaxLength(300) ownerNameRaw?: string;
  @IsOptional() @IsInt() @Min(0) lengthM?: number;
  // Yuklash/tushirish sig'imi ham reestr maydoni: bo'lmasa whitelist jimgina tashlab yuborardi
  @IsOptional() @IsInt() @Min(0) loadCapacity?: number;
  @IsOptional() @IsInt() @Min(0) unloadCapacity?: number;
  @IsOptional() @IsInt() @Min(0) trackCount?: number;
  @IsOptional() @IsInt() @Min(0) capacityWagons?: number;
  @IsOptional() @IsInt() @Min(0) occupiedWagons?: number;
  @IsOptional() @IsInt() @Min(0) deadEndDistanceM?: number;
  @IsOptional() @IsString() @MaxLength(100) junctionSwitch?: string;
  @IsOptional() @IsInt() @Min(0) brakeShoes?: number;
  @IsOptional() @IsString() @MaxLength(200) nogabarit?: string;
  @IsOptional() @IsString() @MaxLength(500) equipment?: string;
  @IsOptional() @IsString() @MaxLength(200) loadNorm?: string;
  @IsOptional() @IsString() @MaxLength(200) unloadNorm?: string;
  @IsOptional() @IsString() @MaxLength(200) loadFront?: string;
  @IsOptional() @IsString() @MaxLength(200) unloadFront?: string;
  @IsOptional() @IsString() @MaxLength(50) locoType?: string;
  @IsOptional() @IsString() @MaxLength(300) locoNote?: string;
  @IsOptional() @IsNumber() @Min(0) processingHours?: number;
  @IsOptional() @IsString() @MaxLength(100) contractNo?: string;
  @IsOptional() @IsDateString() contractStart?: string;
  @IsOptional() @IsDateString() contractEnd?: string;
  @IsOptional() @IsString() @MaxLength(30) contractState?: string;
  @IsOptional() @IsString() @MaxLength(30) category?: string;
  @IsOptional() @IsString() @MaxLength(30) usageType?: string;
  @IsOptional() @IsString() @MaxLength(30) operStatus?: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
  @IsOptional() @IsString() @MaxLength(120) contactName?: string;
  @IsOptional() @IsString() @MaxLength(40) contactPhone?: string;
}

/** Hammasi ixtiyoriy: kelmagan kalit ustunni o'zgartirmaydi. Da'vo holatini ham admin qo'lda to'g'rilaydi. */
class TerminalUpdateDto extends PartialType(TerminalCreateDto) {
  @IsOptional() @IsIn(CLAIM_STATUSES) claimStatus?: ClaimStatus;
  @IsOptional() @IsString() claimOrgId?: string;
}

/** Yaratishda ham da'vo maydonlari qabul qilinadi: forma ularni yuboradi, aks holda whitelist jim tashlab yuborardi. */
class TerminalCreateFullDto extends TerminalCreateDto {
  @IsOptional() @IsIn(CLAIM_STATUSES) claimStatus?: ClaimStatus;
  @IsOptional() @IsString() claimOrgId?: string;
}

class StationCreateDto {
  @IsString() @Length(2, 120) nameUz!: string;
  @IsIn(RJUS) rju!: Rju;
  @IsOptional() @IsString() @MaxLength(120) nameRu?: string;
  @IsOptional() @IsString() @MaxLength(120) nameEn?: string;
  @IsOptional() @Matches(/^\d{5,6}$/) esrCode?: string;
  @IsOptional() @IsString() @MaxLength(30) stationType?: string;
  @IsOptional() @IsString() @MaxLength(10) classRank?: string;
  @IsOptional() @IsLatitude() lat?: number;
  @IsOptional() @IsLongitude() lng?: number;
  @IsOptional() @IsBoolean() isListed?: boolean;
  @IsOptional() @IsBoolean() isTariff?: boolean;
}

class StationUpdateDto extends PartialType(StationCreateDto) {}

type Row = Record<string, unknown>;
/** Faqat haqiqatan kelgan kalitlar: PATCH da yo'q kalit ustunni null qilib yubormasin. */
const defined = (dto: object): Row => Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined));
/** Sana ustunlari: Prisma "2026-01-01" kabi qisqa qatorni olmaydi, Date ga aylantiramiz. */
const terminalData = (dto: TerminalCreateDto | TerminalUpdateDto | TerminalCreateFullDto): Row => {
  const d = defined(dto);
  for (const k of ['contractStart', 'contractEnd']) if (typeof d[k] === 'string') d[k] = new Date(d[k] as string);
  return d;
};
/** Katta-kichik harf farqsiz qidiruv. */
const like = (text: string) => ({ contains: text, mode: 'insensitive' as const });

/**
 * Platforma egasi uchun katalog reestri: terminallar (~1716 qator, asosan shahobcha yo'l)
 * va rasmiy stansiya ro'yxati (284). Import qilingan ma'lumotdagi xatoni (nom, koordinata,
 * stansiyaga bog'lanish) admin shu yerdan to'g'rilaydi; ommaviy katalog o'sha zahoti yangilanadi.
 */
@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtGuard, PlatformAdminGuard)
@ApiCookieAuth('ys_access')
export class AdminCatalogController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ───────────────────────── Terminallar ─────────────────────────

  /** Ro'yxat: qidiruv reestr nomlarini ham qamraydi (stationNameRaw, ownerNameRaw). */
  @Get('catalog/terminals')
  async terminals(
    @Query('q') q?: string,
    @Query('kind') kind?: string,
    @Query('region') region?: string,
    @Query('status') status?: string,
    @Query('claim') claim?: string,
    @Query('owned') owned?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = clampInt(page, 1, 1, 100_000), l = clampInt(limit, 30, 1, 100);
    const text = q?.trim();
    const where: Prisma.TerminalWhereInput = {
      ...(text ? { OR: [{ name: like(text) }, { address: like(text) }, { stationNameRaw: like(text) }, { ownerNameRaw: like(text) }] } : {}),
      kind: pickIn(kind, TERMINAL_KINDS),
      regionCode: pickIn(region, REGIONS),
      status: pickIn(status, TERMINAL_STATUSES),
      claimStatus: pickIn(claim, CLAIM_STATUSES),
      orgId: owned === '1' ? { not: null } : owned === '0' ? null : undefined,
    };
    const [total, items] = await Promise.all([
      this.prisma.terminal.count({ where }),
      this.prisma.terminal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * l,
        take: l,
        select: {
          id: true, slug: true, name: true, kind: true, status: true, regionCode: true, orgId: true,
          claimStatus: true, lat: true, lng: true, registryNo: true, stationNameRaw: true, ownerNameRaw: true,
          contactName: true, createdAt: true,
          station: { select: { id: true, nameUz: true, esrCode: true } },
          org: { select: { id: true, name: true } },
        },
      }),
    ]);
    return { items, total, page: p, limit: l };
  }

  @Get('catalog/terminals/:id')
  async terminal(@Param('id') id: string) {
    const t = await this.prisma.terminal.findUnique({
      where: { id },
      include: { station: true, org: { select: { id: true, name: true } } },
    });
    if (!t) throw new NotFoundException({ code: 'TERMINAL_NOT_FOUND' });
    return t;
  }

  @Post('catalog/terminals')
  async createTerminal(@CurrentUserId() userId: string, @Body() dto: TerminalCreateFullDto) {
    const data = terminalData(dto) as Prisma.TerminalUncheckedCreateInput;
    if (dto.slug && (await this.prisma.terminal.findUnique({ where: { slug: dto.slug }, select: { id: true } }))) throw new ConflictException({ code: 'SLUG_TAKEN', slug: dto.slug });
    data.slug = dto.slug ?? (await this.freeSlug(slugify(dto.name) || 'terminal'));
    const t = await this.prisma.terminal.create({ data });
    await this.audit.log({ actorId: userId, action: 'admin.terminal.create', entity: 'Terminal', entityId: t.id, meta: { name: t.name, kind: t.kind, slug: t.slug } });
    return t;
  }

  @Patch('catalog/terminals/:id')
  async updateTerminal(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: TerminalUpdateDto) {
    const data = terminalData(dto);
    // Noyob ustunlar: bandligi oldindan tekshiriladi, aks holda Prisma P2002 xom 500 bo'lib chiqardi
    if (dto.slug) {
      const busy = await this.prisma.terminal.findUnique({ where: { slug: dto.slug }, select: { id: true } });
      if (busy && busy.id !== id) throw new ConflictException({ code: 'SLUG_TAKEN', slug: dto.slug });
    }
    if (dto.registryNo !== undefined) {
      const busy = await this.prisma.terminal.findUnique({ where: { registryNo: dto.registryNo }, select: { id: true } });
      if (busy && busy.id !== id) throw new ConflictException({ code: 'REGISTRY_NO_TAKEN', registryNo: dto.registryNo });
    }
    const t = await this.prisma.terminal.update({ where: { id }, data: data as Prisma.TerminalUncheckedUpdateInput });
    await this.audit.log({ actorId: userId, action: 'admin.terminal.update', entity: 'Terminal', entityId: id, meta: { fields: Object.keys(data) } });
    return t;
  }

  /**
   * O'chirish: buyurtmasi bo'lgan terminal o'chmaydi, aks holda buyurtma tarixi yo'qoladi
   * (Order.terminalId majburiy bog'lanish). Bunday holatda status HIDDEN qilinadi:
   * terminal katalogdan yo'qoladi, ma'lumoti esa joyida qoladi.
   */
  @Delete('catalog/terminals/:id')
  async deleteTerminal(@CurrentUserId() userId: string, @Param('id') id: string) {
    const t = await this.prisma.terminal.findUnique({ where: { id }, select: { name: true } });
    if (!t) throw new NotFoundException({ code: 'TERMINAL_NOT_FOUND' });
    const orders = await this.prisma.order.count({ where: { terminalId: id } });
    if (orders) throw new ConflictException({ code: 'TERMINAL_HAS_ORDERS', orders, hint: 'status: HIDDEN' });
    await this.prisma.terminal.delete({ where: { id } });
    await this.audit.log({ actorId: userId, action: 'admin.terminal.delete', entity: 'Terminal', entityId: id, meta: { name: t.name } });
    return { id, deleted: true };
  }

  /** Slug band bo'lsa -2, -3 ...: reestrda bir xil nomli yo'llar ko'p. */
  private async freeSlug(base: string): Promise<string> {
    for (let i = 1; ; i++) {
      const slug = i === 1 ? base : `${base}-${i}`;
      if (!(await this.prisma.terminal.findUnique({ where: { slug }, select: { id: true } }))) return slug;
    }
  }

  // ───────────────────────── Stansiyalar ─────────────────────────

  /** `coords=0`: koordinatasi yo'q stansiyalar, ya'ni xaritada hali ko'rinmaydiganlar. */
  @Get('catalog/stations')
  async stations(
    @Query('q') q?: string,
    @Query('rju') rju?: string,
    @Query('listed') listed?: string,
    @Query('coords') coords?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = clampInt(page, 1, 1, 100_000), l = clampInt(limit, 50, 1, 200);
    const text = q?.trim();
    const where: Prisma.StationWhereInput = {
      ...(text ? { OR: [{ nameUz: like(text) }, { nameRu: like(text) }, { nameEn: like(text) }, { esrCode: like(text) }] } : {}),
      rju: pickIn(rju, RJUS),
      isListed: listed === '1' ? true : listed === '0' ? false : undefined,
      lat: coords === '0' ? null : coords === '1' ? { not: null } : undefined,
    };
    const [total, items] = await Promise.all([
      this.prisma.station.count({ where }),
      this.prisma.station.findMany({
        where,
        orderBy: { nameUz: 'asc' },
        skip: (p - 1) * l,
        take: l,
        include: { _count: { select: { terminals: true } } },
      }),
    ]);
    return { items, total, page: p, limit: l };
  }

  @Post('catalog/stations')
  async createStation(@CurrentUserId() userId: string, @Body() dto: StationCreateDto) {
    const s = await this.prisma.station.create({ data: defined(dto) as Prisma.StationUncheckedCreateInput });
    await this.audit.log({ actorId: userId, action: 'admin.station.create', entity: 'Station', entityId: s.id, meta: { nameUz: s.nameUz, rju: s.rju, esrCode: s.esrCode } });
    return s;
  }

  @Patch('catalog/stations/:id')
  async updateStation(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: StationUpdateDto) {
    const data = defined(dto);
    const s = await this.prisma.station.update({ where: { id }, data: data as Prisma.StationUncheckedUpdateInput });
    await this.audit.log({ actorId: userId, action: 'admin.station.update', entity: 'Station', entityId: id, meta: { fields: Object.keys(data) } });
    return s;
  }

  /**
   * O'chirish: terminal bog'langan bo'lsa yo'q. Bu bog'lanish ixtiyoriy, ya'ni Prisma
   * stansiyani o'chirib terminallardagi stationId ni jimgina null qilib qo'yardi va
   * pasportdan stansiya yo'qolardi. Buyurtma ham tekshiriladi: u majburiy bog'lanish.
   */
  @Delete('catalog/stations/:id')
  async deleteStation(@CurrentUserId() userId: string, @Param('id') id: string) {
    const s = await this.prisma.station.findUnique({ where: { id }, select: { nameUz: true } });
    if (!s) throw new NotFoundException({ code: 'STATION_NOT_FOUND' });
    const [terminals, orders] = await Promise.all([
      this.prisma.terminal.count({ where: { stationId: id } }),
      this.prisma.order.count({ where: { stationId: id } }),
    ]);
    if (terminals || orders) throw new ConflictException({ code: 'STATION_IN_USE', terminals, orders });
    await this.prisma.station.delete({ where: { id } });
    await this.audit.log({ actorId: userId, action: 'admin.station.delete', entity: 'Station', entityId: id, meta: { nameUz: s.nameUz } });
    return { id, deleted: true };
  }
}
