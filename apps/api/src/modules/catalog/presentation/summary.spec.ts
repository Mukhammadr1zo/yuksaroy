// Qaror qatori: bo'sh slot yig'indisi va eng arzon/eng yaqin hisob. DB kerak emas.
import { describe, expect, it } from 'vitest';
import type { TariffUnit, ServiceCode } from '@yuksaroy/domain';
import { sumFreeToday } from '../domain/free-today';
import type { TariffRecord, TerminalRecord } from '../domain/ports';
import { byDefault, summarize } from './mappers';

describe('sumFreeToday', () => {
  it('terminal bo\'yicha yig\'adi, muddati o\'tgan hold qaytariladi, manfiy bo\'lmaydi', () => {
    const r = sumFreeToday([
      { terminalId: 'a', capacity: 4, booked: 1, held: 2, staleHolds: 1 }, // 4 - 1 - (2 - 1) = 2
      { terminalId: 'a', capacity: 2, booked: 2, held: 0, staleHolds: 0 }, // 0
      { terminalId: 'b', capacity: 1, booked: 2, held: 0, staleHolds: 0 }, // 0 ga qirqiladi
    ]);
    expect(r).toEqual({ a: 2, b: 0 });
    expect(sumFreeToday([])).toEqual({});
  });
});

const tariff = (serviceCode: ServiceCode, priceTiyin: number, unit: TariffUnit = 'PER_TON', cargoGroupCode: string | null = null): TariffRecord =>
  ({ id: `${serviceCode}-${priceTiyin}`, terminalId: '', serviceCode, cargoGroupCode, version: 1, validFrom: new Date(), validTo: null, priceTiyin, unit, minTiyin: null, note: null, createdAt: new Date() });
const term = (id: string, tariffs: TariffRecord[], lat: number | null = null, lng: number | null = null) => ({ id, lat, lng, tariffs }) as unknown as TerminalRecord;

describe('summarize', () => {
  const all = [
    term('a', [tariff('LOAD', 1500), tariff('UNLOAD', 900, 'PER_WAGON'), tariff('STORAGE', 100, 'PER_DAY')], 41.3, 69.28),
    term('b', [tariff('UNLOAD', 1200), tariff('UNLOAD', 500, 'PER_TON', '123456')], 41.0, 69.0),
    term('c', []),
  ];

  it('so\'ralgan xizmat ichida tonna narxi ustun, yuk guruhi tarifi chetlab o\'tiladi', () => {
    const s = summarize(all, { a: 3, b: 0 }, { lat: 41.31, lng: 69.28, radiusKm: 50 }, ['UNLOAD']);
    expect(s.freeToday).toBe(1);
    expect(s.cheapestTiyin).toBe(1200);
    expect(s.cheapestUnit).toBe('PER_TON');
    expect(s.nearestKm).toBeGreaterThan(0);
    expect(s.nearestKm).toBeLessThan(2);
  });

  it('xizmat berilmasa LOAD/UNLOAD ichida; tonna yo\'q bo\'lsa boshqa birlik; bo\'sh ro\'yxat null', () => {
    expect(summarize(all, {})).toEqual({ freeToday: 0, ratedCount: 0, cheapestTiyin: 1200, cheapestUnit: 'PER_TON', nearestKm: null });
    expect(summarize(all, {}, undefined, ['STORAGE'])).toMatchObject({ cheapestTiyin: 100, cheapestUnit: 'PER_DAY' });
    expect(summarize([], {})).toEqual({ freeToday: 0, ratedCount: 0, cheapestTiyin: null, cheapestUnit: null, nearestKm: null });
  });
});

describe('byDefault', () => {
  const t = (name: string, orgId: string | null, lat: number | null = null, lng: number | null = null) => ({ name, orgId, lat, lng }) as unknown as TerminalRecord;

  it('egasi borlar oldinda, keyin masofa, keyin nom', () => {
    const rows = [t('Yangi', null, 41.0, 69.0), t('Bek', 'o1', 41.5, 69.5), t('Ali', 'o2', 41.05, 69.0)];
    expect([...rows].sort(byDefault({ lat: 41.0, lng: 69.0, radiusKm: 100 })).map((x) => x.name)).toEqual(['Ali', 'Bek', 'Yangi']);
    // near yo'q: egasi borlar ichida nom bo'yicha
    expect([...rows].sort(byDefault()).map((x) => x.name)).toEqual(['Ali', 'Bek', 'Yangi']);
  });
});
