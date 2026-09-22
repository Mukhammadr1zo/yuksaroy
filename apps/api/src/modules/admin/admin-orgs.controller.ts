import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { KYC_STATUSES, ORG_KINDS, ROLES, type KycStatus, type OrgKind, type Role } from '@yuksaroy/domain';
import { AuditService } from '../../common/audit.service';
import { PLATFORM_ROLES } from './team/team.rules';
import { PrismaService } from '../../common/prisma.service';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { PlatformAdminGuard } from '../organizations/presentation/platform-admin.guard';
import { PlatformOwnerGuard } from '../organizations/presentation/platform-owner.guard';

class AdminUpdateOrgDto {
  @IsOptional() @IsString() @Length(2, 120) name?: string;
  @IsOptional() @IsString() @Length(2, 80) @Matches(/^[a-z0-9-]+$/) slug?: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(8) @IsIn(ORG_KINDS, { each: true }) kinds?: OrgKind[];
  @IsOptional() @IsString() @Matches(/^\d{9}$/) stir?: string;
  @IsOptional() @IsIn(KYC_STATUSES) kycStatus?: KycStatus;
  @IsOptional() @IsString() @MaxLength(500) kycNote?: string;
}
/** Rollar bu yerda `IsIn(ROLES)` bilan emas, qo'lda tekshiriladi: javob kodi BAD_ROLE bo'lishi kerak. */
class AddMemberDto {
  @IsString() userId!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(12) @IsString({ each: true }) roles!: string[];
  @IsOptional() @IsBoolean() isOwner?: boolean;
}
class UpdateMemberDto {
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsString({ each: true }) roles?: string[];
  @IsOptional() @IsBoolean() isOwner?: boolean;
}

/**
 * Platforma egasi uchun tashkilotlar boshqaruvi: ro'yxat, tahrir, o'chirish va a'zolar.
 *
 * Muhimi: yangi platforma admini AYNAN shu yerdan tayinlanadi - PLATFORM turidagi
 * tashkilotga `PLATFORM_ADMIN` roli bilan a'zo qo'shiladi (POST orgs/:id/members).
 * Ilgari buning uchun bazaga qo'lda SQL yozish kerak edi; endi amal audit izini ham qoldiradi.
 * Boshqa joyda (orgs.controller.ts) egasi PLATFORM_ADMIN ni taklif qila olmaydi - bu ataylab.
 */
