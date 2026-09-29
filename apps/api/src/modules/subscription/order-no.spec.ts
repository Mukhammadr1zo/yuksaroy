import { describe, expect, it } from 'vitest';
import { SubscriptionService } from './subscription.service';

/**
 * Obuna buyurtmasi endi PAY raqami bilan ochiladi: odam shu raqamni to'lov izohiga
 * yozadi, operator esa ko'chirmadan shu bo'yicha qatorni topadi. Ilgari u yerda cuid
 * turardi va uni hech kim ko'chira olmasdi.
 */
function fakeOrder(payDetails: string) {
  const created: Record<string, unknown>[] = [];
  const notified: unknown[][] = [];
  const tx = {
    subscription: {
      findFirst: async () => null,
      create: async (a: { data: Record<string, unknown> }) => {
        created.push(a.data);
        return { ...a.data, id: 's1', createdAt: new Date(), startsAt: null, endsAt: null, paidAt: null };
      },
    },
    $queryRaw: async () => [{ nextval: 1001n }],
  };
  // Buyurtma har doim tarifdan: bitta sukut tarif yetadi
  const plans = [{ id: 'p0', code: 'obuna', priceMonthSom: 99_000, grants: ['PHONE', 'WAGON'], limits: null, maxMonths: 12, sort: 0, active: true }];
  const prisma = { plan: { findMany: async () => plans }, $transaction: async (fn: (t: unknown) => unknown) => fn(tx) } as never;
  const config = { get: async () => ({ payDetails }) } as never;
  const adminNotify = { queued: async (...a: unknown[]) => { notified.push(a); } } as never;
  const notifications = { recipients: async () => [], push: async () => {} } as never;
  const svc = new SubscriptionService(prisma, config, adminNotify, notifications);
  return { svc, created, notified };
}

describe('obuna buyurtmasiga PAY raqami beriladi', () => {
  it('raqam ketma-ketlikdan keladi va admin xabarida ham shu turadi', async () => {
    const f = fakeOrder('Karta 8600 0000 0000 0000, qabul qiluvchi: YukSaroy');
    const r = await f.svc.order('u1', 3);
    expect(f.created[0].no).toBe('PAY-1001');
    expect(r.order.no).toBe('PAY-1001');
    expect(f.notified[0][1]).toBe('PAY-1001, 3 oy');
    expect(r.payInstructions.details).toContain('8600');
  });

  it('rekvizit bo\'sh bo\'lsa odam murojaat formasiga yuboriladi', async () => {
    const f = fakeOrder('   ');
    const r = await f.svc.order('u1', 1);
    expect(r.payInstructions.details).toContain('/contact');
  });
});
