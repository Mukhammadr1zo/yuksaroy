import { Injectable } from '@nestjs/common';
import { uzLocalDate } from '@yuksaroy/domain';
import { PrismaService } from '../../common/prisma.service';
import { dayKeys, daySeries } from './day-series';

export type ImpressionKind = 'listing' | 'terminal';
export interface ImpressionItem { kind: ImpressionKind; targetId: string; surface: string }

/** Ko'rsatishlar: kun bo'yicha yig'ma (foydalanuvchi ma'lumoti yo'q). */
@Injectable()
export class ImpressionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Bir xil (kind, target, surface) lar birlashtiriladi; kun Toshkent bo'yicha; upsert count += n. */
  async record(items: ImpressionItem[], now = new Date()) {
    const day = new Date(uzLocalDate(now));
    const n = new Map<string, number>();
    for (const i of items) {
      const k = JSON.stringify([i.kind, i.targetId, i.surface]);
      n.set(k, (n.get(k) ?? 0) + 1);
    }
    // ponytail: har guruh uchun bitta upsert (50 tagacha) bitta tranzaksiyada; yuk oshsa bitta INSERT ... ON CONFLICT
    await this.prisma.$transaction(
      [...n].map(([k, count]) => {
        const [kind, targetId, surface] = JSON.parse(k) as [string, string, string];
        return this.prisma.impression.upsert({
          where: { kind_targetId_day_surface: { kind, targetId, day, surface } },
          create: { kind, targetId, day, surface, count },
          update: { count: { increment: count } },
        });
      }),
    );
    return { accepted: items.length };
  }

  /** Oxirgi 30 kun: { days: [{ day, list, map, detail, compare, bot }], totals }. */
  async series(kind: ImpressionKind, targetId: string, now = new Date()) {
    const keys = dayKeys(now);
    const rows = await this.prisma.impression.findMany({ where: { kind, targetId, day: { gte: new Date(keys[0]!) } }, select: { day: true, surface: true, count: true } });
    return daySeries(rows, keys);
  }
}
