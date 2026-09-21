import { describe, expect, it } from 'vitest';
import { canSearch, deriveCurrent, mapEvents, serialize, upstreamNo } from './wagon.rules';

describe('vagon kvotasi', () => {
  it('obunachi cheksiz, qolganlarga freeTotal ta', () => {
    expect(canSearch(true, 999, 1)).toBe(true);
    expect(canSearch(false, 0, 1)).toBe(true);
    expect(canSearch(false, 1, 1)).toBe(false);
    expect(canSearch(false, 0, 0)).toBe(false);
    expect(canSearch(false, 2, 3)).toBe(true);
  });
});

describe('upstream raqami', () => {
  it('boshidagi nollar olib tashlanadi', () => {
    expect(upstreamNo('00123456')).toBe('123456');
    expect(upstreamNo('12345678')).toBe('12345678');
    expect(upstreamNo('0000000')).toBe('0');
  });
});

const rows = [
  { event_date: '2026-09-01T10:00:00', snapshot_date: '2026-09-01', module: 'idle', station: 'Ташкент-Товарный', dest_station: 'Ангрен', state: 'loaded', operation: 'Отправление', cargo: 'Уголь', weight: '68.5', extra: { secret: 1 } },
  { event_date: '2026-09-03T08:00:00', snapshot_date: '2026-09-03', module: 'idle', station: 'Ангрен', dest_station: null, state: 'empty', operation: 'Выгрузка', cargo: '' },
  { event_date: '2026-09-02T12:00:00', snapshot_date: '2026-09-03', module: 'route', station: 'Тойтепа', dest_station: 'Ангрен', state: 'bogus', operation: null, cargo: null, weight: 'x' },
  { event_date: null, station: 'sanasi yoq' },
];

describe('hodisalar', () => {
  it('butunlay bosh harfli nom yumshatiladi, aralash yozuv tegilmaydi', () => {
    const ev = mapEvents([{ event_date: '2026-09-01', station: 'ТАШКЕНТ-ТОВАРНЫЙ', dest_station: 'УзТЖ', operation: 'ОТПРАВЛЕНИЕ', cargo: 'Уголь' }]);
    expect(ev[0]).toMatchObject({ station: 'Ташкент-Товарный', destination: 'УзТЖ', operation: 'Отправление', cargo: 'Уголь' });
  });

  it("bizning shaklga o'giriladi, yangisi birinchi, sanasi yo'qlari tashlanadi, extra yo'q", () => {
    const ev = mapEvents(rows);
    expect(ev.map((e) => e.date)).toEqual(['2026-09-03T08:00:00', '2026-09-02T12:00:00', '2026-09-01T10:00:00']);
    expect(ev[2]).toEqual({ date: '2026-09-01T10:00:00', station: 'Ташкент-Товарный', destination: 'Ангрен', state: 'loaded', operation: 'Отправление', cargo: 'Уголь', weightT: 68.5 });
    expect(ev[1].state).toBe('unknown');
    expect(ev[1].weightT).toBeNull();
    expect(ev[0].cargo).toBeNull();
    expect(Object.keys(ev[0])).not.toContain('extra');
  });

  it("eng ko'pi 50 ta", () => {
    const many = Array.from({ length: 70 }, (_, i) => ({ event_date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:${String(i % 60).padStart(2, '0')}` }));
    expect(mapEvents(many)).toHaveLength(50);
  });

  it("hozirgi joy: eng so'nggi hisobotdagi eng keyingi hodisa", () => {
    // 09-03 hisobotida ikkita hodisa bor: 09-03 08:00 va 09-02 12:00; keyingisi olinadi
    expect(deriveCurrent(rows)?.station).toBe('Ангрен');
    // snapshot_date bo'lmasa event_date bo'yicha
    expect(deriveCurrent([{ event_date: '2026-01-01' }, { event_date: '2026-02-01', station: 'B' }])?.station).toBe('B');
    expect(deriveCurrent([])).toBeNull();
    expect(deriveCurrent([{ event_date: null }])).toBeNull();
  });
});

describe('foydalanuvchi navbati', () => {
  const tick = () => new Promise<void>((r) => setTimeout(r, 5));

  it("bir kalit: ikkinchisi birinchisi tugagach boshlanadi, xato navbatni to'xtatmaydi", async () => {
    const log: string[] = [];
    const a = serialize('u1', async () => { log.push('a:start'); await tick(); log.push('a:end'); throw new Error('a'); });
    const b = serialize('u1', async () => { log.push('b:start'); return 'b'; });
    await expect(a).rejects.toThrow('a');
    expect(await b).toBe('b');
    expect(log).toEqual(['a:start', 'a:end', 'b:start']);
  });

  it('har xil kalit bir vaqtda ishlaydi', async () => {
    const log: string[] = [];
    const a = serialize('u1', async () => { log.push('a:start'); await tick(); log.push('a:end'); });
    const b = serialize('u2', async () => { log.push('b:start'); });
    await Promise.all([a, b]);
    expect(log).toEqual(['a:start', 'b:start', 'a:end']);
  });
});
