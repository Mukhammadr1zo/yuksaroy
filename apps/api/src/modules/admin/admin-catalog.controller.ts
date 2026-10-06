import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags, PartialType } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, Length, Matches, MaxLength, Min } from 'class-validator';
import type { FastifyReply } from 'fastify';
import {
  CLAIM_STATUSES, OWNER_KINDS, REGIONS, RJUS, TERMINAL_KINDS, TERMINAL_STATUSES, slugify, storePhone,
  type ClaimStatus, type OwnerKind, type RegionCode, type Rju, type TerminalKind, type TerminalStatus,
} from '@yuksaroy/domain';
import { AuditService } from '../../common/audit.service';
import { CSV_MAX, sendCsv, type CsvCols } from '../../common/csv';
import { BULK_MAX, orderByOf, parseIds, type SortAllow } from '../../common/list-sort';
import { PrismaService } from '../../common/prisma.service';
import { clampInt, pickIn } from '../catalog/presentation/catalog.controller';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { dayKeys } from '../impressions/day-series';
import { PlatformAdminGuard } from '../organizations/presentation/platform-admin.guard';
import { regionOfPoint } from '../catalog/domain/region-of-point';
import { PlatformOwnerGuard } from '../organizations/presentation/platform-owner.guard';
import { noteCount } from './admin-notes.controller';
import { ownerKindWhere } from './owner-kind.where';
import { ImpressionsService } from '../impressions/impressions.service';

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
  @IsOptional() @IsLatitude() lat?: number;
  @IsOptional() @IsLongitude() lng?: number;
  @IsOptional() @IsBoolean() isListed?: boolean;
}

class StationUpdateDto extends PartialType(StationCreateDto) {}

/** Tanlangan qatorlar ustida guruh amali. Izohi bulk ustida. */
class BulkDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(BULK_MAX) @IsString({ each: true }) ids!: string[];
  @IsIn(['HIDE', 'ACTIVATE']) action!: 'HIDE' | 'ACTIVATE';
}

/** Reestr tozalash uchun guruh amali. Izohi bulkByOwner ustida. */
class BulkOwnerDto {
  @IsIn(OWNER_KINDS) ownerKind!: OwnerKind;
  @IsIn(['HIDE', 'DELETE']) action!: 'HIDE' | 'DELETE';
  /** Operator ekranda ko'rgan son. Farq qilsa amal bajarilmaydi. */
  @IsInt() @Min(0) expect!: number;
  /** Bog'liq qatorlari bor bo'lsa ham o'chirishga ataylab berilgan tasdiq. */
  @IsOptional() @IsBoolean() force?: boolean;
}

type Row = Record<string, unknown>;
/** Faqat haqiqatan kelgan kalitlar: PATCH da yo'q kalit ustunni null qilib yubormasin. */
const defined = (dto: object): Row => Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined));
/** Sana ustunlari: Prisma "2026-01-01" kabi qisqa qatorni olmaydi, Date ga aylantiramiz. */
const terminalData = (dto: TerminalCreateDto | TerminalUpdateDto | TerminalCreateFullDto): Row => {
  const d = defined(dto);
  for (const k of ['contractStart', 'contractEnd']) if (typeof d[k] === 'string') d[k] = new Date(d[k] as string);
  // Mas'ul shaxs raqami da'vo qarorida foydalanuvchining raqami bilan solishtiriladi
  for (const k of ['phone', 'contactPhone']) if (typeof d[k] === 'string') d[k] = storePhone(d[k] as string);
  return d;
};
/** Katta-kichik harf farqsiz qidiruv. */
const like = (text: string) => ({ contains: text, mode: 'insensitive' as const });

/**
 * Platforma egasi uchun katalog reestri: terminallar (~1716 qator, asosan shahobcha yo'l)
 * va rasmiy stansiya ro'yxati (284). Import qilingan ma'lumotdagi xatoni (nom, koordinata,
 * stansiyaga bog'lanish) admin shu yerdan to'g'rilaydi; ommaviy katalog o'sha zahoti yangilanadi.
 */
/** Ro'yxat proyeksiyasi: sukut tartib ham, talab tartibi ham shu ustunlarni beradi. */
const LIST_SELECT = {
  id: true, slug: true, name: true, kind: true, status: true, regionCode: true, orgId: true,
  claimStatus: true, lat: true, lng: true, registryNo: true, stationNameRaw: true, ownerNameRaw: true,
  contactName: true, createdAt: true,
  station: { select: { id: true, nameUz: true, esrCode: true } },
  org: { select: { id: true, name: true } },
};
type ListRow = Prisma.TerminalGetPayload<{ select: typeof LIST_SELECT }>;

