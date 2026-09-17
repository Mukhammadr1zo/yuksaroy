import { describe, expect, it } from 'vitest';
import { REGIONS } from '@yuksaroy/domain';
import { regionOfPoint } from './region-of-point';

/**
 * Koordinatadan viloyat. Haqiqiy stansiya koordinatalari bilan tekshiriladi: bular
 * prod bazasidan olingan va xaritada aynan shu nuqtalarda ko'rinadi.
 *
 * Nega test kerak: reestrdan kelgan 1711 ta shahobcha yo'lda viloyat bo'sh qolgan va
 * katalog filtri ularni umuman topmasdi. Endi hisob bor, va u noto'g'ri ishlasa xatolik
 * jimgina qaytadi: terminal boshqa viloyatga tushib qoladi va yana topilmaydi.
 */
const CASES: [string, number, number, string][] = [
  ['Toshkent-Tovarniy', 41.29772, 69.30465, 'UZ-TK'],
  ['Jizzax', 40.09821, 67.84245, 'UZ-JI'],
  ['Nukus', 42.43768, 59.64286, 'UZ-QR'],
  ['Buxoro 1', 39.72226, 64.54874, 'UZ-BU'],
  ['Samarqand', 39.68596, 66.92900, 'UZ-SA'],
  ["Farg'ona-1", 40.39511, 71.75479, 'UZ-FA'],
];

describe('koordinatadan viloyat', () => {
  for (const [name, lat, lng, code] of CASES) {
    it(`${name} -> ${code}`, () => {
      expect(regionOfPoint(lat, lng)).toBe(code);
    });
  }

  it("mamlakatdan tashqarida null qaytadi, taxmin qilinmaydi", () => {
    expect(regionOfPoint(55.75, 37.62)).toBeNull(); // Moskva
    expect(regionOfPoint(0, 0)).toBeNull();
  });

  it("koordinata bo'lmasa null", () => {
    expect(regionOfPoint(null, null)).toBeNull();
    expect(regionOfPoint(41.3, null)).toBeNull();
    expect(regionOfPoint(Number.NaN, 69.3)).toBeNull();
  });

  it("qaytgan kod har doim REGIONS ro'yxatidan", () => {
    for (const [, lat, lng] of CASES) {
      const code = regionOfPoint(lat, lng);
      expect(REGIONS as readonly string[]).toContain(code);
    }
  });
});
