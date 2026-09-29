// Kunlik tozalash: soxta Prisma, baza yo'q.
//
// Ikki narsa tekshiriladi. Birinchisi: tozalash sutkada bir marta ishlaydi, har 30 soniyalik
// tikda emas. Ikkinchisi: amallar jurnali va ko'rishlar jadvaliga umuman tegilmaydi, chunki
// telefon kvotasi jurnaldan, e'lon kartasidagi ko'rishlar soni esa ko'rishlar jadvalidan
// hisoblanadi; ular o'chsa ekrandagi raqam sababsiz kichrayib ketardi.
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../common/prisma.service';
import { runtime } from '../../../common/runtime';
import type { IdempotencyService } from '../../../common/idempotency.service';
import type { BookingRepository } from '../../booking/domain/ports';
import type { OrderRepository } from '../domain/ports';
import type { AdminNotify } from '../../organizations/application/admin-notify';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { OrderActionsUseCase } from './order-actions.usecase';
import { SlaSweeperService } from './sla-sweeper.service';

type Call = { model: string; where: Record<string, unknown> };

function setup(o: { dailyFails?: boolean } = {}) {
  const calls: Call[] = [];
  const del = (model: string) => ({
    deleteMany: async (a: { where: Record<string, unknown> }) => { calls.push({ model, where: a.where }); return { count: 1 }; },
  });
  let listingReads = 0;
  const prisma = {
    // dailyFails: birinchi bosqich yiqiladi, sikl xato bilan tugaydi (runtime.daily.ok=false)
    session: o.dailyFails ? { deleteMany: async () => { throw new Error('baza yotibdi'); } } : del('session'),
    otpCode: del('otpCode'),
    notification: del('notification'),
    // Muddati o'tgan e'lon alohida spec da: bu yerda ro'yxat bo'sh.
    // deleteMany EMAS, shuning uchun calls ga tushmaydi
    listing: { findMany: async () => { listingReads += 1; return []; }, updateMany: async () => ({ count: 0 }) },
    // Vazifa yopilishi har tikda: ochiq vazifa yo'q, so'rov shu bilan tugaydi
    adminTask: { findMany: async () => [] },
    // Bular ataylab yo'q: chaqirilsa test "is not a function" bilan yiqiladi
  } as unknown as PrismaService;
  const purged: Date[] = [];
  const idempotency = { purge: async (now: Date) => { purged.push(now); return 2; } } as unknown as IdempotencyService;
  const bookings = { releaseExpired: async () => 0 } as unknown as BookingRepository;
  const orders = { findExpired: async () => [] } as unknown as OrderRepository;
  const actions = { expire: async () => {} } as unknown as OrderActionsUseCase;
  // Adminlarga eslatma alohida tekshiriladi: bu yerda faqat tozalash
  const adminNotify = { stale: async () => {} } as unknown as AdminNotify;
  // Obuna eslatmasi alohida spec da: soxta prisma da remindExpiring yiqiladi va yutiladi
  const notifications = { recipients: async () => [], push: async () => {} } as unknown as NotificationsService;
  return { svc: new SlaSweeperService(bookings, orders, actions, prisma, idempotency, adminNotify, notifications), calls, purged, reads: () => listingReads };
}

const DAY = 86_400_000;

describe('kunlik tozalash', () => {
  it('birinchi tikda ishlaydi', async () => {
    const { svc, calls, purged } = setup();
    await svc.tick();
    expect(purged).toHaveLength(1);
    expect(calls.map((c) => c.model)).toEqual(['session', 'otpCode', 'notification']);
  });

  it('keyingi tikda qayta ishlamaydi', async () => {
    const { svc, purged } = setup();
    await svc.tick();
    await svc.tick();
    await svc.tick();
    expect(purged).toHaveLength(1);
  });

  it('sutkadan keyin yana ishlaydi', async () => {
    const { svc, purged } = setup();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-09-22T10:00:00Z'));
      await svc.tick();
      expect(purged).toHaveLength(1);
      vi.setSystemTime(new Date(Date.now() + DAY + 1000));
      await svc.tick();
    } finally {
      vi.useRealTimers();
    }
    expect(purged).toHaveLength(2);
  });

  it("o'chirish shartlari to'g'ri maydonlarga qo'yiladi", async () => {
    const { svc, calls } = setup();
    await svc.tick();
    const by = Object.fromEntries(calls.map((c) => [c.model, c.where]));
    // Sessiya: bekor qilingani ham, muddati o'tgani ham
    expect(Object.keys(by.session)).toEqual(['OR']);
    expect((by.session.OR as Record<string, unknown>[]).map((x) => Object.keys(x)[0])).toEqual(['revokedAt', 'expiresAt']);
    // Kod: yaratilgan vaqti bo'yicha
    expect(Object.keys(by.otpCode)).toEqual(['createdAt']);
    // Bildirishnoma: faqat o'qilgani
    expect((by.notification.readAt as Record<string, unknown>).not).toBeNull();
  });
});

/** Faqat stub qo'shilsa, chaqiruv keyin tushib qolsa ham testlar yashil qolardi: xato tick ichida yutiladi. */
it("kunlik sikl muddati o'tgan e'lonlarni ham ko'radi", async () => {
  const { svc, reads } = setup();
  await svc.tick();
  await svc.tick();
  expect(reads()).toBe(1); // tikda emas, sutkada bir marta
});

/** Tizim sahifasi uchun natija: sikl tugadimi, qancha vaqt oldi, nima qildi. */
describe('kunlik sikl natijasi (runtime.daily)', () => {
  it('muvaffaqiyatda ok=true va sonlar', async () => {
    const { svc } = setup();
    await svc.tick();
    expect(runtime.daily?.ok).toBe(true);
    expect(runtime.daily?.result).toMatchObject({ keys: 2, sessions: 1, codes: 1, notes: 1, reminded: 0, expired: 0, stale: 0 });
    expect(runtime.daily?.ms).toBeGreaterThanOrEqual(0);
  });

  it('bosqich yiqilsa ok=false, xabar va yetgan joygacha natija; tick o\'zi yiqilmaydi', async () => {
    const { svc } = setup({ dailyFails: true });
    await expect(svc.tick()).resolves.toEqual({ holds: 0, orders: 0 });
    expect(runtime.daily?.ok).toBe(false);
    expect(runtime.daily?.error).toBe('baza yotibdi');
    expect(runtime.daily?.result).toMatchObject({ keys: 2, sessions: 0 });
  });
});
