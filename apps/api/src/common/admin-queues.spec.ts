// Qaysi navbat kunlik eslatmaga tushadi. Sof funksiya, baza yo'q.
//
// Nega muhim: har navbatni eslatmaga qo'shsak, ogohlantirish har kuni keladi va odam
// unga qarashni to'xtatadi. Shuning uchun ro'yxat ataylab qisqa.
import { describe, expect, it } from 'vitest';
import { QUEUE_KEYS, staleQueues, type QueueKey, type QueueStat } from './admin-queues';

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

  it("soni nol bo'lsa sana bo'lsa ham chiqmaydi", () => {
    const s = empty();
    s.orgsPendingKyc = { count: 0, oldest: daysAgo(10) };
    expect(staleQueues(s, now, 2)).toEqual([]);
  });
});
