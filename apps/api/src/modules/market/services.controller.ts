import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, HttpCode, HttpException, NotFoundException, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { LISTING, MARKET, REGIONS, SERVICE_TYPES, normalizePhone, type ServiceType } from '@yuksaroy/domain';
import { PHOTO_URL } from '../../common/file-url';
import { AuditService } from '../../common/audit.service';
import { IpBucket } from '../../common/ip-bucket';
import { PrismaService } from '../../common/prisma.service';
import { clampInt } from '../catalog/presentation/catalog.controller';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { MarketService } from './market.service';

class ProfileDto {
  @IsIn(SERVICE_TYPES) serviceType!: ServiceType;
  @IsString() @MaxLength(MARKET.titleMax) title!: string;
  @IsString() @MaxLength(MARKET.descriptionMax) description!: string;
  @IsArray() @ArrayMaxSize(REGIONS.length) @IsIn(REGIONS, { each: true }) regions!: string[];
  @IsOptional() @IsInt() @Min(0) @Max(60) experienceYears?: number;
  @IsOptional() @IsString() @MaxLength(120) priceNote?: string;
  @IsOptional() @IsString() @MaxLength(20) contactPhone?: string;
  /** Faqat o'z serverimizdagi surat: begona manzil sahifada chizilmasin */
  @IsOptional() @IsArray() @ArrayMaxSize(LISTING.maxPhotos) @Matches(PHOTO_URL, { each: true }) @MaxLength(500, { each: true }) photos?: string[];
  @IsOptional() @IsString() orgId?: string;
}
/** Tahrirda hamma maydon ixtiyoriy; tur o'zgarmaydi (bir tur = bir profil). */
class PatchProfileDto {
  @IsOptional() @IsString() @MaxLength(MARKET.titleMax) title?: string;
  @IsOptional() @IsString() @MaxLength(MARKET.descriptionMax) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(REGIONS.length) @IsIn(REGIONS, { each: true }) regions?: string[];
  @IsOptional() @IsInt() @Min(0) @Max(60) experienceYears?: number;
  @IsOptional() @IsString() @MaxLength(120) priceNote?: string;
  @IsOptional() @IsString() @MaxLength(20) contactPhone?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(LISTING.maxPhotos) @Matches(PHOTO_URL, { each: true }) @MaxLength(500, { each: true }) photos?: string[];
  @IsOptional() @IsIn(['ACTIVE', 'HIDDEN']) status?: 'ACTIVE' | 'HIDDEN';
}

type Row = {
  id: string; userId: string; orgId: string | null; serviceType: string; title: string; description: string; regions: string[];
  experienceYears: number | null; priceNote: string | null; contactPhone: string | null; status: string; isDemo: boolean; createdAt: Date; updatedAt: Date;
  user: { fullName: string | null }; org: { name: string; slug: string | null; kycStatus: string } | null;
};
const INCLUDE = { user: { select: { fullName: true } }, org: { select: { name: true, slug: true, kycStatus: true } } } as const;

/** Ochiq karta: telefon yo'q (hasPhone), tavsif qisqartirilgan; full = to'liq tavsif. Egasi uchun withPhone. */
export function profileView(p: Row, full = false, withPhone = false) {
  const { contactPhone, user, org, ...rest } = p;
  return {
    ...rest, description: full ? p.description : p.description.slice(0, 240),
    hasPhone: !!contactPhone?.trim(), ...(withPhone ? { contactPhone } : {}),
    owner: org?.name ?? user.fullName ?? null, ownerOrg: org ? { name: org.name, slug: org.slug, kyc: org.kycStatus } : null,
  };
}

// Profil yaratish kam bo'ladigan amal; soatiga 5 ta spamdan yetarli
const createBucket = new IpBucket(5, 3_600_000);
const phoneOf = (raw: string | undefined): string | null => {
  if (!raw?.trim()) return null;
  const p = normalizePhone(raw);
  if (!p) throw new BadRequestException({ code: 'VALIDATION', errors: { contactPhone: 'INVALID' } });
  return p;
};
const clean = (s: string | undefined) => (s == null ? undefined : s.trim() || null);

