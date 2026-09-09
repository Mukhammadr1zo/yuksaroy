// Ko'rsatishlar kunlik qatori: oxirgi N kun (Toshkent kuni), har yuza uchun son; bo'sh kun = 0. Sof funksiya, Prisma yo'q.
import { IMPRESSION_SURFACES, uzLocalDate, type ImpressionSurface } from '@yuksaroy/domain';

export type DayRow = { day: Date | string; surface: string; count: number };
export type SurfaceCounts = Record<ImpressionSurface, number>;
export type DayPoint = { day: string } & SurfaceCounts;

const zero = (): SurfaceCounts => ({ list: 0, map: 0, detail: 0, compare: 0, bot: 0 });
/** DB Date (UTC yarim tun) yoki "YYYY-MM-DD" -> "YYYY-MM-DD". */
const keyOf = (d: Date | string) => (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10));

/** Bugun bilan tugaydigan `days` ta kun kaliti, eski birinchi. */
export function dayKeys(now: Date, days = 30): string[] {
  const [y, m, d] = uzLocalDate(now).split('-').map(Number) as [number, number, number];
  return Array.from({ length: days }, (_, i) => new Date(Date.UTC(y, m - 1, d - (days - 1 - i))).toISOString().slice(0, 10));
}

export function daySeries(rows: DayRow[], keys: string[]): { days: DayPoint[]; totals: SurfaceCounts & { all: number } } {
  const byDay = new Map(keys.map((k) => [k, zero()]));
  const totals: SurfaceCounts & { all: number } = { ...zero(), all: 0 };
  for (const r of rows) {
    const p = byDay.get(keyOf(r.day));
    if (!p || !(IMPRESSION_SURFACES as readonly string[]).includes(r.surface)) continue; // oynadan tashqari yoki notanish yuza
    p[r.surface as ImpressionSurface] += r.count;
    totals[r.surface as ImpressionSurface] += r.count;
    totals.all += r.count;
  }
  return { days: keys.map((day) => ({ day, ...byDay.get(day)! })), totals };
}
