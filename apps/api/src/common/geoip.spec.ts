// Joy bazasi bo'lmaganda nima bo'ladi. Baza fayli testda yo'q, aynan shu holat tekshiriladi.
//
// Nega muhim: prodda fayl yuklab olinmasligi mumkin (kalit qo'yilmagan, tarmoq yiqilgan).
// O'shanda tashrif baribir yozilishi kerak, faqat joyi noma'lum bo'ladi. Agar bu yo'l
// xato tashlasa, mayoq 500 qaytarib, sanoq butunlay to'xtab qolardi.
import { describe, expect, it } from 'vitest';
import { locate } from './geoip';

describe('joy aniqlash', () => {
  it("baza yo'q bo'lsa ZZ qaytadi, xato tashlanmaydi", async () => {
    // Test muhitida GEOIP_DB qo'yilmagan
    await expect(locate('8.8.8.8')).resolves.toEqual({ country: 'ZZ', region: '' });
  });

  it("IP bo'lmasa ham yiqilmaydi", async () => {
    await expect(locate(null)).resolves.toEqual({ country: 'ZZ', region: '' });
    await expect(locate('')).resolves.toEqual({ country: 'ZZ', region: '' });
  });
});
