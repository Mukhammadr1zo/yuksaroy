// Kunlik tozalash: soxta Prisma, baza yo'q.
//
// Ikki narsa tekshiriladi. Birinchisi: tozalash sutkada bir marta ishlaydi, har 30 soniyalik
// tikda emas. Ikkinchisi: amallar jurnali va ko'rishlar jadvaliga umuman tegilmaydi, chunki
// telefon kvotasi jurnaldan, e'lon kartasidagi ko'rishlar soni esa ko'rishlar jadvalidan
// hisoblanadi; ular o'chsa ekrandagi raqam sababsiz kichrayib ketardi.
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../common/prisma.service';
import type { IdempotencyService } from '../../../common/idempotency.service';
import type { BookingRepository } from '../../booking/domain/ports';
import type { OrderRepository } from '../domain/ports';
import type { OrderActionsUseCase } from './order-actions.usecase';
import { SlaSweeperService } from './sla-sweeper.service';

type Call = { model: string; where: Record<string, unknown> };

function setup() {
  const calls: Call[] = [];
  const del = (model: string) => ({
    deleteMany: async (a: { where: Record<string, unknown> }) => { calls.push({ model, where: a.where }); return { count: 1 }; },
  });
  const prisma = {
    session: del('session'),
    otpCode: del('otpCode'),
    notification: del('notification'),
    // Bular ataylab yo'q: chaqirilsa test "is not a function" bilan yiqiladi
  } as unknown as PrismaService;
  const purged: Date[] = [];
  const idempotency = { purge: async (now: Date) => { purged.push(now); return 2; } } as unknown as IdempotencyService;
  const bookings = { releaseExpired: async () => 0 } as unknown as BookingRepository;
  const orders = { findExpired: async () => [] } as unknown as OrderRepository;
  const actions = { expire: async () => {} } as unknown as OrderActionsUseCase;
  return { svc: new SlaSweeperService(bookings, orders, actions, prisma, idempotency), calls, purged };
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
