// Jurnaldagi oluvchilar sonini o'qish: bosh sahifa ogohlantirishi va kabinetdagi son.
// Eski qatorlarda sentReal yo'q (adminlarni ajratish keyin qo'shildi). Ogohlantirish ularni sent
// bilan sanaydi, mijozga esa eski sent ko'rsatilmaydi: u namuna va bloklangan hisobni ham sanagan.
import { describe, expect, it } from 'vitest';
import { FANOUT_ACTION, noProviderWhere, sentCounts } from './fanout';
import type { PrismaService } from './prisma.service';

describe('NO_PROVIDER sharti', () => {
  it('yangi qatorda sentReal = 0, eski qatorda sent = 0 sanaladi', () => {
    const since = new Date('2026-10-07T00:00:00Z');
    expect(noProviderWhere(since)).toEqual({
      action: FANOUT_ACTION,
      createdAt: { gte: since },
      OR: [{ meta: { path: ['sentReal'], equals: 0 } }, { meta: { path: ['sent'], equals: 0 } }],
    });
  });
});

describe("so'rovlar bo'yicha son", () => {
  it("faqat ishonchli son: sentReal yoki eski sent = 0; eski sent > 0, bo'sh meta va yiqilgan qidiruv sonsiz", async () => {
    const asked: unknown[] = [];
    const prisma = {
      auditLog: {
        findMany: async (a: unknown) => {
          asked.push(a);
          return [
            { entityId: 'a', meta: { sent: 4, sentReal: 1 } },
            { entityId: 'b', meta: { sent: 2 } }, // eski: namunani ham sanagan bo'lishi mumkin
            { entityId: 'c', meta: null },
            { entityId: 'e', meta: { sent: 0 } }, // eski, lekin hech kimga ketmagani aniq
            { entityId: 'f', meta: { sent: 0, sentReal: 0, failed: true } },
          ];
        },
      },
    } as unknown as PrismaService;
    const m = await sentCounts(prisma, 'MarketRequest', ['a', 'b', 'c', 'd', 'e', 'f']);
    expect([...m.entries()]).toEqual([['a', 1], ['e', 0]]);
    expect(asked[0]).toMatchObject({ where: { action: FANOUT_ACTION, entity: 'MarketRequest', entityId: { in: ['a', 'b', 'c', 'd', 'e', 'f'] } } });
    expect((await sentCounts(prisma, 'MarketRequest', [])).size).toBe(0);
    expect(asked).toHaveLength(1);
  });
});
