import { BadRequestException, Body, ConflictException, Controller, Get, Inject, NotFoundException, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CLAIM_STATUSES, REGIONS } from '@yuksaroy/domain';
import { CurrentUserId, JwtGuard } from '../../identity/presentation/jwt.guard';
import { AuditService } from '../../../common/audit.service';
import { PrismaService } from '../../../common/prisma.service';
import { AdminNotify } from '../../organizations/application/admin-notify';
import { notifyBoth } from '../../../common/telegram';
import { NotificationsService } from '../../notifications/notifications.service';
import { CATALOG_REPOSITORY, type CatalogRepository } from '../domain/ports';
import { ORG_REPOSITORY, type OrganizationRepository } from '../../organizations/domain/ports';
import { UpsertTerminalUseCase } from '../application/upsert-terminal.usecase';
import { PublishTariffUseCase } from '../application/publish-tariff.usecase';
import { ClaimTerminalUseCase } from '../application/claim-terminal.usecase';
import { TerminalAccess } from '../application/terminal-access';
import { ClaimDecideDto, ClaimDto, CreateTerminalDto, PublishTariffDto, ReplaceServicesDto, UpdateSidingDto, UpdateTerminalDto } from './dto';
import { pickIn } from './catalog.controller';
import { filesOrThrow } from '../../../common/attachments';
import { hideClaimPhone, publicSiding } from './mappers';
import { PlatformAdminGuard } from '../../organizations/presentation/platform-admin.guard';

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
    private readonly claim: ClaimTerminalUseCase,
    private readonly access: TerminalAccess,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly adminNotify: AdminNotify,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Foydalanuvchi tashkilotlariga tegishli terminallar (har qanday holat) + bugungi bo'sh slotlar.
   * `?claims=1` bo'lsa hali hal bo'lmagan da'volar ham kiradi: birlashgan kabinet ro'yxati uchun.
   * Sukut bo'yicha yo'q, chunki qolgan chaqiruvchilar (terminal jadvali, e'lonni obyektga
   * bog'lash) faqat o'z obyektini kutadi va da'vo qatorida yozish huquqi yo'q.
   */
  @Get('terminals/mine')
  async mine(@CurrentUserId() userId: string, @Query('claims') claims?: string) {
    const orgIds = await this.access.orgIdsOf(userId);
    if (!orgIds.length) return [];
    const now = new Date();
    const scope = claims === '1' ? { claimOrgIds: orgIds } : { orgIds };
    const items = await this.repo.listTerminals({ ...scope, status: 'ANY' }, now);
    const free = await this.repo.freeTodayByTerminal(items.map((t) => t.id), now);
    // hideClaimPhone shartsiz qo'llanadi: egalik qilingan qatorda u hech narsa qilmaydi,
    // ya'ni bayroqni ikki joyda tekshirib o'tirishning hojati yo'q.
    return items.map((t) => ({ ...hideClaimPhone(t), freeToday: free[t.id] ?? 0 }));
  }

  /**
   * Katalogdagi egasiz obyektga da'vo -> PENDING, platforma admini hal qiladi.
   * Qoida obyekt turiga qarab ikki xil, sababi use-case izohida.
   */
  @Post('terminals/:id/claim')
  async claimTerminal(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: ClaimDto) {
    // Dalil da'vo yozuvi bilan bitta UPDATE da saqlanadi: audit yiqilsa ham izoh yo'qolmaydi
    const evidence = { note: dto.note.trim(), files: filesOrThrow(dto.files) };
    const { terminal, orgId } = await this.claim.execute(userId, id, dto.orgId, evidence);
    // Auditga faqat fayl SONI: audit iz, manba emas. orgId use-case dan olinadi,
    // shunda avtomatik ochilgan tashkilot ham izda qoladi.
    await this.audit.log({ actorId: userId, action: 'terminal.claim', entity: 'Terminal', entityId: id, meta: { orgId, files: evidence.files.length } });
    void this.adminNotify.queued('terminalClaimsPending', terminal.name, id, userId).catch(() => {});
    return terminal;
  }

  /** Eski manzil: ochiq sahifadagi forma hali shu yerga yozadi. B3 da o'chadi. */
  @Post('sidings/:id/claim')
  claimSidingAlias(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: ClaimDto) {
    return this.claimTerminal(userId, id, dto);
  }

  @Post('terminals/:id/claim/decide')
  @UseGuards(PlatformAdminGuard)
  async claimTerminalDecide(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: ClaimDecideDto) {
    // Rad etish sababi egasiga yetib boradi va auditda qoladi: sababsiz rad etilsa
    // tashkilot nima qilishini bilmaydi va qo'llab-quvvatlashga qo'ng'iroq qiladi.
    if (!dto.approve && !dto.reason?.trim()) throw new BadRequestException({ code: 'REASON_REQUIRED' });
    const t = await this.repo.decideTerminalClaim(id, dto.approve, new Date());
    if (!t) throw new ConflictException({ code: 'CLAIM_NOT_PENDING' });
    await this.audit.log({ actorId: userId, action: 'terminal.claim.decide', entity: 'Terminal', entityId: id, meta: { approve: dto.approve, reason: dto.reason, orgId: t.claimOrgId } });
    // Rad etishda orgId qo'yilmaydi, ya'ni qator faqat birlashgan ro'yxatda ko'rinadi
    this.notifyClaim(t.claimOrgId, t.name, dto.approve, '/dashboard/objects', dto.reason?.trim());
    return t;
  }

  /**
   * Moderatsiya navbati: default PENDING; da'vogar nomi (claimOrgName) admin uchun.
   * Qator XOM qaytadi (ochiq mapperga o'ralmaydi): moderator obyektda ko'rsatilgan egasi
   * va mas'ul shaxs raqamini ko'rib qaror qiladi, publicTerminal esa raqamni yashiradi.
   * `pool=1`: ochiq ma'lumotdan yig'ilgan egasiz terminallar reestri (katalogda ko'rinmaydi, murojaat uchun).
   */
  @Get('admin/terminals')
  @UseGuards(PlatformAdminGuard)
  async adminTerminals(@CurrentUserId() userId: string, @Query('claim') claim?: string, @Query('pool') pool?: string) {
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

  /**
   * Reestr qidiruvi (faqat kirganlar uchun): egasi o'zinikini topib biriktira olishi uchun.
   * Da'vo qilish mumkin bo'lgan holatlar bo'yicha filtr: NONE va REJECTED.
   * Ilgari bu yerda owned:false turardi, ya'ni ownerOrgId IS NULL. Da'vo rad etilganda
   * ownerOrgId tozalanmaydi, shuning uchun rad etilgan yo'l qidiruvdan butunlay yo'qolardi
   * va haqiqiy egasi uni boshqa hech qachon topa olmasdi. Reestrdagi egasi nomi berilmaydi.
   */
  @Get('sidings/registry')
  async registry(@Query('q') q?: string, @Query('region') region?: string, @Query('station') station?: string) {
    const text = q?.trim();
    if (!text && !region && !station) return { items: [], total: 0, page: 1, limit: 20 };
    const r = await this.repo.listSidings(
      { q: text || undefined, region: pickIn(region, REGIONS), stationId: station || undefined, claimStatus: ['NONE', 'REJECTED'], isDemo: false },
      1, 20,
    );
    return { ...r, items: r.items.map((x) => publicSiding(x)) };
  }

  /**
   * Egasi shahobcha yo'lini tahrir qiladi: hozircha faqat rasmlar.
   * Reestr ma'lumotiga tegilmaydi va faqat da'vosi TASDIQLANGAN egasi yoza oladi,
   * aks holda tasdiqlanmagan da'vogar ochiq sahifaga rasm qo'yib qo'yardi.
   */
  @Patch('sidings/:id')
  async updateSiding(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: UpdateSidingDto) {
    // Rol tekshiruvi: ilgari faqat a'zolik qaralardi, ya'ni tashkilotning oddiy xodimi
    // ochiq sahifadagi rasmni almashtira olardi. Egalik sharti hamon UPDATE ichida qoladi.
    const owner = (await this.repo.findSidingById(id))?.ownerOrgId;
    if (!owner) throw new NotFoundException({ code: 'SIDING_NOT_FOUND' });
    await this.access.assertObjectAdmin(userId, owner);
    const s = await this.repo.updateSidingByOwner(id, [owner], { photos: dto.photos });
    if (!s) throw new NotFoundException({ code: 'SIDING_NOT_FOUND' });
    await this.audit.log({ actorId: userId, action: 'siding.update', entity: 'Terminal', entityId: id, meta: { fields: Object.keys(dto), photos: dto.photos?.length } });
    return s;
  }

  /** Da'vogar tashkilot a'zolariga qaror haqida Telegram xabari; bog'lanmagan bo'lsa hech narsa. */
  private notifyClaim(orgId: string | null, object: string, approve: boolean, path: string, reason?: string) {
    if (!orgId) return;
    void notifyBoth(this.prisma, this.notifications, {
      target: { orgIds: [orgId] },
      kind: approve ? 'claimApproved' : 'claimRejected',
      inApp: 'claim',
      href: path,
      vars: { object, reason: reason ?? '' },
    }).catch(() => {});
  }

}
