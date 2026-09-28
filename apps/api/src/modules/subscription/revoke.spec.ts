import { describe, expect, it } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';

/**
 * Tasdiqlangan obunani bekor qilish.
 *
 * Nega test kerak: shu paytgacha bekor qilish faqat TO'LANMAGAN qatorga tegardi, ya'ni
 * operator noto'g'ri qatorni tasdiqlab yuborsa obuna 12 oygacha faol qolardi va uni
 * qaytaradigan yo'l yo'q edi. Bu yo'l pulga va odamning huquqiga tegadi, shuning uchun
 * uning uchta sharti shu yerda qulflangan.
 */
type Row = { id: string; userId: string; status: string; endsAt: Date | null; paidAt: Date | null; amountTiyin: bigint; months: number };

function fake(row: Row | null, count: number) {
  const updates: { where: Record<string, unknown>; data: Record<string, unknown> }[] = [];
  const prisma = {
    subscription: {
      findUnique: async () => row,
      updateMany: async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => { updates.push(a); return { count }; },
    },
  } as never;
  const config = { get: async () => ({ subscriptionMonthSom: 50000, payDetails: '', phoneRevealDaily: 10, wagonSearchFree: 1 }) } as never;
  const svc = new SubscriptionService(prisma, config, { queued: async () => {} } as never, { recipients: async () => [], push: async () => {} } as never);
  return { svc, updates };
}

const ACTIVE: Row = {
  id: 's1', userId: 'u1', status: 'ACTIVE',
  endsAt: new Date('2027-01-01T00:00:00Z'), paidAt: new Date('2026-09-01T00:00:00Z'),
  amountTiyin: 9_900_000n, months: 12,
};

describe('tasdiqlangan obunani bekor qilish', () => {
  it('topilmagan qator', async () => {
    await expect(fake(null, 0).svc.revoke('s1', 'xato', false)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("faol bo'lmagan qator bekor qilinmaydi", async () => {
    // Shart UPDATE ning o'zida: ikki admin bir vaqtda bossa ham faqat bittasi o'tadi
    const f = fake({ ...ACTIVE, status: 'PENDING' }, 0);
    await expect(f.svc.revoke('s1', 'xato', false)).rejects.toBeInstanceOf(ConflictException);
    expect(f.updates[0]!.where).toEqual({ id: 's1', status: 'ACTIVE' });
  });

  it("kirish shu zahoti to'xtaydi: holat va tugash sanasi", async () => {
    const f = fake(ACTIVE, 1);
    const before = Date.now();
    const r = await f.svc.revoke('s1', 'xato tasdiq', false);
    const data = f.updates[0]!.data;
    expect(data.status).toBe('CANCELLED');
    // endsAt hozirga tushadi: active() faqat endsAt > hozir bo'lgan qatorni topadi
    expect((data.endsAt as Date).getTime()).toBeGreaterThanOrEqual(before);
    expect(r.status).toBe('CANCELLED');
    // Eski sana javobda qoladi: audit "qancha kun olib qo'yildi" savoliga shundan javob beradi
    expect(r.wasEndsAt).toEqual(ACTIVE.endsAt);
  });

  it("pul kelmagan bo'lsa daromaddan chiqadi", async () => {
    const f = fake(ACTIVE, 1);
    const r = await f.svc.revoke('s1', 'pul kelmadi', false);
    // paidAt tozalanadi: daromad varag'i paidAt bo'yicha sanaydi
    expect(f.updates[0]!.data.paidAt).toBe(null);
    expect(r.paidAt).toBe(null);
  });

  it("pul kelgan bo'lsa daromadda qoladi", async () => {
    const f = fake(ACTIVE, 1);
    const r = await f.svc.revoke('s1', "mijoz to'xtatdi", true);
    expect('paidAt' in f.updates[0]!.data).toBe(false);
    expect(r.paidAt).toEqual(ACTIVE.paidAt);
  });
});
