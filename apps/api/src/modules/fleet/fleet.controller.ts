import { Body, Controller, Get, HttpCode, NotFoundException, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AuditService } from '../../common/audit.service';
import { PrismaService } from '../../common/prisma.service';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { PlatformAdminGuard } from '../organizations/presentation/platform-admin.guard';
import { FleetService } from './fleet.service';

class FleetLinkDto {
  /** Spravkadagi kompaniya nomi; null yoki bo'sh = bog'lanishni olib tashlash */
  @IsOptional() @IsString() @MaxLength(80) fleetName?: string | null;
}

/** «Mening vagonlarim»: operatorning parki va poyezd tarkibi; admin tashkilotni spravkadagi nomga bog'laydi. */
@ApiTags('fleet')
@ApiCookieAuth('ys_access')
@Controller()
@UseGuards(JwtGuard)
export class FleetController {
  constructor(private readonly fleet: FleetService, private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  /** Operatorning parki. Tasdiqlangan va bog'langan tashkilot bo'lmasa 403 FLEET_NONE. */
  @Get('fleet/me')
  me(@CurrentUserId() userId: string) {
    return this.fleet.park(userId);
  }

  /** Poyezd tarkibi: faqat operatorning o'z vagoni turgan poyezd. */
  @Get('fleet/train/:ix')
  train(@CurrentUserId() userId: string, @Param('ix') ix: string) {
    return this.fleet.train(userId, ix);
  }

  /** Admin: spravkadagi kompaniya nomlari, qidiruv bilan. */
  @Get('admin/fleet/companies')
  @UseGuards(PlatformAdminGuard)
  companies(@Query('q') q?: string) {
    return this.fleet.companies(q ?? '');
  }

  /** Admin: tashkilotni spravkadagi kompaniya nomiga bog'lash yoki bog'lanishni olib tashlash. */
  @Patch('admin/orgs/:id/fleet') @HttpCode(200)
  @UseGuards(PlatformAdminGuard)
  async link(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: FleetLinkDto) {
    const org = await this.prisma.organization.findUnique({ where: { id }, select: { id: true, fleetName: true } });
    if (!org) throw new NotFoundException({ code: 'ORG_NOT_FOUND' });
    const fleetName = dto.fleetName?.trim() || null;
    const r = await this.prisma.organization.update({ where: { id }, data: { fleetName }, select: { id: true, fleetName: true } });
    await this.audit.log({ actorId: userId, action: 'org.fleet.link', entity: 'Organization', entityId: id, meta: { from: org.fleetName, to: fleetName } });
    return r;
  }
}
