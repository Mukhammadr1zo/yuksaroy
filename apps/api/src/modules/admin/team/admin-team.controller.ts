import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength } from 'class-validator';
import { normalizeUzPhone } from '@yuksaroy/domain';
import { AuditService } from '../../../common/audit.service';
import { PrismaService } from '../../../common/prisma.service';
import { env } from '../../../common/env';
import { CurrentUserId, JwtGuard } from '../../identity/presentation/jwt.guard';
import { PlatformOwnerGuard } from '../../organizations/presentation/platform-owner.guard';
import { parseAdminPhones } from '../../organizations/domain/rules';
import { PLATFORM_ROLES, TEAM_LEVELS, type TeamLevel, levelOf, roleOf, teamDenial, withoutPlatformRoles } from './team.rules';

class SetLevelDto {
  @IsString() @MaxLength(20) phone!: string;
  @IsIn(TEAM_LEVELS) level!: TeamLevel;
}
class LevelDto {
  @IsIn(TEAM_LEVELS) level!: TeamLevel;
}

/**
 * Platforma jamoasi: kim panelga kira oladi va qaysi darajada.
 *
 * Ega (PLATFORM_ADMIN) sozlama, o'chirish va jamoani boshqaradi; moderator
 * (PLATFORM_OPERATOR) faqat kundalik ish qiladi: e'lon tasdiqlash, sharh, murojaat.
 * Ikkalasining farqi platform-admin.ts da yozilgan.
 *
 * Butun kontroller PlatformOwnerGuard ortida, ya'ni moderator boshqa moderator ham,
 * ega ham qo'sha olmaydi. Aks holda daraja ajratishning ma'nosi qolmasdi: o'ziga
 * ega huquqini berib olish bir bosishlik ish bo'lardi.
 */
