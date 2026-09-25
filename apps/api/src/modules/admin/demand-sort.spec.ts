import { describe, expect, it } from 'vitest';
import { AdminCatalogController } from './admin-catalog.controller';
import type { AuditService } from '../../common/audit.service';
import type { PrismaService } from '../../common/prisma.service';
import type { ImpressionsService } from '../impressions/impressions.service';

/**
 * Chaqiruv navbati: qaysi obyektga birinchi qo'ng'iroq qilish kerak.
 * Tartib ko'rishlar bo'yicha, shuning uchun bazadan kelgan qatorlar tartibiga
 * ishonib bo'lmaydi (Prisma IN tartibini saqlamaydi).
 */
function make(top: { id: string; views: number }[], rows: { id: string }[], open: { terminalId: string; n: number }[] = []) {
  const calls: { terminals: Record<string, unknown>[]; inquiries: Record<string, unknown>[]; counts: number } = { terminals: [], inquiries: [], counts: 0 };
  const prisma = {
    terminal: {
      findMany: async (a: { where: Record<string, unknown> }) => { calls.terminals.push(a.where); return rows; },
      count: async () => { calls.counts += 1; return rows.length; },
    },
    inquiry: {
      groupBy: async (a: { where: Record<string, unknown> }) => {
        calls.inquiries.push(a.where);
        return open.map((o) => ({ terminalId: o.terminalId, _count: { _all: o.n } }));
      },
    },
  } as unknown as PrismaService;
  const impressions = { topDetailViews: async () => top } as unknown as ImpressionsService;
  const c = new AdminCatalogController(prisma, { log: async () => {} } as unknown as AuditService, impressions);
  return { c, calls };
}

describe('talab bo\'yicha tartib', () => {
  it('javob ko\'rishlar tartibida chiqadi, bazadan kelgan tartibda emas', async () => {
    const f = make([{ id: 't2', views: 40 }, { id: 't1', views: 9 }], [{ id: 't1' }, { id: 't2' }]);
    const r = await f.c.terminals(undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'demand');
    expect(r.items.map((x) => (x as unknown as { id: string }).id)).toEqual(['t2', 't1']);
    expect((r.items[0] as unknown as { views30: number }).views30).toBe(40);
  });

  it('namuna qatorlar chiqmaydi', async () => {
    const f = make([{ id: 't1', views: 3 }], [{ id: 't1' }]);
    await f.c.terminals(undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'demand');
    expect(f.calls.terminals[0]).toMatchObject({ isDemo: false });
  });

  it('javobsiz yozishma faqat sahifadagi qatorlar uchun sanaladi va 0 beradi', async () => {
    const f = make([{ id: 't1', views: 3 }, { id: 't2', views: 2 }], [{ id: 't1' }, { id: 't2' }], [{ terminalId: 't1', n: 4 }]);
    const r = await f.c.terminals(undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'demand');
    expect(f.calls.inquiries[0]).toMatchObject({ status: 'OPEN', terminalId: { in: ['t1', 't2'] } });
    expect((r.items[0] as unknown as { openInquiries: number }).openInquiries).toBe(4);
    expect((r.items[1] as unknown as { openInquiries: number }).openInquiries).toBe(0);
  });

  it('hech narsa ochilmagan bo\'lsa ikkinchi so\'rov ketmaydi', async () => {
    const f = make([], []);
    const r = await f.c.terminals(undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'demand');
    expect(r).toEqual({ items: [], total: 0, page: 1, limit: 30 });
    expect(f.calls.terminals).toHaveLength(0);
    expect(f.calls.inquiries).toHaveLength(0);
  });

  it('tartib berilmasa eski yo\'l saqlanadi', async () => {
    const f = make([{ id: 't1', views: 3 }], [{ id: 't1' }]);
    const r = await f.c.terminals();
    expect(f.calls.counts).toBe(1);
    expect(f.calls.inquiries).toHaveLength(0);
    expect((r.items[0] as unknown as { views30?: number }).views30).toBeUndefined();
  });
});
