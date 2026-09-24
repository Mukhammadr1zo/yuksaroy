// Obuna e'lonlarni ko'taradi (Premium alohida sotilmaydi). Soxta Prisma, DB yo'q.
// Bularsiz obunachi to'lagandan keyin ham e'lonlari ro'yxatda pastda qolib ketardi.
import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../../common/prisma.service';
import type { AdminNotify } from '../organizations/application/admin-notify';
import { SubscriptionService, subscriberListingFilter } from './subscription.service';

type Update = { where: Record<string, unknown>; data: Record<string, unknown> };

function fake(active: { endsAt: Date } | null, orgIds: string[] = []) {
  const updates: Update[] = [];
  const prisma = {
    subscription: { findFirst: async () => active },
    membership: { findMany: async () => orgIds.map((orgId) => ({ orgId })) },
    listing: { updateMany: async (a: Update) => { updates.push(a); return { count: 1 }; } },
  } as unknown as PrismaService;
  return { prisma, updates };
}

// Adminlarga xabar shu testda tekshirilmaydi: u alohida spec da
const adminNotify = { queued: async () => {} } as unknown as AdminNotify;
const notifications = { recipients: async () => [], push: async () => {} } as never;

describe('obuna e\'lonni ko\'taradi', () => {
  const endsAt = new Date('2026-12-01T00:00:00Z');

  it('obunachining e\'loni obuna muddatigacha ko\'tariladi', async () => {
    const { prisma, updates } = fake({ endsAt });
    await new SubscriptionService(prisma, { get: async () => ({}) } as never, adminNotify, notifications).raiseListing('u1', 'l1');
    expect(updates).toHaveLength(1);
    expect(updates[0].data).toEqual({ premiumUntil: endsAt });
    expect(updates[0].where.id).toBe('l1');
  });

  it('obunasi yo\'q odamda hech narsa yozilmaydi', async () => {
    const { prisma, updates } = fake(null);
    await new SubscriptionService(prisma, { get: async () => ({}) } as never, adminNotify, notifications).raiseListing('u1', 'l1');
    expect(updates).toHaveLength(0);
  });

  it('uzoqroq muddat qisqarmaydi: faqat kichigi yangilanadi', async () => {
    const { prisma, updates } = fake({ endsAt });
    await new SubscriptionService(prisma, { get: async () => ({}) } as never, adminNotify, notifications).raiseListing('u1', 'l1');
    // Shart: premiumUntil yo'q yoki obuna tugashidan oldin
    expect(updates[0].where.OR).toEqual([{ premiumUntil: null }, { premiumUntil: { lt: endsAt } }]);
  });

  it('e\'lon egaligi: o\'ziniki va a\'zo bo\'lgan tashkilotlarniki', async () => {
    const { prisma } = fake(null, ['o1', 'o2']);
    expect(await subscriberListingFilter(prisma, 'u1')).toEqual({
      OR: [{ ownerUserId: 'u1' }, { createdById: 'u1' }, { orgId: { in: ['o1', 'o2'] } }],
    });
  });

  it('tashkilotsiz odamda bo\'sh in() sharti tushib qoladi', async () => {
    const { prisma } = fake(null, []);
    expect(await subscriberListingFilter(prisma, 'u1')).toEqual({
      OR: [{ ownerUserId: 'u1' }, { createdById: 'u1' }],
    });
  });
});
