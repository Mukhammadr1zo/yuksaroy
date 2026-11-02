// Kunlik xulosa: kuniga bir marta, 09:00 (Toshkent) dan keyin, belgi bazada. Soxta Prisma, Telegram yo'q.
import { describe, expect, it, vi } from 'vitest';

const sent: { vars: (l: 'uz') => { list: string } }[] = [];
vi.mock('../../../common/telegram', () => ({
  notifyBoth: async (_p: unknown, _n: unknown, o: { vars: (l: 'uz') => { list: string } }) => { sent.push(o); },
  webUrl: (p: string) => `https://x${p}`,
}));
vi.mock('../../../common/stuck-orders', () => ({ stuckOrderIds: async () => [] }));
vi.mock('../../organizations/application/platform-admin', () => ({ PlatformAdmin: class { adminUserIds = async () => ['a1']; } }));

import type { NotificationsService } from '../../notifications/notifications.service';
import type { PrismaService } from '../../../common/prisma.service';
import { buildDigest, sendDailyDigest } from './admin-digest';

const OLD = new Date('2026-10-01T00:00:00Z');
/** cargo: ochiq yuk so'rovi soni; marks: bugungi admin.digest qatorlari (create bilan ko'payadi) */
function fake(o: { cargo?: number; marks?: number; claims?: number; overdue?: number } = {}) {
  const marks = { n: o.marks ?? 0 };
  const empty = { count: async () => 0, findFirst: async () => null, findMany: async () => [] };
  const prisma = {
    auditLog: {
      findFirst: async () => (marks.n ? { id: 'm' } : null),
      create: async () => { marks.n += 1; },
      count: async () => 0,
    },
    plan: { count: async () => 1 },
    adPlacement: { count: async () => 0 },
    adminTask: { count: async () => o.overdue ?? 0 },
    marketRequest: { count: async () => o.cargo ?? 1 },
    terminal: { count: async () => o.claims ?? 0, findFirst: async () => (o.claims ? { updatedAt: OLD } : null) },
    $queryRaw: async () => [{ at: null }],
    user: { findMany: async () => [] },
    listing: empty, organization: empty, premiumOrder: empty, subscription: empty, order: empty, urgentRequest: empty,
    contactMessage: empty, report: empty, inquiry: empty,
  } as unknown as PrismaService;
  return { prisma, marks };
}
const notifications = {} as NotificationsService;
// 2026-11-02 09:30 Toshkent = 04:30 UTC
const AFTER = new Date('2026-11-02T04:30:00Z');
const BEFORE = new Date('2026-11-02T03:30:00Z');

describe('kunlik xulosa', () => {
  it('09:00 gacha yuborilmaydi va belgi yozilmaydi', async () => {
    sent.length = 0;
    const { prisma, marks } = fake({ cargo: 0 });
    expect(await sendDailyDigest(prisma, notifications, BEFORE)).toBe('early');
    expect(marks.n).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("bugun belgi bor bo'lsa (deploydan keyin ham) qayta yuborilmaydi", async () => {
    sent.length = 0;
    const { prisma } = fake({ cargo: 0, marks: 1 });
    expect(await sendDailyDigest(prisma, notifications, AFTER)).toBe('done');
    expect(sent).toHaveLength(0);
  });

  it('bir marta yuboradi, ikkinchi chaqiruvda belgi to\'sadi', async () => {
    sent.length = 0;
    const { prisma, marks } = fake({ cargo: 0 });
    expect(await sendDailyDigest(prisma, notifications, AFTER)).toBe('sent');
    expect(await sendDailyDigest(prisma, notifications, AFTER)).toBe('done');
    expect(marks.n).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.vars('uz').list).toContain('https://x/admin/market');
  });

  it("hammasi bo'sh bo'lsa hech narsa yuborilmaydi, lekin belgi yoziladi", async () => {
    sent.length = 0;
    const { prisma, marks } = fake();
    expect(await sendDailyDigest(prisma, notifications, AFTER)).toBe('empty');
    expect(marks.n).toBe(1);
    expect(sent).toHaveLength(0);
  });

  it("faqat bo'sh bo'lmagan qatorlar chiqadi: muddati o'tgan vazifa, kutib qolgan da'vo", async () => {
    const { prisma } = fake({ overdue: 2, claims: 3 });
    const lines = await buildDigest(prisma, AFTER);
    expect(lines.map((l) => l.href)).toEqual(['/admin/moderation?tab=claims', '/admin/moderation']);
    expect(lines[1]!.text.uz).toBe("Muddati o'tgan vazifa: 2");
  });
});
