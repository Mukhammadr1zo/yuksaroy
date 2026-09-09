import { Injectable } from '@nestjs/common';
import { PLATFORM_DEFAULTS } from '@yuksaroy/domain';
import { PrismaService } from './prisma.service';

export interface PlatformConfigValues {
  commissionPct: number; // 300 = 3,00 %
  commissionPayer: 'TERMINAL' | 'CLIENT';
  slotHoldTtlMin: number;
  terminalConfirmMin: number;
  docSlaHours: number;
}

/** PlatformConfig jadvali + PLATFORM_DEFAULTS. 60 s kesh - sozlama admin tomonidan kamdan-kam o'zgaradi. */
@Injectable()
export class PlatformConfigService {
  private cache: { at: number; value: PlatformConfigValues } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<PlatformConfigValues> {
    if (this.cache && Date.now() - this.cache.at < 60_000) return this.cache.value;
    const value: PlatformConfigValues = { ...PLATFORM_DEFAULTS };
    for (const row of await this.prisma.platformConfig.findMany()) {
      if (row.key in value) (value as unknown as Record<string, unknown>)[row.key] = row.value;
    }
    this.cache = { at: Date.now(), value };
    return value;
  }

  invalidate() { this.cache = null; }
}
