import { Body, ConflictException, NotFoundException, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuditService } from '../../common/audit.service';
import { PrismaService } from '../../common/prisma.service';
import { REVEAL_ACTIONS } from '../../common/reveal-actions';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { DeleteAccountUseCase } from '../identity/application/delete-account.usecase';
import { PlatformAdminGuard } from '../organizations/presentation/platform-admin.guard';
import { PlatformAdmin } from '../organizations/application/platform-admin';
import { PlatformOwnerGuard } from '../organizations/presentation/platform-owner.guard';
import { clampInt } from '../catalog/presentation/catalog.controller';

class BlockDto {
  @IsBoolean() block!: boolean;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

/** O'chirishda faqat sabab keladi: BlockDto ishlatilsa majburiy `block` yo'qligi uchun 400 bo'lardi. */
class ReasonDto {
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

/**
 * Platforma egasi uchun: foydalanuvchilar ro'yxati, qidiruv, bloklash va o'chirish.
 * Firibgar hisob topilganda uni to'xtatish yo'li shu yerda (bloklangan hisob JwtGuard da USER_INACTIVE oladi).
 */
@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtGuard, PlatformAdminGuard)
@ApiCookieAuth('ys_access')
export class AdminUsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly del: DeleteAccountUseCase,
    private readonly admin: PlatformAdmin,
  ) {}


  /** Ro'yxat: telefon, ism yoki email bo'yicha qidiruv. */
  @Get('users')
  async users(
    @CurrentUserId() userId: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('blocked') blocked?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    // Ilgari 30 qattiq yozilgan edi va mijozning limit so'rovi e'tiborsiz qolardi:
    // bu yagona admin ro'yxati edi, uni kengaytirib bo'lmasdi
    const take = clampInt(limit, 30, 1, 100);
    const text = q?.trim();
    const where = {
      ...(blocked === '1' ? { isActive: false, id: { not: { startsWith: 'demo-user-' } } } : {}),
      ...(text
        ? {
            OR: [
              { phone: { contains: text.replace(/[^\d+]/g, '') || text } },
              { fullName: { contains: text, mode: 'insensitive' as const } },
              { email: { contains: text, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * take,
        take,
        select: {
          id: true, phone: true, email: true, fullName: true, isActive: true, createdAt: true, personalRoles: true,
          memberships: { select: { isOwner: true, org: { select: { id: true, name: true, kycStatus: true } } } },
          _count: { select: { listings: true } },
        },
      }),
    ]);
    return {
      total, page: p, limit: take,
      items: rows.map((u) => ({
        id: u.id, phone: u.phone, email: u.email, fullName: u.fullName, isActive: u.isActive, createdAt: u.createdAt,
        personalRoles: u.personalRoles, listings: u._count.listings,
        orgs: u.memberships.map((m) => ({ id: m.org.id, name: m.org.name, kyc: m.org.kycStatus, isOwner: m.isOwner })),
      })),
    };
  }

  /**
   * Bitta foydalanuvchi: ro'yxatdagi qatordan ko'ra ko'proq.
   *
   * Nega kerak: operator murojaatga javob berayotganda "bu odam kim, nima qilgan,
   * to'laganmi, oxirgi marta qachon kirgan" degan savolga ro'yxat javob bermasdi va u
   * beshta ekranni aylanib chiqardi. Har ro'yxat chegaralangan (oxirgi 5 ta): to'liq
   * ro'yxat o'z ekranida, bu yerda faqat rasm.
   */
  @Get('users/:id')
  async user(@Param('id') id: string) {
    const now = new Date();
    const u = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, phone: true, email: true, fullName: true, locale: true, isActive: true, createdAt: true, personalRoles: true,
        passwordHash: true, googleSub: true, lockedUntil: true, failedLogins: true,
        telegram: { select: { username: true, linkedAt: true } },
        memberships: { select: { isOwner: true, roles: true, org: { select: { id: true, name: true, kycStatus: true } } } },
        subscriptions: { orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, no: true, status: true, grants: true, months: true, amountTiyin: true, startsAt: true, endsAt: true, createdAt: true } },
        listings: { orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, title: true, kind: true, status: true, createdAt: true } },
        marketRequests: { orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, no: true, board: true, status: true, createdAt: true } },
        serviceProfiles: { select: { id: true, serviceType: true, title: true, status: true } },
        _count: { select: { listings: true, marketRequests: true, wagonSearches: true } },
      },
    });
    if (!u) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    const month = new Date(now.getTime() - 30 * 86_400_000);
    const [activeListings, wagon30, reveals, lastSession, activeSessions] = await Promise.all([
      this.prisma.listing.count({ where: { ownerUserId: id, status: 'ACTIVE' } }),
      this.prisma.wagonSearch.count({ where: { userId: id, createdAt: { gte: month } } }),
      // Nechta raqam ochgan: obuna qadrini va suiiste'molni bir qarashda ko'rsatadi
      this.prisma.auditLog.count({ where: { actorId: id, action: { in: [...REVEAL_ACTIONS] } } }),
      this.prisma.session.findFirst({ where: { userId: id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      this.prisma.session.count({ where: { userId: id, revokedAt: null, expiresAt: { gt: now } } }),
    ]);
    const { passwordHash, googleSub, memberships, subscriptions, _count, ...rest } = u;
    return {
      ...rest,
      hasPassword: !!passwordHash,
      hasGoogle: !!googleSub,
      orgs: memberships.map((m) => ({ id: m.org.id, name: m.org.name, kyc: m.org.kycStatus, isOwner: m.isOwner, roles: m.roles })),
      subscriptions: subscriptions.map((s) => ({ ...s, amountTiyin: Number(s.amountTiyin) })),
      listingsTotal: _count.listings, listingsActive: activeListings,
      requestsTotal: _count.marketRequests,
      wagonTotal: _count.wagonSearches, wagon30d: wagon30,
      reveals,
      lastSeenAt: lastSession?.createdAt ?? null,
      activeSessions,
    };
  }

  /**
   * Bloklash: hisob o'chmaydi, lekin kira olmaydi va sessiyalari bekor qilinadi.
   * E'lonlari yashirilmaydi: agar firibgarlik bo'lsa e'lonni alohida rad etish kerak (izi qoladi).
   */
  @Post('users/:id/block')
  async block(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: BlockDto) {
    // O'zini bloklash panelga kirishni butunlay yopadi va qaytish yo'li faqat serverdagi
    // .env orqali bo'ladi. Jadvalda qatorlar bir xil ko'rinadi, ya'ni bitta noto'g'ri bosish yetadi.
    if (id === userId) throw new ConflictException({ code: 'SELF_ACTION' });
    // Jamoa a'zosini bloklash ham huquqni o'zgartirish: bloklangan odam panelga kira olmaydi.
    // Qulfsiz moderator hamma egalarni bloklab, platformani boshqarishni to'xtatib qo'yardi.
    if (dto.block && (await this.admin.isPlatformAdmin(id))) await this.admin.assertPlatformOwner(userId);
    await this.prisma.user.update({ where: { id }, data: { isActive: !dto.block } });
    if (dto.block) await this.prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log({ actorId: userId, action: dto.block ? 'admin.user.block' : 'admin.user.unblock', entity: 'User', entityId: id, meta: { reason: dto.reason ?? null } });
    return { id, isActive: !dto.block };
  }

  /** O'chirish: foydalanuvchining o'zi bosgandagi bilan bir xil (soft delete va anonimlash). */
  // Qaytarib bo'lmaydi: hisob anonimlashadi. Bloklash operatorda qoladi.
  @Post('users/:id/delete')
  @UseGuards(PlatformOwnerGuard)
  async remove(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: ReasonDto) {
    // O'z hisobini o'chirish qaytarib bo'lmaydigan amal: admin o'zini anonimlashtirib qo'yardi.
    if (id === userId) throw new ConflictException({ code: 'SELF_ACTION' });
    const report = await this.del.execute(id);
    await this.audit.log({ actorId: userId, action: 'admin.user.delete', entity: 'User', entityId: id, meta: { reason: dto.reason ?? null, ...report } });
    return { id, deleted: true };
  }
}
