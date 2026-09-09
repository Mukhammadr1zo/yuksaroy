import { describe, expect, it } from 'vitest';
import { dayKeys, daySeries } from './day-series';

describe('dayKeys', () => {
  it('Toshkent kuni bilan tugaydi, 30 ta, eski birinchi', () => {
    // 2026-09-07 21:00 UTC = 2026-09-08 02:00 Toshkent
    const keys = dayKeys(new Date('2026-09-07T21:00:00Z'));
    expect(keys).toHaveLength(30);
    expect(keys[29]).toBe('2026-09-08');
    expect(keys[0]).toBe('2026-08-10');
  });
});

describe('daySeries', () => {
  const keys = dayKeys(new Date('2026-09-08T10:00:00Z'), 3); // 09-06, 09-07, 09-08
  it("bo'sh kunlar 0, yuzalar bo'yicha yig'indi, oynadan tashqari va notanish yuza tashlanadi", () => {
    const r = daySeries(
      [
        { day: new Date('2026-09-08T00:00:00Z'), surface: 'list', count: 4 },
        { day: new Date('2026-09-08T00:00:00Z'), surface: 'detail', count: 1 },
        { day: '2026-09-06', surface: 'map', count: 2 },
        { day: '2026-09-01', surface: 'list', count: 9 },
        { day: '2026-09-07', surface: 'weird', count: 9 },
      ],
      keys,
    );
    expect(r.days).toEqual([
      { day: '2026-09-06', list: 0, map: 2, detail: 0, compare: 0, bot: 0 },
      { day: '2026-09-07', list: 0, map: 0, detail: 0, compare: 0, bot: 0 },
      { day: '2026-09-08', list: 4, map: 0, detail: 1, compare: 0, bot: 0 },
    ]);
    expect(r.totals).toEqual({ list: 4, map: 2, detail: 1, compare: 0, bot: 0, all: 7 });
  });
});
