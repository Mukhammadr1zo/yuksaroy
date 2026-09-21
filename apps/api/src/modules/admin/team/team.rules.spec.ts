// Jamoa qoidalari. Eng muhimi: odam o'zini paneldan chiqarib yubora olmasligi,
// aks holda yagona ega tasodifan hammani qulflab qo'yardi va qaytish yo'li faqat server .env.
import { describe, expect, it } from 'vitest';
import { levelOf, roleOf, teamDenial, withoutPlatformRoles } from './team.rules';

describe('jamoa darajasi', () => {
  it("rol nomi darajaga mos", () => {
    expect(roleOf('owner')).toBe('PLATFORM_ADMIN');
    expect(roleOf('moderator')).toBe('PLATFORM_OPERATOR');
  });

  it('ikkala rol ham bo\'lsa kuchliroq daraja ko\'rsatiladi', () => {
    expect(levelOf(['PLATFORM_OPERATOR', 'PLATFORM_ADMIN'])).toBe('owner');
    expect(levelOf(['PLATFORM_OPERATOR'])).toBe('moderator');
  });

  it("platforma roli yo'q odam jamoada emas", () => {
    expect(levelOf(['CLIENT', 'CARRIER'])).toBeNull();
    expect(levelOf([])).toBeNull();
  });

  it("huquqni olganda boshqa rollar saqlanadi", () => {
    expect(withoutPlatformRoles(['CLIENT', 'PLATFORM_ADMIN', 'CARRIER'])).toEqual(['CLIENT', 'CARRIER']);
    expect(withoutPlatformRoles(['PLATFORM_OPERATOR'])).toEqual([]);
  });
});

describe('jamoani o\'zgartirishga ruxsat', () => {
  it("o'zini o'zgartirib bo'lmaydi: panelni qulflab qo'ymasin", () => {
    expect(teamDenial('u1', 'u1', false)).toBe('SELF');
  });

  it('server sozlamasidagi odam paneldan olinmaydi', () => {
    expect(teamDenial('u1', 'u2', true)).toBe('FROM_ENV');
  });

  it("o'zi ham, sozlamada ham bo'lmasa ruxsat", () => {
    expect(teamDenial('u1', 'u2', false)).toBeNull();
  });

  it("o'zi tekshiruvi sozlamadan ustun: ikkalasi ham to'g'ri kelsa SELF", () => {
    expect(teamDenial('u1', 'u1', true)).toBe('SELF');
  });
});