/** Xizmat profillari: ekspeditor, tovar kassiri, hujjat to'ldiruvchi o'zini e'lon qiladi. */
@ApiTags('services')
@Controller('services/profiles')
export class ServicesController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly market: MarketService) {}

  @Get()
  async list(@Query('type') type?: string, @Query('region') region?: string, @Query('page') page?: string, @Query('limit') lim?: string) {
    const p = clampInt(page, 1, 1, 10_000);
    const take = clampInt(lim, 24, 1, MARKET.listTake);
    const where: Prisma.ServiceProfileWhereInput = {
      status: 'ACTIVE',
      ...(type && (SERVICE_TYPES as readonly string[]).includes(type) ? { serviceType: type } : {}),
      // Viloyat tanlanmagan (bo'sh ro'yxat) profil hamma joyda ishlaydi deb hisoblanadi
      ...(region && (REGIONS as readonly string[]).includes(region) ? { OR: [{ regions: { has: region } }, { regions: { isEmpty: true } }] } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.serviceProfile.count({ where }),
      this.prisma.serviceProfile.findMany({ where, include: INCLUDE, orderBy: [{ isDemo: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }], skip: (p - 1) * take, take }),
    ]);
    // Butun sahifaga bitta guruhlash so'rovi: profil boshiga so'rov yuborilmaydi
    const done = await this.market.doneCounts(rows.map((r) => r.userId));
    return { items: rows.map((r) => ({ ...profileView(r), doneCount: done.get(r.userId) ?? 0 })), total, page: p, limit: take };
  }

  /** `mine` yo'li `:id` dan oldin turishi shart. */
  @Get('mine') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access')
  async mine(@CurrentUserId() userId: string) {
    const rows = await this.prisma.serviceProfile.findMany({ where: { userId }, include: INCLUDE, orderBy: { createdAt: 'asc' } });
    return { items: rows.map((r) => profileView(r, true, true)) };
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    const r = await this.prisma.serviceProfile.findFirst({ where: { id, status: 'ACTIVE' }, include: INCLUDE });
    if (!r) throw new NotFoundException({ code: 'PROFILE_NOT_FOUND' });
    const done = await this.market.doneCounts([r.userId]);
    return { ...profileView(r, true), doneCount: done.get(r.userId) ?? 0 };
  }

  @Post() @UseGuards(JwtGuard) @ApiCookieAuth('ys_access') @HttpCode(201)
  async create(@CurrentUserId() userId: string, @Body() dto: ProfileDto) {
    if (!createBucket.take(userId)) throw new HttpException({ code: 'RATE_LIMITED' }, 429);
    if (!dto.title.trim() || !dto.description.trim()) throw new BadRequestException({ code: 'VALIDATION', errors: { ...(dto.title.trim() ? {} : { title: 'REQUIRED' }), ...(dto.description.trim() ? {} : { description: 'REQUIRED' }) } });
    let r;
    try {
      r = await this.prisma.serviceProfile.create({
        data: {
          userId, orgId: await this.market.memberOrgId(userId, dto.orgId), serviceType: dto.serviceType, title: dto.title.trim(), description: dto.description.trim(),
          regions: [...new Set(dto.regions)], experienceYears: dto.experienceYears ?? null, priceNote: clean(dto.priceNote) ?? null, contactPhone: phoneOf(dto.contactPhone),
          photos: dto.photos ?? [],
        },
        include: INCLUDE,
      });
    } catch (e) {
      // Bir odam bir turda bitta profil: bazadagi noyob indeks (userId, serviceType) tekshiradi, ikki parallel yaratish ham o'tmaydi.
      // Yashiringan bo'lsa ham qayta yaratilmaydi, tahrirlanadi.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException({ code: 'PROFILE_EXISTS' });
      throw e;
    }
    await this.audit.log({ actorId: userId, action: 'service.profile.create', entity: 'ServiceProfile', entityId: r.id, meta: { serviceType: r.serviceType } });
    return profileView(r, true, true);
  }

  @Patch(':id') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access')
  async patch(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: PatchProfileDto) {
    await this.owned(userId, id);
    const r = await this.save(id, {
      ...(dto.title != null ? { title: dto.title.trim() || undefined } : {}),
      ...(dto.description != null ? { description: dto.description.trim() || undefined } : {}),
      ...(dto.regions ? { regions: [...new Set(dto.regions)] } : {}),
      ...(dto.experienceYears !== undefined ? { experienceYears: dto.experienceYears } : {}),
      ...(dto.priceNote !== undefined ? { priceNote: clean(dto.priceNote) } : {}),
      ...(dto.contactPhone !== undefined ? { contactPhone: phoneOf(dto.contactPhone) } : {}),
      ...(dto.photos ? { photos: dto.photos } : {}),
      ...(dto.status ? { status: dto.status } : {}),
    });
    await this.audit.log({ actorId: userId, action: 'service.profile.update', entity: 'ServiceProfile', entityId: id, meta: { status: dto.status ?? null } });
    return profileView(r, true, true);
  }

  @Post(':id/hide') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access') @HttpCode(200)
  async hide(@CurrentUserId() userId: string, @Param('id') id: string) {
    await this.owned(userId, id);
    const r = await this.save(id, { status: 'HIDDEN' });
    await this.audit.log({ actorId: userId, action: 'service.profile.hide', entity: 'ServiceProfile', entityId: id });
    return profileView(r, true, true);
  }

  private async owned(userId: string, id: string) {
    const r = await this.prisma.serviceProfile.findUnique({ where: { id }, select: { userId: true } });
    if (!r) throw new NotFoundException({ code: 'PROFILE_NOT_FOUND' });
    if (r.userId !== userId) throw new ForbiddenException({ code: 'NOT_OWNER' });
  }

  /**
   * Egasining yozuvi faqat ACTIVE yoki HIDDEN profilga. Admin yashirgan (BLOCKED) profilni egasi
   * tahrirlay ham, qayta ocha ham olmaydi; shart yozuvning o'zida, orada bloklansa ham o'tmaydi.
   */
  private async save(id: string, data: Prisma.ServiceProfileUpdateInput) {
    try {
      return await this.prisma.serviceProfile.update({ where: { id, status: { in: ['ACTIVE', 'HIDDEN'] } }, data, include: INCLUDE });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') throw new ConflictException({ code: 'PROFILE_BLOCKED' });
      throw e;
    }
  }
}
