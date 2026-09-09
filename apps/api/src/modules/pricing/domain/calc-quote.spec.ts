import { describe, expect, it } from 'vitest';
import { calcQuote, pickTariff, type QuoteTariff } from './calc-quote';

// 8-bo'lim wireframe misoli: 62 t × 18 500 = 1 147 000 + tarozi 120 000 = 1 267 000 so'm
const tariffs: QuoteTariff[] = [
  { id: 't1', serviceCode: 'LOAD', cargoGroupCode: null, priceTiyin: 18_500_00, unit: 'PER_TON', minTiyin: 300_000_00 },
  { id: 't2', serviceCode: 'LOAD', cargoGroupCode: '10002', priceTiyin: 15_000_00, unit: 'PER_TON', minTiyin: null },
  { id: 't3', serviceCode: 'WEIGH', cargoGroupCode: null, priceTiyin: 120_000_00, unit: 'PER_OPERATION', minTiyin: null },
  { id: 't4', serviceCode: 'STORAGE', cargoGroupCode: null, priceTiyin: 50_000_00, unit: 'PER_DAY', minTiyin: null },
];

describe('calcQuote', () => {
  it('tonna × tarif + qo\'shimcha xizmat, komissiya 0 % terminal to\'laydi', () => {
    const q = calcQuote({ operation: 'LOAD', weightKg: 62_000, services: ['WEIGH'] }, tariffs, { commissionPct: 0, commissionPayer: 'TERMINAL' });
    expect(q.lines.map((l) => l.amountTiyin)).toEqual([1_147_000_00, 120_000_00]);
    expect(q.subtotalTiyin).toBe(1_267_000_00);
    expect(q.commissionTiyin).toBe(0);
    expect(q.totalTiyin).toBe(1_267_000_00);
    expect(q.missing).toEqual([]);
  });

  it('yuk guruhi tarifi umumiy tarifdan ustun', () => {
    expect(pickTariff(tariffs, 'LOAD', '10002')?.priceTiyin).toBe(15_000_00);
    expect(pickTariff(tariffs, 'LOAD', '99999')?.priceTiyin).toBe(18_500_00);
    expect(pickTariff(tariffs, 'UNLOAD', null)).toBeNull();
  });

  it('minimal summa, kunlik saqlash va komissiya mijozdan', () => {
    const q = calcQuote({ operation: 'LOAD', weightKg: 5_000, services: ['STORAGE', 'UNLOAD'], storageDays: 3 }, tariffs, { commissionPct: 300, commissionPayer: 'CLIENT' });
    const load = q.lines.find((l) => l.serviceCode === 'LOAD')!;
    expect(load.minApplied).toBe(true);
    expect(load.amountTiyin).toBe(300_000_00);
    expect(q.lines.find((l) => l.serviceCode === 'STORAGE')?.amountTiyin).toBe(150_000_00);
    expect(q.missing).toEqual(['UNLOAD']);
    expect(q.commissionTiyin).toBe(Math.round(450_000_00 * 0.03));
    expect(q.totalTiyin).toBe(450_000_00 + q.commissionTiyin);
  });
});
