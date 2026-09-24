// Bajarilgan ish soni: bitta guruhlash so'rovi, natija xaritaga aylanadi. DB yo'q.
import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../../common/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { MarketService } from './market.service';

type Any = Record<string, any>;

function setup(groups: { providerUserId: string; _count: { _all: number } }[], users: Any[] = []) {
  const calls: Any[] = [];
  const prisma = {
    marketOffer: { groupBy: async (a: Any) => { calls.push(a); return groups; } },
    user: { findMany: async () => users },
  } as unknown as PrismaService;
  return { svc: new MarketService(prisma, {} as unknown as NotificationsService), calls };
}

describe('bajarilgan ish soni', () => {
  it("bo'sh ro'yxatga umuman so'rov yubormaydi", async () => {
    const { svc, calls } = setup([]);
    expect(await svc.doneCounts([])).toEqual(new Map());
    expect(calls).toHaveLength(0);
  });

  it("takroriy id bir marta so'raladi; faqat tanlangan taklif va bajarilgan so'rov sanaladi", async () => {
    const { svc, calls } = setup([{ providerUserId: 'p1', _count: { _all: 3 } }]);
    const m = await svc.doneCounts(['p1', 'p1', 'p2']);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.where).toMatchObject({ providerUserId: { in: ['p1', 'p2'] }, status: 'AWARDED', request: { status: 'DONE' } });
    expect(m.get('p1')).toBe(3);
    // Yutug'i yo'q odam xaritada yo'q: nolni ko'rsatmaslik qoidasi mijozda bitta joyda turadi
    expect(m.get('p2')).toBeUndefined();
  });

  it('nomlar xaritasi bajarilgan ish sonini ham olib keladi', async () => {
    const { svc } = setup([{ providerUserId: 'p1', _count: { _all: 2 } }], [
      { id: 'p1', fullName: 'Ali', phone: '+998901234567' },
      { id: 'p2', fullName: 'Vali', phone: null },
    ]);
    const m = await svc.namesOf(['p1', 'p2']);
    expect(m.get('p1')).toEqual({ name: 'Ali', phoneVerified: true, done: 2 });
    expect(m.get('p2')).toEqual({ name: 'Vali', phoneVerified: false, done: 0 });
  });
});
