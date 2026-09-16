import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { PlatformAdmin } from './platform-admin';

/**
 * Platformaning ikki darajasi. Ilgari ular bir xil edi: e'lon tasdiqlash uchun yollangan
 * operator komissiya foizini o'zgartira, hisoblarni o'chira va o'ziga ega huquqini
 * bera olardi. Endi ajratilgan va bu ajratma buzilmasligi kerak.
 */

type Row = { phone: string | null; memberships: { id: string }[] };

/**
 * Soxta Prisma: findUnique ning `where.roles.hasSome` sini o'qib, foydalanuvchining
 * haqiqiy rollari bilan kesishmasini qaytaradi. Shu bilan "qaysi rollar so'ralgani"
 * tekshiriladi, ya'ni test guardning mantig'ini emas, so'rovning o'zini sinaydi.
 */
function prismaFor(roles: string[], phone: string | null = null) {
  return {
    user: {
      findUnique: async (args: { select: { memberships: { where: { roles: { hasSome: string[] } } } } }) => {
        const asked = args.select.memberships.where.roles.hasSome;
        const hit = roles.some((r) => asked.includes(r));
        return { phone, memberships: hit ? [{ id: 'm1' }] : [] } satisfies Row;
      },
    },
  } as never;
}

const svc = (p: unknown) => new PlatformAdmin(p as never);

describe('platforma darajalari', () => {
  it('operator panelga kiradi, lekin ega emas', async () => {
    const a = svc(prismaFor(['PLATFORM_OPERATOR']));
    expect(await a.isPlatformAdmin('u1')).toBe(true);
    expect(await a.isPlatformOwner('u1')).toBe(false);
    await expect(a.assertPlatformOwner('u1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(a.assertPlatformAdmin('u1')).resolves.toBeUndefined();
  });

  it('ega ikkala tekshiruvdan ham o\'tadi', async () => {
    const a = svc(prismaFor(['PLATFORM_ADMIN']));
    expect(await a.isPlatformAdmin('u1')).toBe(true);
    expect(await a.isPlatformOwner('u1')).toBe(true);
  });

  it('oddiy foydalanuvchi hech qayerga o\'tmaydi', async () => {
    const a = svc(prismaFor(['CLIENT', 'TERMINAL_ADMIN']));
    expect(await a.isPlatformAdmin('u1')).toBe(false);
    expect(await a.isPlatformOwner('u1')).toBe(false);
    await expect(a.assertPlatformAdmin('u1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
