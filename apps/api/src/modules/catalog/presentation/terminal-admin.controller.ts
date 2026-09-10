import { Body, ConflictException, Controller, Get, Inject, NotFoundException, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CLAIM_STATUSES } from '@yuksaroy/domain';
import { CurrentUserId, JwtGuard } from '../../identity/presentation/jwt.guard';
import { AuditService } from '../../../common/audit.service';
import { PrismaService } from '../../../common/prisma.service';
import { notifyTelegram, webUrl } from '../../../common/telegram';
import { CATALOG_REPOSITORY, TerminalClaimedError, type CatalogRepository } from '../domain/ports';
import { ORG_REPOSITORY, type OrganizationRepository } from '../../organizations/domain/ports';
import { UpsertTerminalUseCase } from '../application/upsert-terminal.usecase';
import { PublishTariffUseCase } from '../application/publish-tariff.usecase';
import { ClaimSidingUseCase } from '../application/claim-siding.usecase';
import { TerminalAccess } from '../application/terminal-access';
import { PlatformAdmin } from '../../organizations/application/platform-admin';
import { ClaimDecideDto, ClaimSidingDto, CreateTerminalDto, PublishTariffDto, ReplaceServicesDto, UpdateTerminalDto } from './dto';
import { pickIn } from './catalog.controller';

