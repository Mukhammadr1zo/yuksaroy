import { describe, expect, it } from 'vitest';
import { csv, type CsvCols } from './csv';

type Row = { name: string; amount: bigint | null; at: Date | null; note: string | null };
const COLS: CsvCols<Row> = { name: (r) => r.name, amountSom: (r) => r.amount, at: (r) => r.at, note: (r) => r.note };

/**
 * Fayl Excel da to'g'ri ochilishi kerak: BOM, CRLF, RFC 4180 qochish. Pul so'mda,
 * sana ISO: operator ustunni qo'lda o'girmasin.
 */
describe('csv', () => {
  it('BOM bilan boshlanadi, CRLF bilan tugaydi, sarlavha birinchi qator', () => {
    const out = csv([], COLS);
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out.slice(1)).toBe('name,amountSom,at,note\r\n');
  });

  it("vergul, qo'shtirnoq va yangi qator qo'shtirnoqqa olinadi", () => {
    const out = csv([{ name: 'Toshkent, "3"', amount: null, at: null, note: 'bir\nikki' }], COLS);
    const line = out.split('\r\n')[1];
    expect(line).toBe('"Toshkent, ""3""",,,"bir\nikki"');
  });

  it('= + - @ bilan boshlangan matn apostrof oladi, manfiy son tegilmaydi', () => {
    const out = csv([{ name: '=1+1', amount: -500n, at: null, note: '@SUM(1)' }], COLS);
    expect(out.split('\r\n')[1]).toBe("'=1+1,-5,,'@SUM(1)");
  });

  it("sana ISO, BigInt tiyin so'mga, null bo'sh", () => {
    const out = csv([{ name: 'a', amount: 9_900_050n, at: new Date('2026-09-29T10:00:00Z'), note: null }], COLS);
    expect(out.split('\r\n')[1]).toBe('a,99000.5,2026-09-29T10:00:00.000Z,');
  });
});
