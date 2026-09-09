import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import type { ServiceCode, TariffUnit } from '@yuksaroy/domain';
import { CATALOG_REPOSITORY, TariffOverlapError, TariffValidFromError, type CatalogRepository } from '../domain/ports';
import { UpsertTerminalUseCase } from './upsert-terminal.usecase';

export interface PublishTariffCommand {
  serviceCode: ServiceCode; cargoGroupCode?: string; priceTiyin: number; unit: TariffUnit; minTiyin?: number; validFrom?: string; note?: string;
}

/** Yangi tarif versiyasi: oldingisi validFrom da yopiladi. Append-only - tahrir yo'q, faqat yangi versiya. */
@Injectable()
export class PublishTariffUseCase {
  constructor(@Inject(CATALOG_REPOSITORY) private readonly repo: CatalogRepository, private readonly terminals: UpsertTerminalUseCase) {}

  async execute(userId: string, terminalId: string, c: PublishTariffCommand) {
    const t = await this.terminals.owned(userId, terminalId);
    const validFrom = c.validFrom ? new Date(c.validFrom) : new Date();
    if (Number.isNaN(validFrom.getTime())) throw new BadRequestException({ code: 'INVALID_VALID_FROM' });
    if (validFrom.getTime() < Date.now() - 24 * 3600 * 1000) throw new BadRequestException({ code: 'VALID_FROM_IN_PAST' });
    try {
      return await this.repo.publishTariff({
        terminalId: t.id, serviceCode: c.serviceCode, cargoGroupCode: c.cargoGroupCode ?? null, priceTiyin: c.priceTiyin, unit: c.unit,
        minTiyin: c.minTiyin ?? null, validFrom, note: c.note ?? null, createdById: userId,
      });
    } catch (e) {
      if (e instanceof TariffValidFromError) throw new BadRequestException({ code: e.message });
      if (e instanceof TariffOverlapError) throw new ConflictException({ code: e.message });
      throw e;
    }
  }
}
