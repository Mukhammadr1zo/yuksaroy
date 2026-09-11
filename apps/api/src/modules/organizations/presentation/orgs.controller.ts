import { BadRequestException, Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { PartialType, PickType } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { PHOTO_URL } from '../../../common/security';
import { KYC_STATUSES, ORG_KINDS, REGIONS, ROLES, normalizeUzPhone, type KycStatus, type OrgKind, type RegionCode, type Role } from '@yuksaroy/domain';
import { CurrentUserId, JwtGuard } from '../../identity/presentation/jwt.guard';
import { CreateOrgUseCase } from '../application/create-org.usecase';
import { PlatformAdmin } from '../application/platform-admin';
import { ORG_REPOSITORY, type OrganizationRepository, type Storefront } from '../domain/ports';
import { filterRoles, rolesForKinds } from '../domain/rules';
import { AuditService } from '../../../common/audit.service';

class CreateOrgDto {
  /** Eski maydon: `kinds` bo'lmasa shu olinadi. */
  @IsOptional() @IsIn(ORG_KINDS) kind?: OrgKind;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(7) @IsIn(ORG_KINDS, { each: true }) kinds?: OrgKind[];
  @IsString() @Length(2, 120) name!: string;
  @IsOptional() @IsString() @Matches(/^\d{9}$/) stir?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(80) telegram?: string;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
  @IsOptional() @IsIn(REGIONS) regionCode?: RegionCode;
  @IsOptional() @IsArray() @IsIn(ROLES, { each: true }) roles?: Role[];
  @IsOptional() @IsString() @MaxLength(300) address?: string;
}
class UpdateOrgDto extends PartialType(PickType(CreateOrgDto, ['name', 'kinds', 'stir', 'phone', 'description', 'telegram', 'website', 'regionCode'] as const)) {
  @IsOptional() @IsString() @MaxLength(300) address?: string;
}
class InviteDto {
  @IsString() phone!: string;
  @IsArray() @IsIn(ROLES, { each: true }) roles!: Role[];
}
class KycDecideDto {
  @IsBoolean() approve!: boolean;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
/** Do'kon (/k/[slug]) maydonlari: hammasi ixtiyoriy, PATCH mavjudini ustiga yozadi. Rasm URL faqat http(s). */
class StorefrontDto implements Storefront {
  @IsOptional() @IsString() @MaxLength(160) tagline?: string;
  @IsOptional() @IsString() @MaxLength(4000) about?: string;
  @IsOptional() @IsString() @MaxLength(500) @Matches(PHOTO_URL) logoUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) @Matches(PHOTO_URL) coverUrl?: string;
  @IsOptional() @IsBoolean() showListings?: boolean;
  @IsOptional() @IsBoolean() showTerminals?: boolean;
  @IsOptional() @IsString() @MaxLength(80) contactTelegram?: string;
  @IsOptional() @IsBoolean() contactPhonePublic?: boolean;
}

@ApiTags('organizations')
@ApiCookieAuth('ys_access')
@Controller()
@UseGuards(JwtGuard)
export class OrgsController {
  constructor(
    private readonly createOrg: CreateOrgUseCase,
    @Inject(ORG_REPOSITORY) private readonly orgs: OrganizationRepository,
    private readonly admin: PlatformAdmin,
    private readonly audit: AuditService,
  ) {}

  @Get('orgs/mine')
  mine(@CurrentUserId() userId: string) {
    return this.orgs.listForUser(userId);
  }

  @Post('orgs')
  async create(@CurrentUserId() userId: string, @Body() dto: CreateOrgDto) {
    const org = await this.createOrg.execute(userId, dto);
    await this.audit.log({ actorId: userId, action: 'org.create', entity: 'Organization', entityId: org.id, meta: { kinds: org.kinds } });
    return org;
  }

  @Patch('orgs/:id')
  async update(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: UpdateOrgDto) {
    const org = await this.createOrg.update(userId, id, dto);
    await this.audit.log({ actorId: userId, action: 'org.update', entity: 'Organization', entityId: id, meta: { fields: Object.keys(dto) } });
    return org;
  }

  /** Egasi do'kon sozlamalarini o'zgartiradi; yuborilmagan maydonlar saqlanib qoladi. */
  @Patch('orgs/:id/storefront')
  async storefront(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: StorefrontDto) {
    const m = await this.orgs.findMembership(userId, id);
    if (!m?.isOwner) throw new ForbiddenException({ code: 'NOT_OWNER' });
    // DTO instansiyasida yuborilmagan maydonlar undefined bo'lib turadi (ES2022 class fields): ularni tashlab, eskisining ustiga yozamiz
    const sent = Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)) as Storefront;
    const org = await this.orgs.update(id, { storefront: { ...(m.org.storefront ?? {}), ...sent } });
    await this.audit.log({ actorId: userId, action: 'org.storefront.update', entity: 'Organization', entityId: id, meta: { fields: Object.keys(dto) } });
    return { id: org.id, slug: org.slug, storefront: org.storefront };
  }

  /** Rollar tashkilot turlari ruxsat berganlar bilan cheklanadi (PLATFORM_ADMIN ni taklif qilib bo'lmaydi). */
  @Post('orgs/:orgId/members')
  async invite(@CurrentUserId() userId: string, @Param('orgId') orgId: string, @Body() dto: InviteDto) {
    const m = await this.orgs.findMembership(userId, orgId);
    if (!m?.isOwner) throw new ForbiddenException({ code: 'NOT_OWNER' });
    const phone = normalizeUzPhone(dto.phone);
    if (!phone) throw new BadRequestException({ code: 'INVALID_PHONE' });
    const kinds = m.org.kinds.length ? m.org.kinds : [m.org.kind];
    const roles = filterRoles(dto.roles, kinds);
    if (!roles.length) throw new BadRequestException({ code: 'ROLES_NOT_ALLOWED', allowed: rolesForKinds(kinds) });
    const r = await this.orgs.addMemberByPhone(orgId, phone, roles);
    await this.audit.log({ actorId: userId, action: 'org.member.add', entity: 'Organization', entityId: orgId, meta: { phone, roles } });
    return r;
  }

  /** Egasi tasdiqlashga yuboradi; STIR shart. */
  @Post('orgs/:id/kyc/request')
  async kycRequest(@CurrentUserId() userId: string, @Param('id') id: string) {
    const m = await this.orgs.findMembership(userId, id);
    if (!m?.isOwner) throw new ForbiddenException({ code: 'NOT_OWNER' });
    if (!m.org.stir) throw new BadRequestException({ code: 'STIR_REQUIRED' });
    if (m.org.kycStatus === 'VERIFIED' || m.org.kycStatus === 'PENDING') throw new BadRequestException({ code: 'KYC_ALREADY', status: m.org.kycStatus });
    const org = await this.orgs.update(id, { kycStatus: 'PENDING', kycRequestedAt: new Date(), kycNote: null });
    await this.audit.log({ actorId: userId, action: 'org.kyc.request', entity: 'Organization', entityId: id });
    return org;
  }

  @Post('orgs/:id/kyc/decide')
  async kycDecide(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: KycDecideDto) {
    await this.admin.assertPlatformAdmin(userId);
    const org = await this.orgs.findById(id);
    if (!org) throw new NotFoundException({ code: 'ORG_NOT_FOUND' });
    if (org.kycStatus !== 'PENDING') throw new BadRequestException({ code: 'KYC_NOT_PENDING', status: org.kycStatus });
    const r = await this.orgs.update(id, { kycStatus: dto.approve ? 'VERIFIED' : 'REJECTED', kycNote: dto.note ?? null });
    await this.audit.log({ actorId: userId, action: 'org.kyc.decide', entity: 'Organization', entityId: id, meta: { approve: dto.approve, note: dto.note } });
    return r;
  }

  /** Moderatsiya navbati: default PENDING. */
  @Get('admin/orgs')
  async adminOrgs(@CurrentUserId() userId: string, @Query('kyc') kyc?: string) {
    await this.admin.assertPlatformAdmin(userId);
    const status = (KYC_STATUSES as readonly string[]).includes(kyc ?? '') ? (kyc as KycStatus) : 'PENDING';
    return this.orgs.listByKyc(status);
  }
}
