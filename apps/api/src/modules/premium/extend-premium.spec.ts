import { describe, expect, it } from 'vitest';
import { extendPremium } from './extend-premium';

const now = new Date('2026-09-08T10:00:00Z');

describe('extendPremium', () => {
  it("premium yo'q yoki tugagan: hozirdan + oylar", () => {
    expect(extendPremium(null, 1, now).toISOString()).toBe('2026-10-08T10:00:00.000Z');
    expect(extendPremium(new Date('2026-09-01T00:00:00Z'), 2, now).toISOString()).toBe('2026-11-08T10:00:00.000Z');
  });

  it('faol premium: joriy muddatdan uzaytiriladi', () => {
    expect(extendPremium(new Date('2026-09-20T00:00:00Z'), 3, now).toISOString()).toBe('2026-12-20T00:00:00.000Z');
  });

  it('oy oxiri qisqartiriladi: 31 yanv + 1 oy = 28 fev; 12 oy = keyingi yil', () => {
    const jan = new Date('2027-01-31T00:00:00Z');
    expect(extendPremium(null, 1, jan).toISOString()).toBe('2027-02-28T00:00:00.000Z');
    expect(extendPremium(null, 12, now).toISOString()).toBe('2027-09-08T10:00:00.000Z');
  });
});
