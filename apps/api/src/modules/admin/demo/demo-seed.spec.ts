// Namuna yuklash mantig'i (soxta Prisma, DB yo'q): odamlar nofaol, e'lonlar muddatsiz,
// so'rovlar har yuklashda bugungi sanaga qaytadi. Bularsiz namuna qatorlar 30/90 kundan
// keyin o'z-o'zidan yo'qolar yoki namuna telefon bilan kirib bo'lar edi.
import { describe, expect, it } from 'vitest';
import { BOOKING } from '@yuksaroy/domain';
import { DEMO_SLOT_DAYS } from './demo-data';
import { seedDemo } from './demo-seed';

type Call = { data: Record<string, unknown> };

/** Soxta Prisma: yozuvlarni yig'adi, `existing` ro'yxatdagi so'rovlar "bor" deb update yo'liga ketadi. */
function fakePrisma(existing: string[] = []) {
  const calls = { users: [] as Call[], listings: [] as Call[], requestUpdates: [] as Call[], requestCreates: [] as Call[], terminals: [] as Call[], slots: [] as Call[] };
  const upsertInto = (bucket: Call[]) => async (a: { create: Record<string, unknown>; update: Record<string, unknown> }) => { bucket.push({ data: a.update }); return {}; };
  const noop = async () => ({});
  const prisma = {
    organization: { upsert: noop, count: async () => 0 },
    user: { upsert: upsertInto(calls.users), count: async () => 0 },
    membership: { upsert: noop },
    listing: { upsert: upsertInto(calls.listings), count: async () => 0 },
    serviceProfile: { upsert: noop, count: async () => 0 },
    marketRequest: {
      findUnique: async (a: { where: { id: string } }) => (existing.includes(a.where.id) ? { id: a.where.id } : null),
      update: async (a: { data: Record<string, unknown> }) => { calls.requestUpdates.push({ data: a.data }); return {}; },
      create: async (a: { data: Record<string, unknown> }) => { calls.requestCreates.push({ data: a.data }); return {}; },
      count: async () => 0,
    },
    // Namuna terminal: stansiya nomi bo'yicha topiladi, keyin xizmat, tarif va slot kalendari
    station: { findFirst: async () => ({ id: 'st-1' }) },
    terminal: { upsert: upsertInto(calls.terminals), count: async () => 0 },
    terminalService: { deleteMany: noop, createMany: noop },
    tariff: { count: async () => 0, createMany: noop },
    timeSlot: { upsert: async (a: { create: Record<string, unknown> }) => { calls.slots.push({ data: a.create }); return {}; } },
    $queryRaw: async () => [{ nextval: 1n }],
  };
  return { prisma: prisma as never, calls };
}

describe('namuna yuklash', () => {
  const now = new Date('2026-09-21T09:00:00Z');

  it('namuna odamlar nofaol: namuna telefon bilan kirib bo\'lmaydi', async () => {
    const { prisma, calls } = fakePrisma();
    await seedDemo(prisma, now);
    expect(calls.users.length).toBeGreaterThan(0);
    for (const c of calls.users) expect(c.data.isActive).toBe(false);
  });

  it('namuna e\'lonlar muddatsiz (expiresAt null)', async () => {
    const { prisma, calls } = fakePrisma();
    await seedDemo(prisma, now);
    expect(calls.listings.length).toBeGreaterThan(0);
    for (const c of calls.listings) expect(c.data.expiresAt).toBeNull();
  });

  it('namuna terminal egali, faol va slot kalendari bilan: joy band qilishni sinab ko\'rish mumkin', async () => {
    const { prisma, calls } = fakePrisma();
    await seedDemo(prisma, now);
    expect(calls.terminals.length).toBeGreaterThan(0);
    for (const c of calls.terminals) {
      expect(c.data.isDemo).toBe(true);
      expect(c.data.status).toBe('ACTIVE');
      // Egasiz yoki stansiyasiz terminalda buyurtma yaratib bo'lmaydi (create-order TERMINAL_NO_STATION beradi)
      expect(c.data.orgId).toMatch(/^demo-org-/);
      expect(c.data.stationId).toBe('st-1');
      // Telefon namuna qatorda hech qachon bo'lmaydi
      expect(c.data.phone).toBeNull();
    }
    // Har terminalga DEMO_SLOT_DAYS kun x oynalar soni: kalendar bo'sh qolmasin
    expect(calls.slots).toHaveLength(calls.terminals.length * DEMO_SLOT_DAYS * BOOKING.defaultWindows.length);
  });

  it('so\'rovlar yaratishda ham, qayta yuklashda ham bugungi createdAt oladi', async () => {
    const { prisma, calls } = fakePrisma(['demo-request-01']);
    await seedDemo(prisma, now);
    expect(calls.requestUpdates).toHaveLength(1);
    expect(calls.requestUpdates[0].data.createdAt).toEqual(now);
    expect(calls.requestCreates.length).toBeGreaterThan(0);
    for (const c of calls.requestCreates) expect(c.data.createdAt).toEqual(now);
  });
});
