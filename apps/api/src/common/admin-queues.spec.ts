// Qaysi navbat kunlik eslatmaga tushadi. Sof funksiya, baza yo'q.
//
// Nega muhim: har navbatni eslatmaga qo'shsak, ogohlantirish har kuni keladi va odam
// unga qarashni to'xtatadi. Shuning uchun ro'yxat ataylab qisqa.
import { describe, expect, it } from 'vitest';
import { QUEUE_DEF, QUEUE_KEYS, TASK_ENTITIES, queueOf, queueWhere, staleQueues, type QueueKey, type QueueStat } from './admin-queues';

/** Navbat sharti bitta joyda: vazifa yopilishi ham, badge ham shu jadvaldan. */
describe('QUEUE_DEF', () => {
  it("entity to'plami aynan TASK_ENTITIES (har navbatga bittadan)", () => {
    expect(new Set(QUEUE_KEYS.map((k) => QUEUE_DEF[k].entity))).toEqual(new Set(TASK_ENTITIES));
    expect(QUEUE_KEYS.length).toBe(TASK_ENTITIES.length);
  });

  it('har kalitda where va oldest bor, queueOf teskarisini topadi', () => {
    for (const k of QUEUE_KEYS) {
      expect(Object.keys(QUEUE_DEF[k].where).length, k).toBeGreaterThan(0);
      expect(QUEUE_DEF[k].oldest, k).toBeTruthy();
      expect(queueOf(QUEUE_DEF[k].entity)).toBe(k);
    }
  });
});

describe('queueWhere', () => {
  it("platforma suhbatidan adminning o'zi boshlagani chiqariladi, boshqa navbat o'zgarmaydi", async () => {
    // O'z tredida admin mijoz: javobi statusni o'zgartirmaydi, navbatda qolsa eslatma har kuni kelardi
    const prisma = { membership: { findMany: async () => [{ userId: 'adm' }] }, user: { findMany: async () => [] } } as never;
    expect(await queueWhere(prisma, 'platformInquiriesOpen')).toEqual({ toPlatform: true, status: 'OPEN', fromUserId: { notIn: ['adm'] } });
    expect(await queueWhere(prisma, 'listingsPendingReview')).toBe(QUEUE_DEF.listingsPendingReview.where);
  });
});

const now = new Date('2026-09-24T10:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const empty = (): Record<QueueKey, QueueStat> =>
  Object.fromEntries(QUEUE_KEYS.map((k) => [k, { count: 0, oldest: null }])) as Record<QueueKey, QueueStat>;

describe('kutib qolgan navbatlar', () => {
  it("ikki kundan oshgani chiqadi, yangisi chiqmaydi", () => {
    const s = empty();
    s.listingsPendingReview = { count: 2, oldest: daysAgo(3) };
    s.orgsPendingKyc = { count: 1, oldest: daysAgo(1) };
    expect(staleQueues(s, now, 2)).toEqual([{ key: 'listingsPendingReview', days: 3 }]);
  });

  it('eng uzoq kutgani birinchi turadi', () => {
    const s = empty();
    s.listingsPendingReview = { count: 1, oldest: daysAgo(3) };
    s.terminalClaimsPending = { count: 1, oldest: daysAgo(9) };
    expect(staleQueues(s, now, 2).map((x) => x.key)).toEqual(['terminalClaimsPending', 'listingsPendingReview']);
  });

  it("to'lov navbatlari eslatmaga tushmaydi", () => {
    // Premium ataylab tashqarida: u eski, to'lanmagan qatorlar uchun qolgan va
    // ta'rifiga ko'ra hamisha eski. Buyurtma va shoshilinch so'rov adminni kutmaydi.
    const s = empty();
    s.premiumPending = { count: 5, oldest: daysAgo(100) };
    s.subscriptionPending = { count: 5, oldest: daysAgo(100) };
    s.ordersPending = { count: 5, oldest: daysAgo(100) };
    s.urgentOpen = { count: 5, oldest: daysAgo(100) };
    expect(staleQueues(s, now, 2)).toEqual([]);
  });

  it("egasiz obyektga yozilgan javobsiz suhbat eslatmaga tushadi", () => {
    // Unga platformadan boshqa hech kim javob bermaydi: eslatmasiz bosh sahifada jim turardi
    const s = empty();
    s.platformInquiriesOpen = { count: 1, oldest: daysAgo(4) };
    expect(staleQueues(s, now, 2)).toEqual([{ key: 'platformInquiriesOpen', days: 4 }]);
  });

  it("soni nol bo'lsa sana bo'lsa ham chiqmaydi", () => {
    const s = empty();
    s.orgsPendingKyc = { count: 0, oldest: daysAgo(10) };
    expect(staleQueues(s, now, 2)).toEqual([]);
  });
});