/** Jadval sarlavhasidan tartiblanadigan ustunlar; sana yangi birinchi, matn alifbo. */
const SORT: SortAllow<Prisma.TerminalOrderByWithRelationInput> = {
  name: { def: 'asc' }, createdAt: { def: 'desc' }, registryNo: { def: 'asc' },
  status: { def: 'asc' }, claimStatus: { def: 'asc' }, regionCode: { def: 'asc' },
};

/** CSV ustunlari qat'iy: stansiya bog'langan bo'lsa uning nomi, bo'lmasa reestrdagi matn. */
const CSV: CsvCols<ListRow> = {
  id: (r) => r.id, name: (r) => r.name, slug: (r) => r.slug, kind: (r) => r.kind, status: (r) => r.status,
  regionCode: (r) => r.regionCode, station: (r) => r.station?.nameUz ?? r.stationNameRaw, org: (r) => r.org?.name,
  ownerNameRaw: (r) => r.ownerNameRaw, claimStatus: (r) => r.claimStatus, registryNo: (r) => r.registryNo, createdAt: (r) => r.createdAt,
};

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtGuard, PlatformAdminGuard)
@ApiCookieAuth('ys_access')
export class AdminCatalogController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly impressions: ImpressionsService,
  ) {}

  // ───────────────────────── Terminallar ─────────────────────────

  /**
   * Ro'yxat: qidiruv reestr nomlarini ham qamraydi (stationNameRaw, ownerNameRaw).
   * ?sort&dir jadval sarlavhasidan (oq ro'yxat, tiebreak id), ?ids tanlangan qatorlar,
   * ?orgId tashkilot sahifasining Bog'liq yorlig'i, ?format=csv eksport (ustunlar serverda).
   */
  @Get('catalog/terminals')
  async terminals(
    @Query('q') q?: string,
    @Query('kind') kind?: string,
    @Query('region') region?: string,
    @Query('status') status?: string,
    @Query('claim') claim?: string,
    @Query('owned') owned?: string,
    @Query('ownerKind') ownerKind?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('dir') dir?: string,
    @Query('ids') ids?: string,
    @Query('orgId') orgId?: string,
    @Query('format') format?: string,
    @CurrentUserId() userId?: string,
    @Res({ passthrough: true }) reply?: FastifyReply,
  ) {
    const p = clampInt(page, 1, 1, 100_000), l = clampInt(limit, 30, 1, 100);
    const text = q?.trim();
    const idList = parseIds(ids);
    const where: Prisma.TerminalWhereInput = {
      // slug ham qidiriladi: murojaatdan kelgan manzilni to'g'ridan-to'g'ri qo'yib topish uchun
      ...(text ? { OR: [{ name: like(text) }, { slug: like(text) }, { address: like(text) }, { stationNameRaw: like(text) }, { ownerNameRaw: like(text) }] } : {}),
      kind: pickIn(kind, TERMINAL_KINDS),
      regionCode: pickIn(region, REGIONS),
      status: pickIn(status, TERMINAL_STATUSES),
      claimStatus: pickIn(claim, CLAIM_STATUSES),
      orgId: orgId || (owned === '1' ? { not: null } : owned === '0' ? null : undefined),
      id: idList ? { in: idList } : undefined,
      // AND ichida: yuqoridagi matn qidiruvi ham OR ishlatadi, ikkisi bir sathda
      // bo'lsa biri ikkinchisini ustidan yozib ketardi
      ...(pickIn(ownerKind, OWNER_KINDS) ? { AND: [ownerKindWhere(ownerKind as OwnerKind)] } : {}),
    };
    /*
     * sort=demand: qaysi obyektga birinchi qo'ng'iroq qilish kerakligi.
     *
     * Ikki son, ikkalasi ham qaror uchun: 30 kunda sahifa necha marta ochilgani (talab
     * bor-yo'qligi) va javobsiz yozishmalar soni (odam allaqachon yozgan, javob yo'q).
     * Viloyat kesimidagi ochiq so'rovlar ustuni qo'shilmaydi: u bitta viloyatdagi hamma
     * qatorda bir xil chiqadi, ya'ni qatorlarni bir-biridan ajratmaydi.
     *
     * ponytail: avval umumiy top 100, keyin filtr. Ya'ni bu "filtr ichidagi top 100" emas,
     * "umumiy top 100 ning filtrga tushgani". Filtr ichida kerak bo'lsa Impression bilan
     * Terminal $queryRaw da birlashtiriladi.
     */
    const orderBy = orderByOf(sort, dir, SORT, 'createdAt');
    // CSV demand shoxidan oldin: ekran sort=demand bilan ham eksport so'raydi, demand shoxi esa
    // JSON qaytarib brauzer uni fayl qilib saqlardi va audit yozilmasdi. orderByOf 'demand' ni
    // bilmaydi, eksport createdAt tartibida chiqadi
    if (format === 'csv') {
      return sendCsv({
        reply: reply!, audit: this.audit, actorId: userId!, resource: 'terminals',
        filters: { q, kind, region, status, claim, owned, ownerKind, orgId, ids, sort, dir },
        total: await this.prisma.terminal.count({ where }),
        rows: () => this.prisma.terminal.findMany({ where, orderBy, take: CSV_MAX, select: LIST_SELECT }),
        cols: CSV,
      });
    }
    if (sort === 'demand') {
      const top = await this.impressions.topDetailViews('terminal', 100);
      if (!top.length) return { items: [], total: 0, page: p, limit: l };
      const rank = new Map(top.map((x, i) => [x.id, { i, views: x.views }] as const));
      // Namunaning egasi ham, telefoni ham yo'q: unga qo'ng'iroq qilinmaydi
      const ranked = (await this.prisma.terminal.findMany({
        where: { ...where, id: { in: [...rank.keys()] }, isDemo: false },
        select: LIST_SELECT,
      })).sort((a, b) => rank.get(a.id)!.i - rank.get(b.id)!.i); // Prisma IN tartibini saqlamaydi
      const pageRows = ranked.slice((p - 1) * l, p * l);
      // Javobsiz = hech javob berilmagan yozishma: obyekt tarafi bir marta yozsa
      // status ANSWERED bo'ladi va bu yerga tushmaydi
      const open = pageRows.length
        ? await this.prisma.inquiry.groupBy({
            by: ['terminalId'],
            where: { terminalId: { in: pageRows.map((r) => r.id) }, status: 'OPEN' },
            _count: { _all: true },
          })
        : [];
      const unanswered = new Map(open.map((o) => [o.terminalId!, o._count._all] as const));
      return {
        items: pageRows.map((r) => ({ ...r, views30: rank.get(r.id)!.views, openInquiries: unanswered.get(r.id) ?? 0 })),
        total: ranked.length, page: p, limit: l,
      };
    }
    const [total, items] = await Promise.all([
      this.prisma.terminal.count({ where }),
      this.prisma.terminal.findMany({ where, orderBy, skip: (p - 1) * l, take: l, select: LIST_SELECT }),
    ]);
    return { items, total, page: p, limit: l };
  }

  /**
   * Obyekt sahifasi bitta so'rov bilan to'lsin: pasport + oxirgi tariflar + sonlar.
   * Har son qaror uchun: 30 kunlik ochilish (talab bor, egasiga qo'ng'iroq), javobsiz
   * yozishma (platforma javob berishi kerak), buyurtmalar (buyurtmasi bor terminal
   * o'chmaydi, yashiriladi; komissiya kiritilsa manba), izohlar soni (kimdir ishlaganmi).
   */
  @Get('catalog/terminals/:id')
  async terminal(@Param('id') id: string) {
    const t = await this.prisma.terminal.findUnique({
      where: { id },
      include: {
        station: true,
        org: { select: { id: true, name: true } },
        tariffs: { orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, serviceCode: true, priceTiyin: true, unit: true, createdAt: true } },
      },
    });
    if (!t) throw new NotFoundException({ code: 'TERMINAL_NOT_FOUND' });
    const [notesCount, views, openInquiries, done, pending] = await Promise.all([
      noteCount(this.prisma, 'Terminal', id),
      this.prisma.impression.aggregate({ where: { kind: 'terminal', targetId: id, surface: 'detail', day: { gte: new Date(dayKeys(new Date())[0]!) } }, _sum: { count: true } }),
      this.prisma.inquiry.count({ where: { terminalId: id, status: 'OPEN' } }),
      this.prisma.order.aggregate({ where: { terminalId: id, status: 'DONE' }, _count: { _all: true }, _sum: { totalTiyin: true } }),
      this.prisma.order.count({ where: { terminalId: id, status: 'PENDING' } }),
    ]);
    return {
      ...t,
      tariffs: t.tariffs.map((x) => ({ ...x, priceTiyin: Number(x.priceTiyin) })), // BigInt JSON ga chiqmaydi
      notesCount,
      stats: {
        views30: views._sum.count ?? 0,
        openInquiries,
        orders: { done: done._count._all, doneTiyin: Number(done._sum.totalTiyin ?? 0n), pending },
      },
    };
  }

  /**
   * Tanlangan qatorlar ustida guruh amali: yashirish yoki faollashtirish.
   *
   * Yashirish qaytariladigan amal (PATCH status ham admin darajasida), shuning uchun
   * operatorga ochiq; o'chirish bu yerda yo'q (bulk-owner qoladi, ega). expect yo'q:
   * ids aniq ro'yxat, ekrandagi son bilan solishtiradigan narsa yo'q. Namuna qatorlar
   * o'tkazib yuboriladi: ular saytni to'ldirish uchun, holati qo'lda o'zgarmaydi.
   * Audit har o'zgargan qatorga alohida: "shu terminal nega yashirin" degan savol
   * entityId bo'yicha qidiriladi.
   */
  @Post('catalog/terminals/bulk')
  async bulk(@CurrentUserId() userId: string, @Body() dto: BulkDto) {
    const to = dto.action === 'HIDE' ? 'HIDDEN' : 'ACTIVE';
    const rows = await this.prisma.terminal.findMany({
      where: { id: { in: dto.ids }, isDemo: false, status: { not: to } },
      select: { id: true, name: true, registryNo: true, status: true },
    });
    if (!rows.length) return { action: dto.action, done: 0, skipped: dto.ids.length };
    const res = await this.prisma.terminal.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { status: to } });
    await this.audit.logMany(rows.map((t) => ({
      actorId: userId, action: dto.action === 'HIDE' ? 'admin.terminal.bulkHide' : 'admin.terminal.bulkActivate',
      entity: 'Terminal', entityId: t.id, meta: { name: t.name, registryNo: t.registryNo, was: t.status },
    })));
    return { action: dto.action, done: res.count, skipped: dto.ids.length - res.count };
  }

  @Post('catalog/terminals')
  async createTerminal(@CurrentUserId() userId: string, @Body() dto: TerminalCreateFullDto) {
    const data = terminalData(dto) as Prisma.TerminalUncheckedCreateInput;
    await this.applyRegion(data, dto);
    if (dto.slug && (await this.prisma.terminal.findUnique({ where: { slug: dto.slug }, select: { id: true } }))) throw new ConflictException({ code: 'SLUG_TAKEN', slug: dto.slug });
    data.slug = dto.slug ?? (await this.freeSlug(slugify(dto.name) || 'terminal'));
    const t = await this.prisma.terminal.create({ data });
    await this.audit.log({ actorId: userId, action: 'admin.terminal.create', entity: 'Terminal', entityId: t.id, meta: { name: t.name, kind: t.kind, slug: t.slug } });
    return t;
  }

  @Patch('catalog/terminals/:id')
  async updateTerminal(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: TerminalUpdateDto) {
    const data = terminalData(dto);
    await this.applyRegion(data as Record<string, unknown>, dto, id);
    // Noyob ustunlar: bandligi oldindan tekshiriladi, aks holda Prisma P2002 xom 500 bo'lib chiqardi
    if (dto.slug) {
      const busy = await this.prisma.terminal.findUnique({ where: { slug: dto.slug }, select: { id: true } });
      if (busy && busy.id !== id) throw new ConflictException({ code: 'SLUG_TAKEN', slug: dto.slug });
    }
    if (dto.registryNo !== undefined) {
      const busy = await this.prisma.terminal.findUnique({ where: { registryNo: dto.registryNo }, select: { id: true } });
      if (busy && busy.id !== id) throw new ConflictException({ code: 'REGISTRY_NO_TAKEN', registryNo: dto.registryNo });
    }
    // Qo'lda tasdiqlashda egasi ham qo'yiladi: aks holda qator "tasdiqlangan" ko'rinadi,
    // lekin orgId bo'sh qolib, egasi o'z obyektiga na rasm, na narx qo'ya oladi
    if (dto.claimStatus === 'APPROVED' && dto.orgId === undefined) {
      const owner = dto.claimOrgId ?? (await this.prisma.terminal.findUnique({ where: { id }, select: { claimOrgId: true } }))?.claimOrgId;
      if (owner) (data as Record<string, unknown>).orgId = owner;
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
  // Qaytarib bo'lmaydi: tarif tarixi, baholar va joylar birga ketadi
  @Delete('catalog/terminals/:id')
  @UseGuards(PlatformOwnerGuard)
  async deleteTerminal(@CurrentUserId() userId: string, @Param('id') id: string, @Query('force') force?: string) {
    const t = await this.prisma.terminal.findUnique({ where: { id }, select: { name: true } });
    if (!t) throw new NotFoundException({ code: 'TERMINAL_NOT_FOUND' });
    const orders = await this.prisma.order.count({ where: { terminalId: id } });
    if (orders) throw new ConflictException({ code: 'TERMINAL_HAS_ORDERS', orders, hint: 'status: HIDDEN' });

    /*
     * Terminal o'chirilganda FK bo'yicha yana bir nechta jadval birga ketadi: tarif
     * tarixi, baholar, xizmatlar va slot kalendari. Ilgari bular haqida hech narsa
     * aytilmasdi va ikki bosishlik tasdiq bilan hammasi yo'qolardi.
     * Endi nima yo'qolishi sanab beriladi va o'chirish faqat ataylab tasdiqlangandan
     * keyin (force) bajariladi. Bo'sh terminalda hech narsa o'zgarmaydi: sanoq nol.
     */
    const [tariffs, reviews, services, slots, inquiries] = await Promise.all([
      this.prisma.tariff.count({ where: { terminalId: id } }),
      this.prisma.review.count({ where: { terminalId: id } }),
      this.prisma.terminalService.count({ where: { terminalId: id } }),
      this.prisma.timeSlot.count({ where: { terminalId: id } }),
      this.prisma.inquiry.count({ where: { terminalId: id } }),
    ]);
    const impact = { tariffs, reviews, services, slots, inquiries };
    const loses = tariffs + reviews + services + slots + inquiries;
    if (loses > 0 && force !== '1') {
      throw new ConflictException({ code: 'TERMINAL_HAS_DATA', ...impact, hint: 'force=1' });
    }

    await this.prisma.terminal.delete({ where: { id } });
    await this.audit.log({ actorId: userId, action: 'admin.terminal.delete', entity: 'Terminal', entityId: id, meta: { name: t.name, ...impact } });
    return { id, deleted: true, ...impact };
  }

  /**
   * Reestr tozalash: egasining turi bo'yicha guruh amali.
   *
   * Nega kerak: katalogdagi ~1700 qatorning bir qismi bozorga chiqmaydigan egalarga
   * tegishli (harbiy qism, jazoni ijro etish muassasasi, temir yo'lning o'z depolari,
   * davlat korxonalari, NGMK va AGMK kabi gigantlar). Ularni bittalab yon varaqdan
   * o'chirish ~200 qator uchun 800 bosish degani, ya'ni amalda bajarilmaydigan ish.
   *
   * Nega yashirish ham bor: reestr qatorlari registryNo bo'yicha upsert qilinadi
   * (prisma/seed/seed.ts). O'chirilgan qator keyingi import bilan qaytib keladi va
   * create shoxi uni ACTIVE qilib qo'yadi. HIDDEN qator esa update shoxida status ga
   * tegilmagani uchun HIDDEN bo'lib qoladi, ya'ni yashirish chidamliroq.
   *
   * Uch to'siq: ekranda ko'rilgan son (expect) bilan solishtirish, bitta chaqiruvdagi
   * chegara, va bog'liq qatorlari bor bo'lsa ataylab tasdiq (force). Buyurtmasi bor
   * terminal hech qachon o'chmaydi: o'tkazib yuboriladi va javobda sanab beriladi.
   */
  @Post('catalog/terminals/bulk-owner')
  @UseGuards(PlatformOwnerGuard)
  async bulkByOwner(@CurrentUserId() userId: string, @Body() dto: BulkOwnerDto) {
    const rows = await this.prisma.terminal.findMany({
      where: ownerKindWhere(dto.ownerKind),
      select: { id: true, name: true, registryNo: true, status: true, ownerNameRaw: true },
      orderBy: { id: 'asc' },
      take: BULK_MAX + 1,
    });
    if (rows.length > BULK_MAX) throw new BadRequestException({ code: 'BULK_TOO_MANY', max: BULK_MAX });
    // Operator ko'rgan ro'yxat bilan o'chadigan ro'yxat bir xil bo'lishi kerak
    if (rows.length !== dto.expect) throw new ConflictException({ code: 'BULK_COUNT_CHANGED', count: rows.length, expect: dto.expect });
    if (!rows.length) return { action: dto.action, done: 0, skipped: 0 };

    const ids = rows.map((r) => r.id);
    const meta = (t: (typeof rows)[number]) => ({ name: t.name, registryNo: t.registryNo, owner: t.ownerNameRaw, ownerKind: dto.ownerKind });

    if (dto.action === 'HIDE') {
      const res = await this.prisma.terminal.updateMany({ where: { id: { in: ids }, status: { not: 'HIDDEN' } }, data: { status: 'HIDDEN' } });
      await this.audit.logMany(rows.map((t) => ({ actorId: userId, action: 'admin.terminal.bulkHide', entity: 'Terminal', entityId: t.id, meta: { ...meta(t), was: t.status } })));
      return { action: 'HIDE', done: res.count, skipped: rows.length - res.count };
    }

    // Order.terminalId RESTRICT: buyurtmasi bor terminal o'chmaydi. Oldindan ajratmasak
    // butun amal FK xatosi bilan yiqilardi va nima o'chib, nima qolgani bilinmasdi.
    const busy = await this.prisma.order.findMany({ where: { terminalId: { in: ids } }, select: { terminalId: true }, distinct: ['terminalId'] });
    const blocked = new Set(busy.map((o) => o.terminalId));
    const gone = rows.filter((t) => !blocked.has(t.id));
    const goneIds = gone.map((t) => t.id);
    if (!goneIds.length) return { action: 'DELETE', done: 0, skipped: rows.length, orders: blocked.size };

    const [tariffs, reviews, services, slots, inquiries] = await Promise.all([
      this.prisma.tariff.count({ where: { terminalId: { in: goneIds } } }),
      this.prisma.review.count({ where: { terminalId: { in: goneIds } } }),
      this.prisma.terminalService.count({ where: { terminalId: { in: goneIds } } }),
      this.prisma.timeSlot.count({ where: { terminalId: { in: goneIds } } }),
      this.prisma.inquiry.count({ where: { terminalId: { in: goneIds } } }),
    ]);
    const impact = { tariffs, reviews, services, slots, inquiries };
    if (tariffs + reviews + services + slots + inquiries > 0 && !dto.force) {
      throw new ConflictException({ code: 'BULK_HAS_DATA', ...impact, count: goneIds.length, hint: 'force' });
    }

    // Audit o'chirishdan OLDIN: qator ketgandan keyin uning nomi ham qolmaydi
    await this.audit.logMany(gone.map((t) => ({ actorId: userId, action: 'admin.terminal.bulkDelete', entity: 'Terminal', entityId: t.id, meta: { ...meta(t), ...impact } })));
    const res = await this.prisma.terminal.deleteMany({ where: { id: { in: goneIds } } });
    return { action: 'DELETE', done: res.count, skipped: rows.length - res.count, orders: blocked.size, ...impact };
  }

  /**
   * Viloyat koordinatadan hisoblanadi.
   *
   * Sxemada shunday deb yozilgan edi, lekin uni hech narsa hisoblamasdi: koordinatani
   * to'g'rilagan operator terminalni eski viloyatda qoldirar, reestrdan kelgan qatorlarda
   * esa u umuman bo'sh edi va katalogdagi viloyat filtri ularni topmasdi.
   *
   * Operator viloyatni qo'lda yuborsa, hisob ustidan yozilmaydi: qo'lda kiritilgan
   * qiymat har doim ustun.
   *
   * O'z koordinatasi bo'lmagan terminal uchun stansiya koordinatasi olinadi: shahobcha
   * yo'llarning aksariyatida aynan shunday.
   */
  private async applyRegion(data: Record<string, unknown>, dto: { regionCode?: string; lat?: number | null; lng?: number | null; stationId?: string | null }, id?: string) {
    if (dto.regionCode !== undefined) return; // qo'lda kiritilgan
    let lat = dto.lat ?? null;
    let lng = dto.lng ?? null;
    if (lat == null || lng == null) {
      const stationId = dto.stationId ?? (id ? (await this.prisma.terminal.findUnique({ where: { id }, select: { stationId: true } }))?.stationId ?? null : null);
      if (!stationId) return;
      const st = await this.prisma.station.findUnique({ where: { id: stationId }, select: { lat: true, lng: true } });
      lat = st?.lat ?? null;
      lng = st?.lng ?? null;
    }
    const code = regionOfPoint(lat, lng);
    if (code) data.regionCode = code;
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
  // Qaytarib bo'lmaydi
  @Delete('catalog/stations/:id')
  @UseGuards(PlatformOwnerGuard)
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
