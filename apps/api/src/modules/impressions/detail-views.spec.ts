// Ko'rishlar soni mayoqlardan olinadi. Bularsiz son yana kesh yangilanishini sanardi:
// e'lon sahifasi 60 soniya keshlangani uchun bir daqiqada kelgan yuz odam bitta bo'lib qolardi.
import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../../common/prisma.service';
import { ImpressionsService } from './impressions.service';

type GroupArgs = { by: string[]; where: Record<string, unknown>; _sum: { count: boolean } };

function fake(rows: { targetId: string; sum: number | null }[]) {
  const calls: GroupArgs[] = [];
  const prisma = {
    impression: {
      groupBy: async (a: GroupArgs) => { calls.push(a); return rows.map((r) => ({ targetId: r.targetId, _sum: { count: r.sum } })); },
    },
  } as unknown as PrismaService;
  return { svc: new ImpressionsService(prisma), calls };
}

describe("ko'rishlar soni", () => {
  it("faqat 'detail' yuzasi sanaladi: ro'yxatda va xaritada ko'ringani ochilish emas", async () => {
    const { svc, calls } = fake([{ targetId: 'l1', sum: 12 }]);
    await svc.detailViews('listing', ['l1']);
    expect(calls[0].where).toMatchObject({ kind: 'listing', surface: 'detail' });
    expect(calls[0].by).toEqual(['targetId']);
  });

  it('bir nechta e\'lon uchun bitta so\'rov, natija id bo\'yicha xarita', async () => {
    const { svc, calls } = fake([{ targetId: 'l1', sum: 5 }, { targetId: 'l2', sum: 9 }]);
    expect(await svc.detailViews('listing', ['l1', 'l2', 'l3'])).toEqual({ l1: 5, l2: 9 });
    expect(calls).toHaveLength(1); // e'lon boshiga so'rov yuborilmaydi
  });

  it("hali ochilmagan e'lon 0 beradi, undefined emas", async () => {
    const { svc } = fake([{ targetId: 'l1', sum: null }]);
    expect(await svc.detailViews('listing', ['l1'])).toEqual({ l1: 0 });
  });

  it("bo'sh ro'yxatda bazaga umuman borilmaydi", async () => {
    const { svc, calls } = fake([]);
    expect(await svc.detailViews('listing', [])).toEqual({});
    expect(calls).toHaveLength(0);
  });
});
