// Qaysi navbat kunlik eslatmaga tushadi. Sof funksiya, baza yo'q.
//
// Nega muhim: har navbatni eslatmaga qo'shsak, ogohlantirish har kuni keladi va odam
// unga qarashni to'xtatadi. Shuning uchun ro'yxat ataylab qisqa.
import { describe, expect, it } from 'vitest';
import { QUEUE_DEF, QUEUE_KEYS, TASK_ENTITIES, queueOf, queueStats, queueWhere, staleQueues, type QueueKey, type QueueStat } from './admin-queues';

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

/**
 * Javobdan keyin mijoz yana yozsa platforma suhbati navbatga qaytadi (egasi qarori, 2026-10-07).
 * Yosh mijozning javobsiz birinchi xabaridan: createdAt dan sanalsa qayta ochilgan bir oylik suhbat
 * bir oy kutgandek ko'rinardi, lastMessageAt dan sanalsa har "javob bormi?" eslatmani yana surardi.
 * Qaysi xabar javobsiz birinchi ekanini SQL hal qiladi (haqiqiy Postgres da tekshirilgan); bu yerda
 * yosh ustundan emas, shu so'rovdan olinishi qotiriladi.
 */
describe('platforma suhbati yoshi', () => {
  // Navbatda bitta OPEN suhbat, qolgan navbatlar bo'sh. Ustunlar ataylab chalg'itadi:
  // yosh createdAt yoki lastMessageAt dan olinsa testlardan biri yiqiladi
  const fake = (firstUnanswered: Date) => {
    const calls: unknown[][] = [];
    const none = { count: async () => 0, findFirst: async () => null };
    const prisma = {
      listing: none, organization: none, terminal: none, premiumOrder: none, subscription: none,
      order: none, urgentRequest: none, contactMessage: none, report: none,
      inquiry: { count: async () => 1, findFirst: async () => ({ createdAt: daysAgo(30), lastMessageAt: new Date(now.getTime() - 3_600_000) }) },
      membership: { findMany: async () => [{ userId: 'adm' }] }, user: { findMany: async () => [] },
      $queryRaw: async (_sql: TemplateStringsArray, ...values: unknown[]) => { calls.push(values); return [{ at: firstUnanswered }]; },
    } as never;
    return { prisma, calls };
  };

  it("hech javob olmagan suhbatga mijoz bir soat oldin yana yozgan: yosh birinchi xabaridan, eslatma chiqadi", async () => {
    const { prisma, calls } = fake(daysAgo(3));
    const st = await queueStats(prisma, true);
    expect(st.platformInquiriesOpen).toEqual({ count: 1, oldest: daysAgo(3) });
    expect(staleQueues(st, now, 2)).toEqual([{ key: 'platformInquiriesOpen', days: 3 }]);
    // Adminning o'zi boshlagani yoshga ham kirmaydi: shart queueWhere niki bilan bir xil
    expect(calls).toEqual([[['adm']]]);
  });

  it("bir oylik suhbatga javobdan keyin bir soat oldin yozilgan savol: eslatma chiqmaydi", async () => {
    const st = await queueStats(fake(new Date(now.getTime() - 3_600_000)).prisma, true);
    expect(staleQueues(st, now, 2)).toEqual([]);
  });
});
