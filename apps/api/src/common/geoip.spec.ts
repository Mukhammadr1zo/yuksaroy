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

  it('ichki tarmoq manzili joy bermaydi', async () => {
    // Bu holat proksi zanjiri buzilganini bildiradi: logga bir marta ogohlantirish yoziladi
    for (const ip of ['10.0.0.5', '172.18.0.3', '192.168.1.10', '127.0.0.1']) {
      await expect(locate(ip)).resolves.toEqual({ country: 'ZZ', region: '' });
    }
  });

  it("IP bo'lmasa ham yiqilmaydi", async () => {
    await expect(locate(null)).resolves.toEqual({ country: 'ZZ', region: '' });
    await expect(locate('')).resolves.toEqual({ country: 'ZZ', region: '' });
  });
});

describe('baza fayli yo\'q bo\'lganda qayta urinish', () => {
  it("GEOIP_DB berilgan, fayl yo'q: ikki chaqiruv ham ZZ, xato yo'q", async () => {
    const { vi } = await import('vitest');
    vi.resetModules();
    process.env.GEOIP_DB = '/nonexistent/GeoLite2-City.mmdb';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { locate: fresh } = await import('./geoip');
      await expect(fresh('8.8.8.8')).resolves.toEqual({ country: 'ZZ', region: '' });
      await expect(fresh('8.8.4.4')).resolves.toEqual({ country: 'ZZ', region: '' });
      expect(warn).toHaveBeenCalledTimes(1); // ogohlantirish bir marta, har chaqiruvda emas
    } finally {
      delete process.env.GEOIP_DB;
      warn.mockRestore();
      vi.resetModules();
    }
  });
});
