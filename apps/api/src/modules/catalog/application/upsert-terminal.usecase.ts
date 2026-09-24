import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { slugify, type TerminalKind, type TerminalStatus } from '@yuksaroy/domain';
import { CATALOG_REPOSITORY, type CatalogRepository, type TerminalRecord, type TerminalServiceRecord, type WeekHours } from '../domain/ports';
import { TerminalAccess } from './terminal-access';

export interface TerminalInput {
  stationId?: string; stationEsr?: string; kind?: TerminalKind; name?: string; description?: string; address?: string; phone?: string;
  lat?: number; lng?: number; is24h?: boolean; hours?: WeekHours; passport?: Record<string, unknown>; photos?: string[]; status?: TerminalStatus;
}

@Injectable()
export class UpsertTerminalUseCase {
  constructor(@Inject(CATALOG_REPOSITORY) private readonly repo: CatalogRepository, private readonly access: TerminalAccess) {}

  async create(userId: string, orgId: string, input: TerminalInput & { kind: TerminalKind; name: string }): Promise<TerminalRecord> {
    await this.access.assertTerminalAdmin(userId, orgId);
    const stationId = await this.resolveStation(input);
    if (!stationId) throw new BadRequestException({ code: 'STATION_REQUIRED' });
    const slug = await this.uniqueSlug(input.name);
    const now = new Date();
    return this.repo.createTerminal({ ...strip(input), orgId, stationId, slug, name: input.name.trim(), kind: input.kind, claimedAt: now, status: input.status ?? 'DRAFT' }, now);
  }

  async update(userId: string, terminalId: string, input: TerminalInput): Promise<TerminalRecord> {
    const t = await this.owned(userId, terminalId);
    const stationId = await this.resolveStation(input);
    return this.repo.updateTerminal(t.id, { ...strip(input), ...(stationId ? { stationId } : {}), ...(input.name ? { name: input.name.trim() } : {}) }, new Date());
  }

  async replaceServices(userId: string, terminalId: string, services: TerminalServiceRecord[]) {
    const t = await this.owned(userId, terminalId);
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
  return rest;
}
