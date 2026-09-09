import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Operation, ServiceCode } from '@yuksaroy/domain';
import { PlatformConfigService } from '../../../common/platform-config.service';
import { CATALOG_REPOSITORY, type CatalogRepository, type TerminalRecord } from '../../catalog/domain/ports';
import { publicTerminalCard } from '../../catalog/presentation/mappers';
import { calcQuote, type Quote } from '../domain/calc-quote';

export interface QuoteRequest {
  terminalId?: string;
  stationId?: string;
  stationEsr?: string;
  operation: Operation;
  cargoCode?: string;
  weightKg: number;
  wagonCount?: number;
  storageDays?: number;
  services?: ServiceCode[];
}

export interface QuoteOffer extends Quote { terminal: ReturnType<typeof publicTerminalCard>; nearby: boolean }

/**
 * Login'siz narx: terminalId bo'lsa - bitta; stansiya bo'lsa - shu stansiyadagi terminallar,
 * bo'lmasa shu RJU dagi eng yaxshi 3 ta (nearby=true). Snapshot saqlanmaydi - buyurtmada (S3) muzlatiladi.
 */
@Injectable()
export class QuoteUseCase {
  constructor(@Inject(CATALOG_REPOSITORY) private readonly repo: CatalogRepository, private readonly config: PlatformConfigService) {}

  async execute(r: QuoteRequest): Promise<{ cargoGroupCode: string | null; offers: QuoteOffer[] }> {
    if (!r.terminalId && !r.stationId && !r.stationEsr) throw new BadRequestException({ code: 'TERMINAL_OR_STATION_REQUIRED' });
    const now = new Date();
    const cfg = await this.config.get();
    const cargoGroupCode = r.cargoCode ? ((await this.repo.findCargoTypeByCode(r.cargoCode))?.groupCode ?? null) : null;

    let terminals: TerminalRecord[];
    let nearby = false;
    if (r.terminalId) {
      const t = await this.repo.findTerminalById(r.terminalId, now);
      if (!t || t.status !== 'ACTIVE') throw new NotFoundException({ code: 'TERMINAL_NOT_FOUND' });
      terminals = [t];
    } else {
      const st = r.stationId ? await this.repo.findStationById(r.stationId) : await this.repo.findStationByEsr(r.stationEsr!);
      if (!st) throw new NotFoundException({ code: 'STATION_NOT_FOUND' });
      terminals = await this.repo.listTerminals({ stationId: st.id }, now);
      if (!terminals.length) { terminals = await this.repo.listTerminals({ rju: st.rju }, now); nearby = true; }
    }

    const offers = terminals
      .map((t) => ({ ...calcQuote({ operation: r.operation, weightKg: r.weightKg, wagonCount: r.wagonCount, storageDays: r.storageDays, services: r.services, cargoGroupCode }, t.tariffs, cfg), terminal: publicTerminalCard(t), nearby }))
      .filter((o) => o.lines.some((l) => l.serviceCode === r.operation)) // asosiy operatsiya tarifi bo'lmasa taklif emas
      .sort((a, b) => a.totalTiyin - b.totalTiyin)
      .slice(0, r.terminalId ? 1 : 3);
    return { cargoGroupCode, offers };
  }
}
