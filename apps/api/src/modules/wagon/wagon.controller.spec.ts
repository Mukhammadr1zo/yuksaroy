import { HttpException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../../common/audit.service';
import type { PlatformConfigService } from '../../common/platform-config.service';
import type { PrismaService } from '../../common/prisma.service';
import type { SubscriptionService } from '../subscription/subscription.service';
import type { DRailwayClient } from './d-railway.client';
import { WagonController } from './wagon.controller';

/**
 * Kesh, egalik, kalit va navbat qoidalari. DB o'rnida xotiradagi qatorlar:
 * soxta prisma faqat kontroller ishlatadigan to'rtta so'rovni biladi.
 */
type Row = { id: string; userId: string; wagonNo: string; found: boolean; result: unknown; createdAt: Date };
type Where = { userId?: string; wagonNo?: string; createdAt?: { gt: Date }; result?: { not: unknown } };

function fakePrisma() {
  const rows: Row[] = [];
  const match = (r: Row, w: Where) =>
    (w.userId === undefined || r.userId === w.userId) &&
    (w.wagonNo === undefined || r.wagonNo === w.wagonNo) &&
    (w.createdAt === undefined || r.createdAt > w.createdAt.gt) &&
    (w.result === undefined || r.result !== null);
  const wagonSearch = {
    findFirst: async ({ where, orderBy }: { where: Where; orderBy?: { createdAt: 'desc' } }) => {
      const hit = rows.filter((r) => match(r, where));
      if (orderBy) hit.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return hit[0] ?? null;
    },
    count: async ({ where }: { where: Where }) => rows.filter((r) => match(r, where)).length,
    create: async ({ data }: { data: { userId: string; wagonNo: string; found: boolean; result: unknown } }) => {
      // Prisma.DbNull bazada NULL bo'ladi: bu yerda null
      const result = data.result && typeof data.result === 'object' && 'events' in (data.result as object) ? data.result : null;
      const row: Row = { id: `r${rows.length + 1}`, ...data, result, createdAt: new Date() };
      rows.push(row);
      return row;
    },
  };
  return { rows, prisma: { wagonSearch } as unknown as PrismaService };
}

function setup(opts: { freeTotal?: number; subscriber?: boolean } = {}) {
  const db = fakePrisma();
  const upstreamCalls: string[] = [];
  const upstream = {
    configured: true,
    history: async (no: string) => { upstreamCalls.push(no); return { count: 1, events: [{ event_date: '2026-09-01', station: 'A' }] }; },
  } as unknown as DRailwayClient;
  const c = new WagonController(
    db.prisma,
    { get: async () => ({ wagonSearchFree: opts.freeTotal ?? 1 }) } as unknown as PlatformConfigService,
    { isActive: async () => opts.subscriber ?? false } as unknown as SubscriptionService,
    { log: async () => {} } as unknown as AuditService,
    upstream,
  );
  return { c, rows: db.rows, upstreamCalls };
}

const status = (p: Promise<unknown>) => p.then(() => 200, (e) => (e instanceof HttpException ? e.getStatus() : Promise.reject(e)));

describe('WagonController.search', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
  afterEach(() => vi.useRealTimers());

  it("boshidagi nol bilan va nolsiz bitta vagon: bitta kesh, bitta kvota, upstream ga nolsiz", async () => {
    const { c, upstreamCalls, rows } = setup();
    const r1 = await c.search('a', { no: '1234567' });
    expect(r1.wagonNo).toBe('1234567');
    const r2 = await c.search('a', { no: '01234567' });
    expect(r2.wagonNo).toBe('1234567');
    expect(r2.fromCache).toBe(true);
    expect(upstreamCalls).toEqual(['1234567']);
    expect(rows).toHaveLength(1); // qayta ochish o'ziniki: qator yozilmaydi
  });

  it('kesh muddati upstream dan olingan vaqtdan: 5 soatda keshdan, 7 soatda yangidan', async () => {
    const { c, upstreamCalls, rows } = setup();
    vi.setSystemTime(new Date('2026-09-21T09:00:00Z'));
    await c.search('a', { no: '1234567' });
    vi.setSystemTime(new Date('2026-09-21T14:00:00Z'));
    const b = await c.search('b', { no: '1234567' });
    expect(b.fromCache).toBe(true);
    expect(rows[1].result).toBeNull(); // keshdan olingan qator natijasiz: kvota uchun
    vi.setSystemTime(new Date('2026-09-21T19:00:00Z'));
    const cc = await c.search('c', { no: '1234567' });
    expect(cc.fromCache).toBe(false);
    expect(upstreamCalls).toHaveLength(2);
  });

  it("oradan boshqa birov qidirgan bo'lsa ham o'zining vagonini qayta ochish bepul", async () => {
    const { c, rows } = setup({ freeTotal: 1 });
    vi.setSystemTime(new Date('2026-09-21T09:00:00Z'));
    await c.search('a', { no: '1234567' });
    vi.setSystemTime(new Date('2026-09-21T10:00:00Z'));
    await c.search('b', { no: '1234567' });
    vi.setSystemTime(new Date('2026-09-21T11:00:00Z'));
    expect(await status(c.search('a', { no: '1234567' }))).toBe(200);
    expect(rows.filter((r) => r.userId === 'a')).toHaveLength(1);
    // Boshqa vagon esa kvotadan: bepul qidiruv tugagan
    expect(await status(c.search('a', { no: '7654321' }))).toBe(402);
  });

  it('6 soatdan keyin qayta ochish yangi qidiruv', async () => {
    const { c } = setup({ freeTotal: 1 });
    vi.setSystemTime(new Date('2026-09-21T09:00:00Z'));
    await c.search('a', { no: '1234567' });
    vi.setSystemTime(new Date('2026-09-21T16:00:00Z'));
    expect(await status(c.search('a', { no: '1234567' }))).toBe(402);
  });

  it("bir vaqtda ikkita so'rov: bitta bepul qidiruv bir marta yeyiladi", async () => {
    const { c, upstreamCalls, rows } = setup({ freeTotal: 1 });
    const [s1, s2] = await Promise.all([status(c.search('a', { no: '1234567' })), status(c.search('a', { no: '7654321' }))]);
    expect([s1, s2].sort()).toEqual([200, 402]);
    expect(upstreamCalls).toHaveLength(1);
    expect(rows).toHaveLength(1);
  });

  it('obunachi cheksiz, har qidiruv qator yozadi', async () => {
    const { c, rows } = setup({ freeTotal: 0, subscriber: true });
    expect(await status(c.search('s', { no: '1234567' }))).toBe(200);
    expect(await status(c.search('s', { no: '7654321' }))).toBe(200);
    expect(rows).toHaveLength(2);
  });
});