/** Terminal kabineti va shahobcha claim: faqat kirgan foydalanuvchi; ruxsat use-case ichida (TerminalAccess), moderatsiya PlatformAdmin. */
@ApiTags('catalog-admin')
@ApiCookieAuth('ys_access')
@Controller()
@UseGuards(JwtGuard)
export class TerminalAdminController {
  constructor(
    @Inject(CATALOG_REPOSITORY) private readonly repo: CatalogRepository,
    @Inject(ORG_REPOSITORY) private readonly orgs: OrganizationRepository,
    private readonly upsert: UpsertTerminalUseCase,
    private readonly publishTariff: PublishTariffUseCase,
    private readonly claimSiding: ClaimSidingUseCase,
    private readonly access: TerminalAccess,
    private readonly admin: PlatformAdmin,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  /** Foydalanuvchi tashkilotlariga tegishli terminallar (har qanday holat) + bugungi bo'sh slotlar. */
  @Get('terminals/mine')
  async mine(@CurrentUserId() userId: string) {
    const orgIds = await this.access.orgIdsOf(userId);
    if (!orgIds.length) return [];
    const now = new Date();
    const items = await this.repo.listTerminals({ orgIds, status: 'ANY' }, now);
    const free = await this.repo.freeTodayByTerminal(items.map((t) => t.id), now);
    return items.map((t) => ({ ...t, freeToday: free[t.id] ?? 0 }));
  }

  /** Katalogdagi egasiz terminalga da'vo: TERMINAL tashkiloti admini; PENDING -> platforma admini hal qiladi. */
  @Post('terminals/:id/claim')
  async claimTerminal(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: ClaimSidingDto) {
    await this.access.assertTerminalAdmin(userId, dto.orgId);
    if (!(await this.repo.findTerminalById(id, new Date()))) throw new NotFoundException({ code: 'TERMINAL_NOT_FOUND' });
    try {
      const t = await this.repo.claimTerminal(id, dto.orgId);
      await this.audit.log({ actorId: userId, action: 'terminal.claim', entity: 'Terminal', entityId: id, meta: { orgId: dto.orgId } });
      return t;
    } catch (e) {
      if (e instanceof TerminalClaimedError) throw new ConflictException({ code: e.message });
      throw e;
    }
  }

  @Post('terminals/:id/claim/decide')
  async claimTerminalDecide(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: ClaimDecideDto) {
    await this.admin.assertPlatformAdmin(userId);
    const t = await this.repo.decideTerminalClaim(id, dto.approve, new Date());
    if (!t) throw new ConflictException({ code: 'CLAIM_NOT_PENDING' });
    await this.audit.log({ actorId: userId, action: 'terminal.claim.decide', entity: 'Terminal', entityId: id, meta: { approve: dto.approve, reason: dto.reason, orgId: t.claimOrgId } });
    this.notifyClaim(t.claimOrgId, t.name, dto.approve, '/dashboard/terminals');
    return t;
  }

  /**
   * Moderatsiya navbati: default PENDING; da'vogar nomi (claimOrgName) admin uchun.
   * `pool=1`: ochiq ma'lumotdan yig'ilgan egasiz terminallar reestri (katalogda ko'rinmaydi, murojaat uchun).
   */
  @Get('admin/terminals')
  async adminTerminals(@CurrentUserId() userId: string, @Query('claim') claim?: string, @Query('pool') pool?: string) {
    await this.admin.assertPlatformAdmin(userId);
    const filter = pool === '1'
      ? { owned: false as const, status: 'ANY' as const }
      : { claimStatus: pickIn(claim, CLAIM_STATUSES) ?? ('PENDING' as const), status: 'ANY' as const };
    const items = await this.repo.listTerminals(filter, new Date());
    const ids = [...new Set(items.flatMap((t) => (t.claimOrgId ? [t.claimOrgId] : [])))];
    const names = new Map((await Promise.all(ids.map((id) => this.orgs.findById(id)))).flatMap((o) => (o ? [[o.id, o.name] as const] : [])));
    return items.map((t) => ({ ...t, claimOrgName: t.claimOrgId ? (names.get(t.claimOrgId) ?? null) : null }));
  }

  @Post('terminals')
  async create(@CurrentUserId() userId: string, @Body() dto: CreateTerminalDto) {
    const { orgId, ...input } = dto;
    const t = await this.upsert.create(userId, orgId, input);
    await this.audit.log({ actorId: userId, action: 'terminal.create', entity: 'Terminal', entityId: t.id, meta: { orgId, kind: t.kind } });
    return t;
  }

  @Patch('terminals/:id')
  async update(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: UpdateTerminalDto) {
    const t = await this.upsert.update(userId, id, dto);
    await this.audit.log({ actorId: userId, action: 'terminal.update', entity: 'Terminal', entityId: id, meta: { fields: Object.keys(dto) } });
    return t;
  }

  @Put('terminals/:id/services')
  async services(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: ReplaceServicesDto) {
    const t = await this.upsert.replaceServices(userId, id, dto.services.map((s) => ({ serviceCode: s.serviceCode, isEnabled: s.isEnabled ?? true, leadTimeMin: s.leadTimeMin ?? 0 })));
    await this.audit.log({ actorId: userId, action: 'terminal.services', entity: 'Terminal', entityId: id, meta: { services: dto.services } });
    return t;
  }

  /** Tarif tarixi (versiyalar): egasi uchun; ommaviy sahifada faqat amaldagi. */
  @Get('terminals/:id/tariffs')
  async tariffs(@CurrentUserId() userId: string, @Param('id') id: string, @Query('history') history?: string) {
    await this.upsert.owned(userId, id);
    return this.repo.listTariffs(id, history === '1', new Date());
  }

  @Post('terminals/:id/tariffs')
  async tariff(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: PublishTariffDto) {
    const t = await this.publishTariff.execute(userId, id, dto);
    await this.audit.log({ actorId: userId, action: 'tariff.publish', entity: 'Tariff', entityId: t.id, meta: { terminalId: id, serviceCode: t.serviceCode, version: t.version, priceTiyin: t.priceTiyin } });
    return t;
  }

  @Get('sidings/mine')
  async mySidings(@CurrentUserId() userId: string) {
    const orgIds = await this.access.orgIdsOf(userId);
    return orgIds.length ? this.repo.listSidings({ ownerOrgIds: orgIds }, 1, 100) : { items: [], total: 0, page: 1, limit: 100 };
  }

  @Post('sidings/:id/claim')
  async claim(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: ClaimSidingDto) {
    const s = await this.claimSiding.execute(userId, id, dto.orgId);
    await this.audit.log({ actorId: userId, action: 'siding.claim', entity: 'Siding', entityId: id, meta: { orgId: dto.orgId } });
    return s;
  }

  /** Moderatsiya: da'vo tasdiqlanadi yoki rad etiladi (sabab faqat auditda). */
  @Post('sidings/:id/claim/decide')
  async claimDecide(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: ClaimDecideDto) {
    await this.admin.assertPlatformAdmin(userId);
    const s = await this.repo.decideSidingClaim(id, dto.approve);
    if (!s) throw new ConflictException({ code: 'CLAIM_NOT_PENDING' });
    await this.audit.log({ actorId: userId, action: 'siding.claim.decide', entity: 'Siding', entityId: id, meta: { approve: dto.approve, reason: dto.reason, orgId: s.ownerOrgId } });
    this.notifyClaim(s.ownerOrgId, `#${s.registryNo} · ${s.stationNameRaw}`, dto.approve, '/dashboard/sidings');
    return s;
  }

  /** Da'vogar tashkilot a'zolariga qaror haqida Telegram xabari; bog'lanmagan bo'lsa hech narsa. */
  private notifyClaim(orgId: string | null, object: string, approve: boolean, path: string) {
    void notifyTelegram(this.prisma, { orgIds: [orgId] }, approve ? 'claimApproved' : 'claimRejected', { object, url: webUrl(path) }).catch(() => {});
  }

  /** Moderatsiya navbati: default PENDING; egasi nomi (ownerOrgName) admin uchun ochiq. */
  @Get('admin/sidings')
  async adminSidings(@CurrentUserId() userId: string, @Query('claim') claim?: string) {
    await this.admin.assertPlatformAdmin(userId);
    return this.repo.listSidings({ claimStatus: pickIn(claim, CLAIM_STATUSES) ?? 'PENDING' }, 1, 200);
  }
}
