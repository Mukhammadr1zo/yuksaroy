import { describe, expect, it } from 'vitest';
import { reportWhere, resolveData } from './report-status';

/**
 * Shikoyat holati ikki sof funksiyada: filtr va qaror ustunlari. Ikki manba bo'lsa
 * ular bir-biriga zid bo'lib qolardi (murojaat qutisidagi bilan bir xil sabab).
 */
describe('shikoyat holati', () => {
  it('filtr: uchala holat va filtrsiz', () => {
    expect(reportWhere('NEW')).toEqual({ status: 'NEW' });
    expect(reportWhere('RESOLVED')).toEqual({ status: 'RESOLVED' });
    expect(reportWhere('DISMISSED')).toEqual({ status: 'DISMISSED' });
    expect(reportWhere('')).toEqual({});
    expect(reportWhere(undefined)).toEqual({});
    expect(reportWhere('xato')).toEqual({});
  });

  it("o'rinli shikoyat RESOLVED, kim va qachon yoziladi", () => {
    const d = resolveData(true, 'u1', '  tekshirildi  ');
    expect(d.status).toBe('RESOLVED');
    expect(d.resolvedById).toBe('u1');
    expect(d.resolveNote).toBe('tekshirildi');
    expect(d.resolvedAt).toBeInstanceOf(Date);
  });

  it("o'rinsiz shikoyat DISMISSED", () => {
    expect(resolveData(false, 'u1').status).toBe('DISMISSED');
  });

  it("faqat bo'shliqdan iborat izoh saqlanmaydi", () => {
    expect(resolveData(true, 'u1', '   ').resolveNote).toBe(null);
  });
});