@ApiTags('admin')
@ApiCookieAuth('ys_access')
@Controller('admin')
@UseGuards(JwtGuard, PlatformAdminGuard)
export class AdminOrgsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Rol nomlarini domen ro'yxatiga solishtiradi: noto'g'risi bo'lsa butun so'rov rad etiladi. */
  private checkRoles(roles: string[]): Role[] {
    const bad = roles.filter((r) => !(ROLES as readonly string[]).includes(r));
    if (bad.length) throw new BadRequestException({ code: 'BAD_ROLE', bad, allowed: ROLES });
    return roles as Role[];
  }

  /**
   * To'liq reestr. Yo'l `orgs/all`, chunki `GET /v1/admin/orgs` allaqachon KYC navbati
   * (orgs.controller.ts) va uni takrorlamaymiz.
   */
  @Get('orgs/all')
  async list(@Query('q') q?: string, @Query('kyc') kyc?: string, @Query('kind') kind?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    const p = Math.max(1, Number(page) || 1);
    const take = Math.min(100, Math.max(1, Number(limit) || 30));
    const text = q?.trim();
    const k = (ORG_KINDS as readonly string[]).includes(kind ?? '') ? (kind as OrgKind) : undefined;
    const where: Prisma.OrganizationWhereInput = {
      ...((KYC_STATUSES as readonly string[]).includes(kyc ?? '') ? { kycStatus: kyc as KycStatus } : {}),
      // eski qatorlarda `kinds` bo'sh, faqat `kind` to'lgan bo'lishi mumkin: ikkalasini ham qaraymiz
      ...(k ? { AND: [{ OR: [{ kinds: { has: k } }, { kind: k }] }] } : {}),
      ...(text
        ? {
            OR: [
              { name: { contains: text, mode: 'insensitive' as const } },
              { slug: { contains: text, mode: 'insensitive' as const } },
              { stir: { contains: text, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * take,
        take,
        select: {
          id: true, name: true, slug: true, kinds: true, stir: true, kycStatus: true, createdAt: true,
          _count: { select: { members: true, terminals: true, listings: true } },
        },
      }),
    ]);
    return { items, total, page: p, limit: take };
  }

  /** Bitta tashkilot: barcha maydonlar, a'zolar va nimaga egalik qilishi. */
  @Get('orgs/:id')
  async one(@Param('id') id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        members: { select: { userId: true, roles: true, isOwner: true, createdAt: true, user: { select: { phone: true, fullName: true } } } },
        _count: { select: { terminals: true, listings: true, orders: true } },
      },
    });
    if (!org) throw new NotFoundException({ code: 'ORG_NOT_FOUND' });
    const { members, _count, ...rest } = org;
    return {
      ...rest,
      counts: _count,
      members: members.map((m) => ({ id: m.userId, phone: m.user.phone, fullName: m.user.fullName, roles: m.roles, isOwner: m.isOwner, createdAt: m.createdAt })),
    };
  }

  /** Yuborilmagan maydon ustiga yozilmaydi: `data` faqat aniq kelgan kalitlardan yig'iladi. */
  @Patch('orgs/:id')
  async update(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: AdminUpdateOrgDto) {
    // PLATFORM turi bu yerdan berilmaydi (create-org.usecase ham taqiqlaydi): shu tur
    // tashkilotda a'zo taklif qilish platforma rolini berishga ochiq yo'l ochardi
    if (dto.kinds?.includes('PLATFORM')) throw new BadRequestException({ code: 'KIND_NOT_ALLOWED' });
    const data: Prisma.OrganizationUpdateInput = Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined));
    // `kind` = kinds[0]: eski kod shu maydonni o'qiydi, shuning uchun birga yangilanadi
    if (dto.kinds?.length) data.kind = dto.kinds[0];
    if (!Object.keys(data).length) throw new BadRequestException({ code: 'NOTHING_TO_UPDATE' });
    // Eski qiymatlar yozuvdan OLDIN olinadi: audit "nima edi, nima bo'ldi" ni ko'rsatishi kerak.
    // Ilgari faqat maydon NOMLARI yozilardi, ya'ni "kim bu kompaniyani tasdiqlagan va
    // ilgari holati qanday edi" degan savolga jurnal javob bera olmasdi.
    const before = await this.prisma.organization.findUnique({
      where: { id },
      select: { name: true, slug: true, stir: true, kycStatus: true, kind: true },
    });
    const org = await this.prisma.organization.update({ where: { id }, data });
    const changed = Object.fromEntries(
      Object.keys(dto)
        .filter((k) => k in (before ?? {}))
        .map((k) => [k, { from: (before as Record<string, unknown> | null)?.[k] ?? null, to: (dto as Record<string, unknown>)[k] ?? null }]),
    );
    await this.audit.log({ actorId: userId, action: 'admin.org.update', entity: 'Organization', entityId: id, meta: { fields: Object.keys(dto), changed } });
    return org;
  }

  /** O'chirish faqat bo'sh tashkilot uchun: terminal/e'lon/buyurtma bo'lsa tarix yo'qoladi. */
  // Qaytarib bo'lmaydi
  @Delete('orgs/:id')
  @UseGuards(PlatformOwnerGuard)
  async remove(@CurrentUserId() userId: string, @Param('id') id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      // Hujjat, hisob-faktura va baho kaskad bilan o'chadi: ularni sanamasak moliyaviy iz jimgina yo'qolardi
      select: { name: true, _count: { select: { terminals: true, listings: true, orders: true, documents: true, invoices: true, supplied: true, reviews: true } } },
    });
    if (!org) throw new NotFoundException({ code: 'ORG_NOT_FOUND' });
    const { terminals, listings, orders, documents, invoices, supplied, reviews } = org._count;
    // claimOrgId da FK yo'q: hal bo'lmagan da'vosi bor tashkilot o'chsa, da'voni na tasdiqlab,
    // na rad etib bo'lardi va qator abadiy PENDING bo'lib qolardi.
    const claims = await this.prisma.terminal.count({ where: { claimOrgId: id, claimStatus: 'PENDING' } });
    if (terminals || listings || orders || documents || invoices || supplied || reviews || claims) {
      throw new ConflictException({ code: 'ORG_IN_USE', terminals, listings, orders, documents, invoices, supplied, reviews, claims });
    }
    await this.prisma.$transaction([
      this.prisma.membership.deleteMany({ where: { orgId: id } }),
      this.prisma.organization.delete({ where: { id } }),
    ]);
    await this.audit.log({ actorId: userId, action: 'admin.org.delete', entity: 'Organization', entityId: id, meta: { name: org.name } });
    return { id, deleted: true };
  }

  /** Yangi platforma admini shu yerdan: roles = ['PLATFORM_ADMIN']. Upsert - bir odamga bitta qator. */
  // Rol berish: PLATFORM_ADMIN ham shu yerdan beriladi, ya'ni huquqni ko'paytirish yo'li
  @Post('orgs/:id/members')
  @UseGuards(PlatformOwnerGuard)
  async addMember(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: AddMemberDto) {
    const roles = this.checkRoles(dto.roles);
    const [org, user] = await Promise.all([
      this.prisma.organization.count({ where: { id } }),
      this.prisma.user.count({ where: { id: dto.userId } }),
    ]);
    if (!org) throw new NotFoundException({ code: 'ORG_NOT_FOUND' });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    // Mavjud a'zoga qayta yozilsa bu aslida tahrir: oxirgi egani bu yo'ldan ham tushirib bo'lmaydi
    const cur = await this.prisma.membership.findUnique({ where: { userId_orgId: { userId: dto.userId, orgId: id } }, select: { isOwner: true } });
    if (cur?.isOwner && dto.isOwner === false && (await this.prisma.membership.count({ where: { orgId: id, isOwner: true } })) === 1) {
      throw new ConflictException({ code: 'LAST_OWNER' });
    }
    const m = await this.prisma.membership.upsert({
      where: { userId_orgId: { userId: dto.userId, orgId: id } },
      create: { userId: dto.userId, orgId: id, roles, isOwner: dto.isOwner ?? false },
      update: { roles, ...(dto.isOwner === undefined ? {} : { isOwner: dto.isOwner }) },
      select: { id: true, userId: true, orgId: true, roles: true, isOwner: true },
    });
    await this.audit.log({ actorId: userId, action: 'admin.org.member.add', entity: 'Organization', entityId: id, meta: { userId: dto.userId, roles } });
    return m;
  }

  // Rolni o'zgartirish ham huquq berish yo'li
  @Patch('orgs/:id/members/:userId')
  @UseGuards(PlatformOwnerGuard)
  async updateMember(@CurrentUserId() actorId: string, @Param('id') id: string, @Param('userId') memberId: string, @Body() dto: UpdateMemberDto) {
    const roles = dto.roles ? this.checkRoles(dto.roles) : undefined;
    const cur = await this.prisma.membership.findUnique({ where: { userId_orgId: { userId: memberId, orgId: id } }, select: { isOwner: true, roles: true } });
    if (!cur) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND' });
    // O'z panel huquqini shu yerdan olib tashlab bo'lmaydi: Jamoa ekranida shunday qulf bor,
    // bu yo'l esa uni aylanib o'tardi va odam o'zini paneldan chiqarib yuborardi.
    // Qaytish yo'li faqat serverdagi .env bo'lib qolardi.
    if (memberId === actorId && roles && PLATFORM_ROLES.some((r) => cur.roles.includes(r) && !roles.includes(r))) {
      throw new ConflictException({ code: 'CANNOT_CHANGE_SELF' });
    }
    // Egalikni olib tashlash ham a'zoni o'chirish kabi: oxirgi ega ketsa tashkilotni hech kim boshqara olmaydi
    if (cur.isOwner && dto.isOwner === false && (await this.prisma.membership.count({ where: { orgId: id, isOwner: true } })) === 1) {
      throw new ConflictException({ code: 'LAST_OWNER' });
    }
    const m = await this.prisma.membership.update({
      where: { userId_orgId: { userId: memberId, orgId: id } },
      data: { ...(roles ? { roles } : {}), ...(dto.isOwner === undefined ? {} : { isOwner: dto.isOwner }) },
      select: { id: true, userId: true, orgId: true, roles: true, isOwner: true },
    });
    // Rol berish platformadagi eng sezilarli amal: kim, kimga va nimadan nimaga
    // o'zgartirgani jurnalda qolishi shart.
    await this.audit.log({
      actorId, action: 'admin.org.member.update', entity: 'Organization', entityId: id,
      meta: {
        userId: memberId, fields: Object.keys(dto),
        ...(roles ? { roles: { from: cur.roles, to: m.roles } } : {}),
        ...(dto.isOwner === undefined ? {} : { isOwner: { from: cur.isOwner, to: m.isOwner } }),
      },
    });
    return m;
  }

  /**
   * Oxirgi egani olib tashlab bo'lmaydi: tashkilot egasiz qolib, hech kim uni boshqara olmaydi.
   *
   * Ega qulfi qo'shish va tahrirlashdagidek: a'zoni o'chirish ham huquqni o'zgartirish.
   * Qulfsiz moderator platforma adminining a'zoligini o'chirib, uni paneldan chiqarib
   * yuborardi (isOwner tekshiruvi buni ushlamaydi: platforma roli isOwner=false qatorda turadi).
   */
  @Delete('orgs/:id/members/:userId')
  @UseGuards(PlatformOwnerGuard)
  async removeMember(@CurrentUserId() actorId: string, @Param('id') id: string, @Param('userId') memberId: string) {
    const m = await this.prisma.membership.findUnique({ where: { userId_orgId: { userId: memberId, orgId: id } }, select: { isOwner: true } });
    if (!m) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND' });
    if (m.isOwner && (await this.prisma.membership.count({ where: { orgId: id, isOwner: true } })) === 1) throw new ConflictException({ code: 'LAST_OWNER' });
    await this.prisma.membership.delete({ where: { userId_orgId: { userId: memberId, orgId: id } } });
    await this.audit.log({ actorId, action: 'admin.org.member.remove', entity: 'Organization', entityId: id, meta: { userId: memberId } });
    return { id, userId: memberId, removed: true };
  }
}
