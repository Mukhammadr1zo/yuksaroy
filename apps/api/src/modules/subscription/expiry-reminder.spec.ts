import { describe, expect, it } from 'vitest';
import { remindExpiring } from './expiry-reminder';
import type { PrismaService } from '../../common/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';

const NOW = new Date('2026-09-24T09:00:00Z');
const ENDS = new Date('2026-09-26T10:00:00Z');

function fake(rows: { id: string; userId: string; endsAt: Date | null }[], claimed = 1) {
  const steps: string[] = [];
  let where: Record<string, unknown> = {};
  const pushed: { ids: readonly string[]; title: string; body: string | null; href: string | null; kind: string }[] = [];
  const prisma = {
    subscription: {
      findMany: async (a: { where: Record<string, unknown> }) => { where = a.where; return rows; },
      updateMany: async (a: { where: Record<string, unknown> }) => { steps.push(`claim:${JSON.stringify(a.where)}`); return { count: claimed }; },
    },
    user: { findMany: async (a: { where: { id: { in: string[] } } }) => a.where.id.in.map((id) => ({ id, locale: 'uz' })) },
    telegramLink: { findMany: async () => [] },
  } as unknown as PrismaService;
  const notifications = {
    recipients: async (w: { userIds?: (string | null | undefined)[] }) => (w.userIds ?? []).filter((x): x is string => !!x),
    push: async (ids: readonly string[], n: { kind: string; title: string; body?: string | null; href?: string | null }) => {
      steps.push('push');
      pushed.push({ ids, kind: n.kind, title: n.title, body: n.body ?? null, href: n.href ?? null });
    },
  } as unknown as NotificationsService;
  return { prisma, notifications, steps, pushed, where: () => where };
}

describe('obuna tugashi eslatmasi', () => {
  it('oynadagi obunaga bitta yozuv ketadi', async () => {
    const f = fake([{ id: 's1', userId: 'u1', endsAt: ENDS }]);
    expect(await remindExpiring(f.prisma, f.notifications, NOW)).toBe(1);
    expect(f.pushed).toHaveLength(1);
    expect(f.pushed[0].ids).toEqual(['u1']);
    expect(f.pushed[0].kind).toBe('subscription');
    expect(f.pushed[0].href).toBe('/dashboard/subscription');
    expect(f.pushed[0].title).toContain('tugayapti');
    expect(f.pushed[0].body).toContain('2026-09-26');
  });

  it('belgi yuborishdan oldin qo\'yiladi', async () => {
    const f = fake([{ id: 's1', userId: 'u1', endsAt: ENDS }]);
    await remindExpiring(f.prisma, f.notifications, NOW);
    expect(f.steps[0]).toBe('claim:{"id":"s1","remindedAt":null}');
    expect(f.steps[1]).toBe('push');
  });

  it('belgini boshqa nusxa olgan bo\'lsa xabar ketmaydi', async () => {
    const f = fake([{ id: 's1', userId: 'u1', endsAt: ENDS }], 0);
    expect(await remindExpiring(f.prisma, f.notifications, NOW)).toBe(0);
    expect(f.pushed).toHaveLength(0);
  });

  it('shart: uch kunlik oyna, belgisiz qator, keyingi obunasi yo\'q', async () => {
    const f = fake([]);
    await remindExpiring(f.prisma, f.notifications, NOW);
    const until = new Date(NOW.getTime() + 3 * 86_400_000);
    expect(f.where()).toEqual({
      status: 'ACTIVE',
      remindedAt: null,
      endsAt: { gt: NOW, lte: until },
      user: { subscriptions: { none: { status: 'ACTIVE', endsAt: { gt: until } } } },
    });
  });

  it('muddati yo\'q qator o\'tkazib yuboriladi', async () => {
    const f = fake([{ id: 's1', userId: 'u1', endsAt: null }]);
    expect(await remindExpiring(f.prisma, f.notifications, NOW)).toBe(0);
    expect(f.steps).toHaveLength(0);
  });
});
