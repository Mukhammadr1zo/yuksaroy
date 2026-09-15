// PlatformAdminGuard: endi butun /admin/* ning yagona qulfi, shuning uchun uch holat tekshiriladi.
// DB kerak emas: PlatformAdmin o'rniga soxta obyekt beriladi.
import { describe, expect, it } from 'vitest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { PlatformAdminGuard } from './platform-admin.guard';
import type { PlatformAdmin } from '../application/platform-admin';

/** Haqiqiy PlatformAdmin bilan bir xil shartnoma: admin bo'lmasa Forbidden. */
const fakeAdmin = (admins: string[]): PlatformAdmin =>
  ({
    isPlatformAdmin: async (id: string) => admins.includes(id),
    assertPlatformAdmin: async (id: string) => {
      if (!admins.includes(id)) throw new ForbiddenException({ code: 'NOT_PLATFORM_ADMIN' });
    },
  }) as unknown as PlatformAdmin;

const ctx = (req: unknown): ExecutionContext =>
  ({ switchToHttp: () => ({ getRequest: () => req }) }) as unknown as ExecutionContext;

describe('PlatformAdminGuard', () => {
  it('admin o\'tadi', async () => {
    const g = new PlatformAdminGuard(fakeAdmin(['u-admin']));
    await expect(g.canActivate(ctx({ userId: 'u-admin' }))).resolves.toBe(true);
  });

  it('oddiy foydalanuvchi rad etiladi', async () => {
    const g = new PlatformAdminGuard(fakeAdmin(['u-admin']));
    await expect(g.canActivate(ctx({ userId: 'u-plain' }))).rejects.toThrow(ForbiddenException);
  });

  // JwtGuard qo'yilmay qolsa req.userId bo'sh bo'ladi: guard jimgina o'tkazib yubormasligi kerak
  it('userId bo\'lmasa rad etiladi', async () => {
    const g = new PlatformAdminGuard(fakeAdmin(['u-admin']));
    await expect(g.canActivate(ctx({}))).rejects.toThrow(ForbiddenException);
  });

  it('bo\'sh satr ham admin emas', async () => {
    const g = new PlatformAdminGuard(fakeAdmin(['']));
    await expect(g.canActivate(ctx({ userId: 'u-plain' }))).rejects.toThrow(ForbiddenException);
  });
});
