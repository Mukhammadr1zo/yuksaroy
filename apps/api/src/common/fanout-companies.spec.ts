// "N ta tashuvchiga yuborildi" korxonalarni sanaydi (2026-10-07 egasi qarori).
import { describe, expect, it } from 'vitest';
import { countCompanies, logFanout } from './fanout';
import type { PrismaService } from './prisma.service';

const mk = (rows: { userId: string; orgId: string }[]) => ({ membership: { groupBy: async () => rows } }) as unknown as PrismaService;

describe('korxonalar soni', () => {
  it('bir tashkilotning ikki odami bitta, tashkilotsiz haydovchi ham bitta', async () => {
    const p = mk([{ userId: 'a', orgId: 'o1' }, { userId: 'b', orgId: 'o1' }, { userId: 'c', orgId: 'o2' }]);
    expect(await countCompanies(p, ['a', 'b', 'c', 'driver1', 'driver2'])).toBe(4); // o1, o2 va ikki tashkilotsiz
    expect(await countCompanies(p, [])).toBe(0);
  });

  it("ikki tashkilotda turgan odam bitta sanaladi, zanjir bir korxona, son odam sonidan oshmaydi", async () => {
    const p = mk([
      { userId: 'a', orgId: 'o1' }, { userId: 'a', orgId: 'o2' }, // a ikki tashkilotda
      { userId: 'b', orgId: 'o2' }, { userId: 'c', orgId: 'o3' },
    ]);
    expect(await countCompanies(p, ['a'])).toBe(1);
    expect(await countCompanies(p, ['a', 'b', 'c'])).toBe(2); // {a,b} o2 orqali va {c}
    const many = mk([{ userId: 'a', orgId: 'o1' }, { userId: 'a', orgId: 'o2' }, { userId: 'a', orgId: 'o3' }]);
    expect(await countCompanies(many, ['a', 'b'])).toBeLessThanOrEqual(2);
  });

  it("namuna tashkilotlar so'rovdan chiqariladi (org.isDemo = false)", async () => {
    let where: { org?: { isDemo?: boolean } } = {};
    const p = { membership: { groupBy: async (a: { where: typeof where }) => { where = a.where; return []; } } } as unknown as PrismaService;
    expect(await countCompanies(p, ['a', 'b'])).toBe(2);
    expect(where.org).toEqual({ isDemo: false });
  });

  it("tashkilotlarni o'qib bo'lmasa odam soni olinadi", async () => {
    const p = { membership: { groupBy: async () => { throw new Error('baza uzildi'); } } } as unknown as PrismaService;
    expect(await countCompanies(p, ['a', 'b'])).toBe(2);
  });

  it('logFanout: admin va hamkasb sanalmaydi, ikki xodim bir tashkilot = 1, jurnalga shu yoziladi', async () => {
    const logged: { meta: Record<string, unknown> }[] = [];
    const prisma = {
      membership: {
        // adminlar rol bo'yicha, hamkasblar oluvchilar ichidan so'raladi
        findMany: async (a: { where: { roles?: unknown; userId?: { in: string[] } } }) =>
          (a.where.roles ? [{ userId: 'adm' }] : a.where.userId!.in.filter((x) => x === 'mate').map((userId) => ({ userId }))),
        groupBy: async () => [{ userId: 'x1', orgId: 'o9' }, { userId: 'x2', orgId: 'o9' }],
      },
      user: { findMany: async () => [] },
      auditLog: { create: async (a: { data: { meta: Record<string, unknown> } }) => { logged.push(a.data); return {}; } },
    } as unknown as PrismaService;
    const r = await logFanout(prisma, { push: async () => 0, recipients: async () => [] } as never, {
      entity: 'MarketRequest', id: 'm1', no: 'M-1', createdById: 'me', board: 'CARGO', region: null, type: null,
      find: async () => ['adm', 'mate', 'x1', 'x2', 'drv'], what: () => 'yuk', where: 'Toshkent',
    });
    expect(r.sentReal).toBe(2); // o9 va tashkilotsiz drv
    expect(logged[0]!.meta).toMatchObject({ sent: 5, sentReal: 2 });
  });
});
