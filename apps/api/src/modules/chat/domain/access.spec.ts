import { describe, expect, it } from 'vitest';
import { threadRole } from './access';

/**
 * Yozishmada telefon, narx va hujjat bo'ladi, shuning uchun kim ko'ra olishi
 * aniq tekshiriladi. Ayniqsa: qabul qiluvchi yozishma ochilganda qotiriladi,
 * ya'ni obyekt keyin boshqa tashkilotga o'tsa eski suhbat ochilib qolmaydi.
 */
const thread = { fromUserId: 'u-client', toOrgId: 'org-1', toUserId: null, toPlatform: false };
const viewer = (over: Partial<{ userId: string; orgIds: string[]; isPlatformAdmin: boolean }> = {}) => ({
  userId: 'u-other', orgIds: [] as string[], isPlatformAdmin: false, ...over,
});

describe('yozishmadagi rol', () => {
  it('yuborgan odam client', () => {
    expect(threadRole(thread, viewer({ userId: 'u-client' }))).toBe('client');
  });

  it("qabul qiluvchi tashkilot a'zosi owner", () => {
    expect(threadRole(thread, viewer({ orgIds: ['org-1'] }))).toBe('owner');
  });

  it('shaxsiy egasi owner', () => {
    expect(threadRole({ ...thread, toOrgId: null, toUserId: 'u-owner' }, viewer({ userId: 'u-owner' }))).toBe('owner');
  });

  it('begona odam null', () => {
    expect(threadRole(thread, viewer({ orgIds: ['org-2'] }))).toBeNull();
  });

  it("obyekt boshqa tashkilotga o'tsa eski yozishma yangi egaga ochilmaydi", () => {
    // Yozishma org-1 ga ochilgan; org-9 endi obyekt egasi bo'lsa ham bu suhbatda emas
    expect(threadRole(thread, viewer({ orgIds: ['org-9'] }))).toBeNull();
  });

  it('egasiz obyekt: platforma javob beradi', () => {
    const t = { ...thread, toOrgId: null, toPlatform: true };
    expect(threadRole(t, viewer({ isPlatformAdmin: true }))).toBe('owner');
    expect(threadRole(t, viewer({ isPlatformAdmin: false }))).toBeNull();
  });

  it('platforma bayrog\'i yo\'q bo\'lsa admin ham kira olmaydi', () => {
    expect(threadRole(thread, viewer({ isPlatformAdmin: true }))).toBeNull();
  });

  it("o'z obyektiga o'zi yozgan odam client bo'lib qoladi", () => {
    expect(threadRole(thread, viewer({ userId: 'u-client', orgIds: ['org-1'] }))).toBe('client');
  });
});
