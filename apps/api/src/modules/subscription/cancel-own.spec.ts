import { describe, expect, it } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';

/**
 * Bekor qilish poygasi: tasdiq ham, bekor qilish ham shartni UPDATE ning ichida
 * ushlaydi. Shu qator sinsa pul bilan holat ayrilib qoladi, shuning uchun test
 * aynan updateMany ning shartini tekshiradi.
 */
function fake(row: { status: string } | null, count: number) {
  const updates: Record<string, unknown>[] = [];
  const prisma = {
    subscription: {
      findFirst: async (a: { where: Record<string, unknown> }) =>
        ('status' in a.where ? null : row), // me() ichidagi ikkinchi chaqiruvlar bo'sh
      updateMany: async (a: { where: Record<string, unknown> }) => { updates.push(a.where); return { count }; },
    },
    // me() tariflarni ham beradi; bu testda ular yo'q, narx zaxira sondan
    plan: { findMany: async () => [] },
  } as never;
  const config = { get: async () => ({ payDetails: '', wagonSearchFree: 1 }) } as never;
  const svc = new SubscriptionService(prisma, config, { queued: async () => {} } as never, { recipients: async () => [], push: async () => {} } as never);
  return { svc, updates };
}

describe('o\'z buyurtmasini bekor qilish', () => {
  it('birovning buyurtmasi topilmaydi', async () => {
    const f = fake(null, 0);
    await expect(f.svc.cancelOwn('u1', 's1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('kutilayotgan bo\'lmasa qaytariladi', async () => {
    const f = fake({ status: 'ACTIVE' }, 0);
    await expect(f.svc.cancelOwn('u1', 's1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('shart yangilashning o\'zida: egasi ham, holati ham', async () => {
    const f = fake({ status: 'PENDING' }, 1);
    const me = await f.svc.cancelOwn('u1', 's1');
    expect(f.updates[0]).toEqual({ id: 's1', userId: 'u1', status: 'PENDING' });
    // Karta yangi holatni shu javobdan oladi
    expect(me.pending).toBe(null);
    expect(me.active).toBe(false);
  });
});
