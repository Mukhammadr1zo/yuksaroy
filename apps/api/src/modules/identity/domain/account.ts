// Parol qulfi va hisobni o'chirish: sof funksiyalar (test uchun), Prisma yo'q.
import { PASSWORD } from '@yuksaroy/domain';

export interface LockState { failedLogins: number; lockedUntil: Date | null }

/** Qulf tugashiga qolgan soniya; qulf yo'q yoki o'tgan bo'lsa 0. */
export function lockRetryAfter(lockedUntil: Date | null, now = new Date()): number {
  if (!lockedUntil) return 0;
  return Math.max(0, Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000));
}

/** Kirish urinishidan keyingi holat: muvaffaqiyat nolga qaytaradi, qulf o'tgan bo'lsa hisob qaytadan boshlanadi. */
export function afterLoginAttempt(s: LockState, ok: boolean, now = new Date()): LockState {
  if (ok) return { failedLogins: 0, lockedUntil: null };
  const expired = !s.lockedUntil || s.lockedUntil <= now;
  const failedLogins = (expired ? (s.lockedUntil ? 0 : s.failedLogins) : s.failedLogins) + 1;
  const lockedUntil = failedLogins >= PASSWORD.maxAttempts ? new Date(now.getTime() + PASSWORD.lockMinutes * 60_000) : null;
  return { failedLogins, lockedUntil };
}

export const DELETED_NAME = "O'chirilgan foydalanuvchi";

/** Soft delete uchun user patch: shaxsiy ma'lumotlar o'chadi, yozuv qoladi. */
export function anonymizedUser() {
  return {
    isActive: false, phone: null, email: null, googleSub: null, fullName: DELETED_NAME, avatarUrl: null,
    passwordHash: null, passwordSetAt: null, failedLogins: 0, lockedUntil: null, personalRoles: [] as never[],
  };
}

/** Tasdiq: 'DELETE' yoki o'z telefoni (normallashgan). */
export function deleteConfirmed(confirm: string, phone: string | null, normalize: (s: string) => string | null): boolean {
  const c = confirm.trim();
  return c === 'DELETE' || (phone !== null && normalize(c) === phone);
}
