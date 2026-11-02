import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { slugify, storePhone, type TerminalKind, type TerminalStatus } from '@yuksaroy/domain';
import { CATALOG_REPOSITORY, type CatalogRepository, type TerminalRecord, type TerminalServiceRecord, type WeekHours } from '../domain/ports';
import { AuditService } from '../../../common/audit.service';
import { PrismaService } from '../../../common/prisma.service';
import { notifyBoth } from '../../../common/telegram';
import { NotificationsService } from '../../notifications/notifications.service';
import { PlatformAdmin } from '../../organizations/application/platform-admin';
import { TerminalAccess } from './terminal-access';

export interface TerminalInput {
  stationId?: string; stationEsr?: string; kind?: TerminalKind; name?: string; description?: string; address?: string; phone?: string;
  lat?: number; lng?: number; is24h?: boolean; hours?: WeekHours; passport?: Record<string, unknown>; photos?: string[]; status?: TerminalStatus;
}

@Injectable()
export class UpsertTerminalUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY) private readonly repo: CatalogRepository,
    private readonly access: TerminalAccess,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly admins: PlatformAdmin,
  ) {}

  async create(userId: string, orgId: string, input: TerminalInput & { kind: TerminalKind; name: string }): Promise<TerminalRecord> {
    await this.access.assertTerminalAdmin(userId, orgId);
    const stationId = await this.resolveStation(input);
    if (!stationId) throw new BadRequestException({ code: 'STATION_REQUIRED' });
    const slug = await this.uniqueSlug(input.name);
    const now = new Date();
    const t = await this.repo.createTerminal({ ...strip(input), orgId, stationId, slug, name: input.name.trim(), kind: input.kind, claimedAt: now, status: input.status ?? 'DRAFT' }, now);
    if (t.status === 'ACTIVE') await this.announceFirstPublish(userId, t);
    return t;
  }

  async update(userId: string, terminalId: string, input: TerminalInput): Promise<TerminalRecord> {
    const t = await this.owned(userId, terminalId);
    // Egasi qarori (2026-11-02): admin yashirgan obyektni egasi tahrirlay ham, qayta ocha ham olmaydi
    // (services.controller dagi BLOCKED qoidasi bilan bir xil); ochishni admin o'zi qiladi
    await this.assertNotHiddenByAdmin(t);
    const stationId = await this.resolveStation(input);
    const next = await this.repo.updateTerminal(t.id, { ...strip(input), ...(stationId ? { stationId } : {}), ...(input.name ? { name: input.name.trim() } : {}) }, new Date());
    // Faqat DRAFT dan: deploydan oldin ACTIVE bo'lgan obyektda belgi qatori yo'q, yashirib qayta ochish yolg'on xabar berardi
    if (t.status === 'DRAFT' && next.status === 'ACTIVE') await this.announceFirstPublish(userId, next);
    return next;
  }

  private async assertNotHiddenByAdmin(t: TerminalRecord): Promise<void> {
    if (t.status === 'HIDDEN' && (await this.hiddenByAdmin(t.id))) throw new ConflictException({ code: 'TERMINAL_HIDDEN_BY_ADMIN' });
  }

  /**
   * HIDDEN holatda egasi ham, admin ham yashirgan bo'lishi mumkin (ustun yo'q, sxema o'zgarmadi), shuning
   * uchun holatni oxirgi o'zgartirgan audit qatori hal qiladi: admin yashirish yoki admin PATCH status.
   * Egasining o'zi yashirgani (terminal.update, status maydoni bilan) keyin qayta ochishga to'sqinlik qilmaydi.
   */
  private async hiddenByAdmin(terminalId: string): Promise<boolean> {
    const rows = await this.prisma.auditLog.findMany({
      where: { entity: 'Terminal', entityId: terminalId, action: { in: ['admin.terminal.bulkHide', 'admin.terminal.bulkActivate', 'admin.terminal.update', 'terminal.update'] } },
      orderBy: { createdAt: 'desc' }, take: 20, select: { action: true, meta: true },
    });
    const statusChange = (m: unknown) => Array.isArray((m as { fields?: unknown } | null)?.fields) && ((m as { fields: string[] }).fields).includes('status');
    const last = rows.find((r) => r.action === 'admin.terminal.bulkHide' || r.action === 'admin.terminal.bulkActivate' || statusChange(r.meta));
    return !!last && (last.action === 'admin.terminal.bulkHide' || last.action === 'admin.terminal.update');
  }

  /**
   * Obyekt katalogga BIRINCHI marta chiqqanda adminlar biladi (sayt qo'ng'irog'i va Telegram). Belgi audit
   * qatori: yashirib qayta ochish yoki qayta nashr xabarni takrorlamaydi. Xato nashrni to'xtatmaydi.
   */
  private async announceFirstPublish(userId: string, t: TerminalRecord): Promise<void> {
    try {
      const seen = await this.prisma.auditLog.findFirst({ where: { action: 'terminal.firstPublish', entity: 'Terminal', entityId: t.id }, select: { id: true } });
      if (seen) return;
      await this.audit.log({ actorId: userId, action: 'terminal.firstPublish', entity: 'Terminal', entityId: t.id, meta: { orgId: t.orgId } });
      const userIds = await this.admins.adminUserIds();
      if (!userIds.length) return;
      const queue = { uz: "Katalogga yangi obyekt chiqdi", ru: 'В каталоге новый объект', en: 'New object in the catalogue' };
      await notifyBoth(this.prisma, this.notifications, {
        target: { userIds, exceptUserId: userId }, kind: 'adminQueue', inApp: 'claim', href: `/admin/terminals/${t.id}`,
        vars: (l) => ({ queue: queue[l], what: t.orgName ? `${t.name} (${t.orgName})` : t.name }),
      });
    } catch { /* xabar nashrdan muhim emas */ }
  }

  async replaceServices(userId: string, terminalId: string, services: TerminalServiceRecord[]) {
    const t = await this.owned(userId, terminalId);
    // Xizmatlar ham yopiq: admin ko'rib chiqayotgan obyektning mazmuni o'zgarmasin
    await this.assertNotHiddenByAdmin(t);
    const seen = new Set<string>();
    for (const s of services) { if (seen.has(s.serviceCode)) throw new BadRequestException({ code: 'DUPLICATE_SERVICE', serviceCode: s.serviceCode }); seen.add(s.serviceCode); }
    await this.repo.replaceServices(t.id, services);
    return this.repo.findTerminalById(t.id, new Date());
  }

  /** Terminal mavjud, tashkilotga biriktirilgan va foydalanuvchi shu tashkilot admini. */
  async owned(userId: string, terminalId: string): Promise<TerminalRecord> {
    const t = await this.repo.findTerminalById(terminalId, new Date());
    if (!t) throw new NotFoundException({ code: 'TERMINAL_NOT_FOUND' });
    if (!t.orgId) throw new ForbiddenException({ code: 'TERMINAL_UNCLAIMED' }); // claim oqimi - admin navbati (S7)
    await this.access.assertObjectAdmin(userId, t.orgId);
    return t;
  }

  private async resolveStation(input: TerminalInput): Promise<string | null> {
    if (input.stationId) {
      const s = await this.repo.findStationById(input.stationId);
      if (!s) throw new BadRequestException({ code: 'STATION_NOT_FOUND' });
      return s.id;
    }
    if (input.stationEsr) {
      const s = await this.repo.findStationByEsr(input.stationEsr);
      if (!s) throw new BadRequestException({ code: 'STATION_NOT_FOUND' });
      return s.id;
    }
    return null;
  }

  private async uniqueSlug(name: string) {
    const base = slugify(name) || 'terminal';
    let slug = base;
    for (let i = 2; await this.repo.slugExists(slug); i++) slug = `${base}-${i}`;
    return slug;
  }
}

/** Faqat yozuv maydonlari (stationEsr/stationId/name/kind alohida hal qilinadi). */
function strip(i: TerminalInput) {
  const { stationId: _s, stationEsr: _e, name: _n, kind: _k, ...rest } = i;
  // Kelmagan kalit tegilmaydi: undefined ni null ga aylantirsak har tahrir raqamni o'chirardi
  return rest.phone === undefined ? rest : { ...rest, phone: storePhone(rest.phone) };
}
