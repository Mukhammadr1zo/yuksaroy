import { describe, expect, it } from 'vitest';
import { expireListings } from './expire-listings';
import type { PrismaService } from '../../../common/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.service';

const NOW = new Date('2026-09-24T09:00:00Z');
type Row = { id: string; title: string; orgId: string | null; ownerUserId: string | null; createdById: string };

/**
 * Xabar bo'roni bu yerda to'siladi: bitta egaga bitta hodisa va bir siklda 200 qator.
 * Holat avval yoziladi, shuning uchun qator ACTIVE dan bir marta chiqadi va takror xabar bo'lmaydi.
 */
function fake(rows: Row[], moved = rows.length) {
  const find: Record<string, unknown>[] = [];
  const update: Record<string, unknown>[] = [];
  const pushed: { ids: readonly string[]; title: string; body: string | null }[] = [];
  const prisma = {
    listing: {
      findMany: async (a: Record<string, unknown>) => { find.push(a); return rows; },
      updateMany: async (a: { where: Record<string, unknown> }) => { update.push(a.where); return { count: moved }; },
    },
    user: { findMany: async (a: { where: { id: { in: string[] } } }) => a.where.id.in.map((id) => ({ id, locale: 'uz' })) },
    membership: { findMany: async () => [{ userId: 'org-member' }] },
    telegramLink: { findMany: async () => [] },
  } as unknown as PrismaService;
  const notifications = {
    recipients: async (w: { orgIds?: (string | null)[]; userIds?: (string | null)[] }) =>
      (w.orgIds ?? []).filter(Boolean).length ? ['org-member'] : (w.userIds ?? []).filter((x): x is string => !!x),
    push: async (ids: readonly string[], n: { title: string; body?: string | null }) => { pushed.push({ ids, title: n.title, body: n.body ?? null }); },
  } as unknown as NotificationsService;
  return { prisma, notifications, find, update, pushed };
}

const row = (id: string, o: Partial<Row> = {}): Row => ({ id, title: `Kran ${id}`, orgId: null, ownerUserId: 'u1', createdById: 'u1', ...o });

describe("muddati o'tgan e'lon", () => {
  it("shart: faol, namuna emas, muddati o'tgan; bir siklda 200 ta", async () => {
    const f = fake([]);
    expect(await expireListings(f.prisma, f.notifications, NOW)).toBe(0);
    expect(f.find[0]).toMatchObject({ where: { status: 'ACTIVE', isDemo: false, expiresAt: { lt: NOW } }, take: 200 });
    expect(f.update).toHaveLength(0);
  });

  it("holat sharti yangilashning o'zida: ikkinchi nusxa qayta yozmaydi", async () => {
    const f = fake([row('l1')]);
    await expireListings(f.prisma, f.notifications, NOW);
    expect(f.update[0]).toMatchObject({ status: 'ACTIVE', id: { in: ['l1'] } });
  });

  it("bitta egadagi uch e'lon uchun bitta xabar, qolganlari sanaladi", async () => {
    const f = fake([row('l1'), row('l2'), row('l3')]);
    expect(await expireListings(f.prisma, f.notifications, NOW)).toBe(3);
    expect(f.pushed).toHaveLength(1);
    expect(f.pushed[0].body).toContain('va yana 2 ta');
    expect(f.pushed[0].body).toContain('Kran l1');
  });

  it('ikki xil ega, ikki xabar', async () => {
    const f = fake([row('l1'), row('l2', { ownerUserId: 'u2', createdById: 'u2' })]);
    await expireListings(f.prisma, f.notifications, NOW);
    expect(f.pushed).toHaveLength(2);
  });

  it("tashkilot e'loni a'zolarga ketadi", async () => {
    const f = fake([row('l1', { orgId: 'o1' })]);
    await expireListings(f.prisma, f.notifications, NOW);
    expect(f.pushed[0].ids).toEqual(['org-member']);
  });

  it("hech narsa ko'chmasa xabar ketmaydi", async () => {
    const f = fake([row('l1')], 0);
    expect(await expireListings(f.prisma, f.notifications, NOW)).toBe(0);
    expect(f.pushed).toHaveLength(0);
  });
});
