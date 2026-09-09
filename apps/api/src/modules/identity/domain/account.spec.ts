import { describe, expect, it } from 'vitest';
import { PASSWORD, normalizeUzPhone } from '@yuksaroy/domain';
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
    expect(deleteConfirmed('DELETE', '+998901234567', normalizeUzPhone)).toBe(true);
    expect(deleteConfirmed(' 90 123 45 67 ', '+998901234567', normalizeUzPhone)).toBe(true);
    expect(deleteConfirmed('+998907654321', '+998901234567', normalizeUzPhone)).toBe(false);
    expect(deleteConfirmed('+998901234567', null, normalizeUzPhone)).toBe(false);
    expect(deleteConfirmed('delete', '+998901234567', normalizeUzPhone)).toBe(false);
  });
});