@ApiTags('admin')
@ApiCookieAuth('ys_access')
@Controller('admin/team')
@UseGuards(JwtGuard, PlatformOwnerGuard)
export class AdminTeamController {
  private readonly envPhones = parseAdminPhones(env.PLATFORM_ADMIN_PHONES);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Jamoa ro'yxati. Rol qaysi tashkilotda turgani muhim emas: guard ham shunday qaraydi
   * (platform-admin.ts hasRole), shuning uchun ro'yxat huquqning haqiqiy manzarasini beradi.
   */
  @Get()
  async list() {
    const rows = await this.prisma.membership.findMany({
      where: { roles: { hasSome: [...PLATFORM_ROLES] } },
      select: { userId: true, roles: true, createdAt: true, user: { select: { fullName: true, phone: true, isActive: true } } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    const byUser = new Map<string, { userId: string; fullName: string | null; phone: string | null; isActive: boolean; level: TeamLevel; fromEnv: boolean; since: Date }>();
    for (const r of rows) {
      const level = levelOf(r.roles);
      if (!level) continue;
      const cur = byUser.get(r.userId);
      // Bir odamda bir nechta tashkilotda rol bo'lishi mumkin: kuchliroq daraja ko'rsatiladi
      if (cur && !(cur.level === 'moderator' && level === 'owner')) continue;
      byUser.set(r.userId, {
        userId: r.userId, fullName: r.user.fullName, phone: r.user.phone, isActive: r.user.isActive,
        level, fromEnv: r.user.phone !== null && this.envPhones.has(r.user.phone), since: r.createdAt,
      });
    }
    // Sozlamadagi telefonlar: ularning roli jadvalda bo'lmasligi mumkin, lekin huquqi bor
    if (this.envPhones.size) {
      const envUsers = await this.prisma.user.findMany({ where: { phone: { in: [...this.envPhones] } }, select: { id: true, fullName: true, phone: true, isActive: true, createdAt: true } });
      for (const u of envUsers) {
        // Sozlama rolidan kuchliroq: guard telefonni ko'rsa ega deb hisoblaydi, ro'yxat
        // ham shuni ko'rsatishi kerak, aks holda sahifa huquqni kam ko'rsatardi
        const cur = byUser.get(u.id);
        if (cur) { cur.fromEnv = true; cur.level = 'owner'; continue; }
        byUser.set(u.id, { userId: u.id, fullName: u.fullName, phone: u.phone, isActive: u.isActive, level: 'owner', fromEnv: true, since: u.createdAt });
      }
    }
    return [...byUser.values()].sort((a, b) => (a.level === b.level ? +a.since - +b.since : a.level === 'owner' ? -1 : 1));
  }

  /** Telefon bo'yicha qo'shish yoki darajasini almashtirish. Odam avval ro'yxatdan o'tgan bo'lishi kerak. */
  @Post()
  async add(@CurrentUserId() actorId: string, @Body() dto: SetLevelDto) {
    const phone = normalizeUzPhone(dto.phone);
    if (!phone) throw new BadRequestException({ code: 'INVALID_PHONE' });
    const user = await this.prisma.user.findUnique({ where: { phone }, select: { id: true, fullName: true } });
    // Hisobsiz odamga huquq berib bo'lmaydi: avval saytga kirsin, keyin qo'shiladi
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    return this.setLevel(actorId, user.id, dto.level);
  }

  @Post(':userId')
  async change(@CurrentUserId() actorId: string, @Param('userId') userId: string, @Body() dto: LevelDto) {
    return this.setLevel(actorId, userId, dto.level);
  }

  /** Paneldan chiqarish: boshqa rollari (CLIENT, CARRIER...) va hisobi tegilmaydi. */
  @Delete(':userId')
  async remove(@CurrentUserId() actorId: string, @Param('userId') userId: string) {
    const before = await this.assertAllowed(actorId, userId);
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.membership.findMany({ where: { userId, roles: { hasSome: [...PLATFORM_ROLES] } }, select: { id: true, roles: true } });
      for (const r of rows) await tx.membership.update({ where: { id: r.id }, data: { roles: withoutPlatformRoles(r.roles) } });
      // Platforma tashkilotida boshqa roli qolmagan qator o'chadi: aks holda odam
      // kabinetida "YukSaroy" tashkiloti a'zosi bo'lib turaverardi
      await tx.membership.deleteMany({ where: { userId, roles: { isEmpty: true }, org: { kind: 'PLATFORM' } } });
    });
    await this.audit.log({ actorId, action: 'admin.team.remove', entity: 'User', entityId: userId, meta: { from: before.level, phone: before.phone } });
    return { userId, removed: true };
  }

  private async setLevel(actorId: string, userId: string, level: TeamLevel) {
    const before = await this.assertAllowed(actorId, userId);
    // Tashkilot yozuvdan OLDIN topiladi: aks holda eski rol o'chirilib, yangisini yozish
    // bosqichida xato chiqsa odam huquqsiz qolib ketardi
    const orgId = await this.platformOrgId();
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.membership.findMany({ where: { userId, roles: { hasSome: [...PLATFORM_ROLES] } }, select: { id: true, roles: true } });
      for (const r of rows) await tx.membership.update({ where: { id: r.id }, data: { roles: withoutPlatformRoles(r.roles) } });
      const cur = await tx.membership.findUnique({ where: { userId_orgId: { userId, orgId } }, select: { roles: true } });
      await tx.membership.upsert({
        where: { userId_orgId: { userId, orgId } },
        create: { userId, orgId, roles: [roleOf(level)], isOwner: false },
        update: { roles: [...withoutPlatformRoles(cur?.roles ?? []), roleOf(level)] },
      });
    });
    await this.audit.log({ actorId, action: 'admin.team.setLevel', entity: 'User', entityId: userId, meta: { from: before.level, to: level, phone: before.phone } });
    return { userId, level };
  }

  /** Ruxsatni tekshiradi va oldingi holatni qaytaradi: audit "nima edi" ni yozishi kerak. */
  private async assertAllowed(actorId: string, targetId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { phone: true, memberships: { where: { roles: { hasSome: [...PLATFORM_ROLES] } }, select: { roles: true } } },
    });
    if (!u) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    const denial = teamDenial(actorId, targetId, u.phone !== null && this.envPhones.has(u.phone));
    if (denial) throw new ConflictException({ code: denial === 'SELF' ? 'CANNOT_CHANGE_SELF' : 'FROM_ENV' });
    return { phone: u.phone, level: u.memberships.map((m) => levelOf(m.roles)).find((l) => l === 'owner') ?? levelOf(u.memberships[0]?.roles ?? []) };
  }

  /** Platforma tashkiloti: rol shu yerga yoziladi. Katalogda ko'rinmaydi (kind PLATFORM chiqarib tashlanadi). */
  private async platformOrgId(): Promise<string> {
    const found = await this.prisma.organization.findFirst({ where: { kind: 'PLATFORM' }, select: { id: true } });
    if (found) return found.id;
    const org = await this.prisma.organization.create({
      data: { kind: 'PLATFORM', kinds: ['PLATFORM'], name: 'YukSaroy', slug: 'yuksaroy-platforma', kycStatus: 'VERIFIED' },
      select: { id: true },
    });
    return org.id;
  }
}
