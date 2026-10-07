// E'lon izohi: excluded baho reytingga kirmaydi. Soxta prisma, baza yo'q.
//
// Kesh (Listing.ratingAvg/ratingCount) qatorlardan qaytadan hisoblanadigan yagona joy -
// admin izohni o'chirgandagi yo'l. Bu yerda excluded filtri tushib qolsa, o'z e'loniga
// yozilgan eski besh ball birinchi o'chirishdayoq reytingga qaytib kirardi.
import { describe, expect, it } from 'vitest';
import type { AuditService } from '../../common/audit.service';
import type { PrismaService } from '../../common/prisma.service';
import type { BookingRepository } from '../booking/domain/ports';
import type { NotificationsService } from '../notifications/notifications.service';
import { AdminOpsController } from './admin-ops.controller';

type Row = { id: string; listingId: string; rating: number; excluded: boolean };

/** aggregate where ni rostdan qo'llaydi: kodda excluded filtri bo'lmasa, excluded qator ham sanaladi. */
function setup(rows: Row[]) {
  const saved: { ratingAvg?: number; ratingCount?: number } = {};
  const listingReview = {
    findUnique: async (a: { where: { id: string } }) => rows.find((r) => r.id === a.where.id) ?? null,
    delete: async (a: { where: { id: string } }) => { rows.splice(rows.findIndex((r) => r.id === a.where.id), 1); },
    aggregate: async (a: { where: { listingId: string; excluded?: boolean } }) => {
      const xs = rows.filter((r) => r.listingId === a.where.listingId && (a.where.excluded === undefined || r.excluded === a.where.excluded));
      return { _avg: { rating: xs.length ? xs.reduce((s, r) => s + r.rating, 0) / xs.length : null }, _count: { _all: xs.length } };
    },
  };
  const listing = {
    findUnique: async () => ({ ratingAvg: 4, ratingCount: 4 }),
    update: async (a: { data: { ratingAvg: number; ratingCount: number } }) => { Object.assign(saved, a.data); return {}; },
  };
  const prisma = { listingReview, listing, $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({ listingReview, listing }) } as unknown as PrismaService;
  const audit = { log: async () => {} } as unknown as AuditService;
  return { c: new AdminOpsController(prisma, audit, {} as NotificationsService, {} as BookingRepository), saved };
}

const row = (id: string, rating: number, excluded = false): Row => ({ id, listingId: 'l1', rating, excluded });

describe("e'lon izohi: excluded baho reytingga kirmaydi", () => {
  it("o'z e'loniga yozilgan eski besh ball boshqa izoh o'chirilganda qaytib kirmaydi", async () => {
    const { c, saved } = setup([row('o', 5, true), row('a', 3), row('b', 4), row('d', 4), row('soxta', 1)]);
    await c.deleteListingReview('admin', 'soxta');
    // (3 + 4 + 4) / 3 = 3,666... -> 3,67; besh ball sanalganda 4 va 4 ta bo'lardi
    expect(saved).toEqual({ ratingAvg: 3.67, ratingCount: 3 });
  });

  it("hisobga kiradigan baho qolmasa 0 va 0: migratsiya ham aynan shuni yozadi", async () => {
    const { c, saved } = setup([row('o', 5, true), row('a', 4)]);
    await c.deleteListingReview('admin', 'a');
    expect(saved).toEqual({ ratingAvg: 0, ratingCount: 0 });
  });

  it("excluded izohning o'zini o'chirish reytingni o'zgartirmaydi", async () => {
    const { c, saved } = setup([row('o', 5, true), row('a', 3), row('b', 4)]);
    await c.deleteListingReview('admin', 'o');
    expect(saved).toEqual({ ratingAvg: 3.5, ratingCount: 2 });
  });
});
