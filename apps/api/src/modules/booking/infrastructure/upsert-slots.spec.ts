// Sig'im ochish: band qilingan oynaning vaqti o'zgarmaydi. Soxta baza, faqat yozuvga nima ketgani tekshiriladi.
//
// "Kelmadi" va terminalning bekor qilishi slot boshlanishidan hisoblanadi (2026-10-07). Shart tushib
// qolsa egasi oynani 00:00 ga surib, vaqt boshlanmasdan "Kelmadi" ni ochardi, mijozning vaqti esa
// unga aytilmasdan o'zgarardi.
import { describe, expect, it } from 'vitest';
import { PrismaBookingRepository } from './prisma-booking.repository';

function setup(existing: { booked: number; held: number } | null) {
  const updates: unknown[] = [];
  const prisma = {
    timeSlot: {
      findUnique: async () => existing,
      upsert: async (a: { update: unknown }) => { updates.push(a.update); },
    },
  };
  return { repo: new PrismaBookingRepository(prisma as never), updates };
}

describe('sig\'im ochish', () => {
  it("band yoki ushlangan joyi bor oynada faqat sig'im yangilanadi", async () => {
    for (const ex of [{ booked: 1, held: 0 }, { booked: 0, held: 1 }]) {
      const f = setup(ex);
      await f.repo.upsertSlots('t1', ['2026-10-08'], [{ window: 5, start: '00:00', end: '00:30', capacity: 3 }]);
      expect(f.updates).toEqual([{ capacity: 3 }]);
    }
  });

  it("bo'sh oynaning vaqti yangilanadi (Toshkent vaqti UTC+5)", async () => {
    const f = setup({ booked: 0, held: 0 });
    await f.repo.upsertSlots('t1', ['2026-10-08'], [{ window: 5, start: '16:00', end: '18:00', capacity: 3 }]);
    expect(f.updates).toEqual([{ startsAt: new Date('2026-10-08T11:00:00Z'), endsAt: new Date('2026-10-08T13:00:00Z'), capacity: 3 }]);
  });
});
