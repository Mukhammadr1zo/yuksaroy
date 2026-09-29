import { describe, expect, it } from 'vitest';
import { monthBack, monthKey, monthWindow, monthlyRevenue } from './revenue';

const NOW = new Date('2026-09-15T00:00:00Z');
const sub = (paidAt: string, som: number, startsAt?: string) => ({
  paidAt: new Date(paidAt), startsAt: startsAt ? new Date(startsAt) : null, amountTiyin: BigInt(som * 100),
});
const prem = (paidAt: string, som: number) => ({ paidAt: new Date(paidAt), amountTiyin: BigInt(som * 100) });

describe('oy chegarasi Toshkent bo\'yicha', () => {
  it('30-sentabr kechqurungi to\'lov oktabrga o\'tadi', () => {
    // Toshkent UTC+5: 20:00 UTC = 01:00, ertasi kun
    expect(monthKey(new Date('2026-09-30T20:00:00Z'))).toBe('2026-10');
    expect(monthKey(new Date('2026-09-30T18:00:00Z'))).toBe('2026-09');
  });

  it('monthBack o\'n bir oy orqaga', () => {
    expect(monthBack('2026-09', 11)).toBe('2025-10');
    expect(monthBack('2026-01', 1)).toBe('2025-12');
  });

  it('monthBack manfiy bilan oldinga yuradi (oy oxiri shunga tayanadi)', () => {
    expect(monthBack('2026-12', -1)).toBe('2027-01');
    expect(monthBack('2026-09', -1)).toBe('2026-10');
  });
});

describe('oylik tushum', () => {
  it('ikki jadval bitta oyga qo\'shiladi', () => {
    const [r] = monthlyRevenue([sub('2026-09-05T06:00:00Z', 99000)], [prem('2026-09-07T06:00:00Z', 50000)], NOW);
    expect(r.month).toBe('2026-09');
    expect(r.subsTiyin).toBe(9_900_000);
    expect(r.premiumTiyin).toBe(5_000_000);
    expect(r.totalTiyin).toBe(r.subsTiyin + r.premiumTiyin);
    expect(r.payments).toBe(2);
  });

  it('uzaytirish faqat startsAt to\'lovdan keyin bo\'lganda sanaladi', () => {
    const rows = monthlyRevenue([
      sub('2026-09-05T06:00:00Z', 99000, '2026-11-01T00:00:00Z'),
      sub('2026-09-06T06:00:00Z', 99000, '2026-09-06T06:00:00Z'),
      sub('2026-09-07T06:00:00Z', 99000),
    ], [], NOW);
    expect(rows[0].payments).toBe(3);
    expect(rows[0].renewals).toBe(1);
  });

  it('o\'n ikki oydan eski to\'lov varaqqa tushmaydi', () => {
    const rows = monthlyRevenue([sub('2025-09-05T06:00:00Z', 99000), sub('2025-10-05T06:00:00Z', 99000)], [], NOW);
    expect(rows.map((r) => r.month)).toEqual(['2025-10']);
  });

  it('yangi oy yuqorida turadi va to\'lanmagan qator hisobga olinmaydi', () => {
    const rows = monthlyRevenue([
      sub('2026-07-05T06:00:00Z', 10000),
      sub('2026-09-05T06:00:00Z', 10000),
      { paidAt: null, startsAt: null, amountTiyin: 999n },
    ], [], NOW);
    expect(rows.map((r) => r.month)).toEqual(['2026-09', '2026-07']);
  });
});

/** Oy chegarasi Toshkent yarim tunida: UTC da kesilsa oyning oxirgi besh soati keyingi oyga ketardi. */
describe('oy oynasi', () => {
  it('oy boshi Toshkent yarim tuniga tushadi', () => {
    const w = monthWindow(new Date('2026-09-15T00:00:00Z'));
    expect(w.start.toISOString()).toBe('2026-08-31T19:00:00.000Z');
    expect(w.prevStart.toISOString()).toBe('2026-07-31T19:00:00.000Z');
  });

  it("yil chegarasida ham to'g'ri", () => {
    expect(monthWindow(new Date('2026-01-10T00:00:00Z')).prevStart.toISOString()).toBe('2025-11-30T19:00:00.000Z');
  });
});
