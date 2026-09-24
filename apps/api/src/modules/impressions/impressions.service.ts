import { Injectable } from '@nestjs/common';
import { uzLocalDate } from '@yuksaroy/domain';
import { PrismaService } from '../../common/prisma.service';
import { dayKeys, daySeries } from './day-series';

export type ImpressionKind = 'listing' | 'terminal' | 'org';
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

  /**
   * E'lon (yoki terminal) sahifasi necha marta ochilgan, umrbod.
   * Manba `Listing.views` emas: u server sahifani qayta yasaganda oshadi, sahifa esa
   * 60 soniya keshlanadi, ya'ni bir daqiqada kelgan yuz odam bitta bo'lib sanalardi.
   * Bu yerdagi son brauzerdan kelgan 'detail' mayoqlaridan, ya'ni har ochilish sanaladi.
   */
  async detailViews(kind: ImpressionKind, targetIds: readonly string[]): Promise<Record<string, number>> {
    if (!targetIds.length) return {};
    const rows = await this.prisma.impression.groupBy({
      by: ['targetId'],
      where: { kind, targetId: { in: [...targetIds] }, surface: 'detail' },
      _sum: { count: true },
    });
    return Object.fromEntries(rows.map((r) => [r.targetId, r._sum.count ?? 0]));
  }

  /**
   * Oxirgi 30 kunda eng ko'p ochilgan obyektlar, ko'pidan kamiga.
   *
   * 'detail' yuzasi: ro'yxatda ko'ringani qiziqish emas, sahifani OCHGANI qiziqish.
   * Saralash ham, chegara ham bazada: xotiraga faqat `take` ta qator keladi.
   * Ikkinchi kalit targetId: teng sonli qatorlar sahifadan sahifaga sakramaydi.
   * Nol ochilgan obyekt umuman qaytmaydi: chaqiruv navbati faqat talab bor obyektdan tuziladi.
   */
  async topDetailViews(kind: ImpressionKind, take: number, now = new Date()): Promise<{ id: string; views: number }[]> {
    const rows = await this.prisma.impression.groupBy({
      by: ['targetId'],
      where: { kind, surface: 'detail', day: { gte: new Date(dayKeys(now)[0]!) } },
      _sum: { count: true },
      orderBy: [{ _sum: { count: 'desc' } }, { targetId: 'asc' }],
      take,
    });
    return rows.map((r) => ({ id: r.targetId, views: r._sum.count ?? 0 }));
  }

  /**
   * Bitta tashrif: kun va joy bo'yicha yig'iladi.
   *
   * Xom yozuv saqlanmaydi: na IP, na sessiya, na sahifa manzili. Ya'ni bu jadvaldan
   * bitta odamni ajratib olib bo'lmaydi, faqat "shu kuni shu joydan nechta" chiqadi.
   */
  async recordVisit(geo: { country: string; region: string }, now = new Date()) {
    const day = new Date(uzLocalDate(now));
    await this.prisma.visit.upsert({
      where: { day_country_region: { day, country: geo.country, region: geo.region } },
      create: { day, country: geo.country, region: geo.region, count: 1 },
      update: { count: { increment: 1 } },
    });
  }

  /** Oxirgi 30 kun: kunlar qatori, viloyatlar va davlatlar kesimi. */
  async visits(now = new Date()) {
    const keys = dayKeys(now);
    const from = new Date(keys[0]!);
    const rows = await this.prisma.visit.findMany({
      where: { day: { gte: from } },
      select: { day: true, country: true, region: true, count: true },
    });
    const byDay = new Map<string, number>(keys.map((k) => [k, 0]));
    const byRegion = new Map<string, number>();
    const byCountry = new Map<string, number>();
    let total = 0;
    for (const r of rows) {
      const k = r.day.toISOString().slice(0, 10);
      byDay.set(k, (byDay.get(k) ?? 0) + r.count);
      byCountry.set(r.country, (byCountry.get(r.country) ?? 0) + r.count);
      if (r.region) byRegion.set(r.region, (byRegion.get(r.region) ?? 0) + r.count);
      total += r.count;
    }
    const sorted = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]);
    return {
      total,
      days: keys.map((day) => ({ day, count: byDay.get(day) ?? 0 })),
      regions: sorted(byRegion).map(([region, count]) => ({ region, count })),
      countries: sorted(byCountry).map(([country, count]) => ({ country, count })),
    };
  }

  /** Oxirgi 30 kun: { days: [{ day, list, map, detail, compare, bot }], totals }. */
  async series(kind: ImpressionKind, targetId: string, now = new Date()) {
    const keys = dayKeys(now);
    const rows = await this.prisma.impression.findMany({ where: { kind, targetId, day: { gte: new Date(keys[0]!) } }, select: { day: true, surface: true, count: true } });
    return daySeries(rows, keys);
  }
}
