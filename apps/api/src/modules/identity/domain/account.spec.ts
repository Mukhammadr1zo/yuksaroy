import { describe, expect, it } from 'vitest';
import { PASSWORD, normalizePhone } from '@yuksaroy/domain';
import { afterLoginAttempt, anonymizedUser, deleteConfirmed, lockRetryAfter } from './account';

const now = new Date('2026-09-08T10:00:00Z');

describe('afterLoginAttempt', () => {
  it("muvaffaqiyat hisobni nolga qaytaradi", () => {
    expect(afterLoginAttempt({ failedLogins: 3, lockedUntil: null }, true, now)).toEqual({ failedLogins: 0, lockedUntil: null });
  });
  it('maxAttempts dan keyin qulf lockMinutes ga qo\'yiladi', () => {
    let s = { failedLogins: 0, lockedUntil: null as Date | null };
    for (let i = 1; i < PASSWORD.maxAttempts; i++) {
      s = afterLoginAttempt(s, false, now);
      expect(s).toEqual({ failedLogins: i, lockedUntil: null });
    }
    s = afterLoginAttempt(s, false, now);
    expect(s.failedLogins).toBe(PASSWORD.maxAttempts);
    expect(s.lockedUntil?.getTime()).toBe(now.getTime() + PASSWORD.lockMinutes * 60_000);
    expect(lockRetryAfter(s.lockedUntil, now)).toBe(PASSWORD.lockMinutes * 60);
  });
  it("qulf o'tgach hisob qaytadan boshlanadi", () => {
    const old = { failedLogins: 5, lockedUntil: new Date(now.getTime() - 1000) };
    expect(afterLoginAttempt(old, false, now)).toEqual({ failedLogins: 1, lockedUntil: null });
    expect(lockRetryAfter(old.lockedUntil, now)).toBe(0);
    expect(lockRetryAfter(null, now)).toBe(0);
  });
});

describe('delete helpers', () => {
  it('anonim patch shaxsiy maydonlarni tozalaydi', () => {
    const p = anonymizedUser();
    expect(p.isActive).toBe(false);
    expect(p.phone).toBeNull(); expect(p.email).toBeNull(); expect(p.googleSub).toBeNull(); expect(p.passwordHash).toBeNull();
    expect(p.fullName).toBe("O'chirilgan foydalanuvchi");
  });
  it("tasdiq: DELETE yoki o'z telefoni", () => {
    expect(deleteConfirmed('DELETE', '+998901234567', normalizePhone)).toBe(true);
    expect(deleteConfirmed(' 90 123 45 67 ', '+998901234567', normalizePhone)).toBe(true);
    expect(deleteConfirmed('+998907654321', '+998901234567', normalizePhone)).toBe(false);
    expect(deleteConfirmed('+998901234567', null, normalizePhone)).toBe(false);
    expect(deleteConfirmed('delete', '+998901234567', normalizePhone)).toBe(false);
  });
});

/**
 * Raqam faqat +998 bo'lishi shart emas: platforma import, eksport va tranzitni ham
 * qamraydi, kod esa Telegram orqali boradi va u har qanday davlatda ishlaydi.
 */
describe('normalizePhone', () => {
  it("O'zbekiston raqami uch xil yozilsa ham bitta shaklga keladi", () => {
    expect(normalizePhone('901234567')).toBe('+998901234567');
    expect(normalizePhone('998901234567')).toBe('+998901234567');
    expect(normalizePhone('+998 90 123 45 67')).toBe('+998901234567');
  });

  it('99 operator kodidagi raqam prefiks deb kesilmaydi', () => {
    // "998123456" - bu 99-8-12-34-56, ya'ni milliy raqamning o'zi
    expect(normalizePhone('998123456')).toBe('+998998123456');
  });

  it("chet el raqami \"+\" bilan qabul qilinadi", () => {
    expect(normalizePhone('+77011234567')).toBe('+77011234567');
    expect(normalizePhone('+7 701 123 45 67')).toBe('+77011234567');
    expect(normalizePhone('+90 532 123 45 67')).toBe('+905321234567');
    expect(normalizePhone('+8613812345678')).toBe('+8613812345678');
  });

  it("\"+\" siz yozilgan chet el raqami qabul qilinmaydi", () => {
    // To'qqiz xonali bo'lmagan va 998 bilan boshlanmagan qiymat qaysi davlatniki - noma'lum
    expect(normalizePhone('77011234567')).toBeNull();
  });

  it("noto'g'ri qiymatlar rad etiladi", () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('+998901234')).toBeNull();
    expect(normalizePhone('+0123456789')).toBeNull();
    expect(normalizePhone('+1234567')).toBeNull();
    expect(normalizePhone('+1234567890123456')).toBeNull();
  });
});
