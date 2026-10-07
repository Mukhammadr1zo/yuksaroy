import { describe, expect, it } from 'vitest';
import { customerCloseAt, orderIdleSince } from '@yuksaroy/domain';
import type { PrismaService } from './prisma.service';
import { notClientClosed, stuckOrderIds } from './stuck-orders';

const d = (s: string) => new Date(s);
const idle = (o: Partial<Parameters<typeof orderIdleSince>[0]>) =>
  orderIdleSince({ lastActivityAt: null, slotEndsAt: null, confirmedAt: null, createdAt: d('2026-09-29T08:00:00Z'), storageDays: null, ...o });

describe('qotgan buyurtma', () => {
  it("harakatsizlik eng kech paytdan sanaladi: kelajakdagi slot buyurtmani qotgan qilmaydi", () => {
    expect(idle({ lastActivityAt: d('2026-10-01T10:00:00Z'), slotEndsAt: d('2026-11-01T12:00:00Z'), confirmedAt: d('2026-09-30T08:00:00Z') })).toEqual(d('2026-11-01T12:00:00Z'));
  });

  it("hodisasi ham, sloti ham bo'lmasa tasdiq yoki yaratilgan payt olinadi", () => {
    expect(idle({})).toEqual(d('2026-09-29T08:00:00Z'));
  });

  it("pullik saqlash xizmat oxirini suradi: yuk omborda turganda buyurtma qotgan emas", () => {
    // 30 kun saqlash: slot 1-oktabrda tugadi, xizmat 31-oktabrda tugaydi
    expect(idle({ slotEndsAt: d('2026-10-01T12:00:00Z'), storageDays: 30 })).toEqual(d('2026-10-31T12:00:00Z'));
    // Slotsiz: saqlash tasdiqdan boshlanadi
    expect(idle({ confirmedAt: d('2026-10-01T00:00:00Z'), storageDays: 10 })).toEqual(d('2026-10-11T00:00:00Z'));
    // Saqlashdan keyingi harakat baribir hisobga olinadi
    expect(idle({ slotEndsAt: d('2026-10-01T12:00:00Z'), storageDays: 2, lastActivityAt: d('2026-10-05T00:00:00Z') })).toEqual(d('2026-10-05T00:00:00Z'));
  });

  it("mijoz 7 kundan keyin yopa oladi, faqat CONFIRMED va IN_PROGRESS da", () => {
    const since = d('2026-10-01T00:00:00Z');
    expect(customerCloseAt('IN_PROGRESS', since)).toEqual(d('2026-10-08T00:00:00Z'));
    expect(customerCloseAt('CONFIRMED', since)).toEqual(d('2026-10-08T00:00:00Z'));
    expect(customerCloseAt('PENDING', since)).toBeNull();
    expect(customerCloseAt('DONE', since)).toBeNull();
  });
});

describe('stuckOrderIds', () => {
  const row = (id: string, o: { slotEndsAt?: string; storageDays?: number | null; last?: string; confirmedAt?: string }) => ({
    id, createdAt: d('2026-09-01T00:00:00Z'), confirmedAt: o.confirmedAt ? d(o.confirmedAt) : null, storageDays: o.storageDays ?? null,
    booking: o.slotEndsAt ? { slot: { endsAt: d(o.slotEndsAt) } } : null,
    history: o.last ? [{ at: d(o.last) }] : [],
  });

  it("bazadagi nomzodlardan qarorni domain qiladi: saqlashdagi buyurtma chiqmaydi", async () => {
    let where: unknown;
    const prisma = { order: { findMany: async (a: { where: unknown }) => { where = a.where; return [
      row('qotgan', { slotEndsAt: '2026-09-20T12:00:00Z', last: '2026-09-21T00:00:00Z' }),
      row('omborda', { slotEndsAt: '2026-09-20T12:00:00Z', storageDays: 30 }),
      row('saqlash-tugagan', { slotEndsAt: '2026-09-01T12:00:00Z', storageDays: 10 }),
    ]; } } } as unknown as PrismaService;
    const ids = await stuckOrderIds(prisma, d('2026-10-08T00:00:00Z'));
    expect(ids).toEqual(['qotgan', 'saqlash-tugagan']);
    // Bazadagi shart faqat zarur shartlar: chegara bir xil
    expect(where).toMatchObject({ createdAt: { lte: d('2026-10-01T00:00:00Z') }, history: { none: { at: { gt: d('2026-10-01T00:00:00Z') } } } });
  });
});

describe('notClientClosed', () => {
  // Prisma dagi none/some/not ma'nosi xotirada: buyurtma tarixiga qarab pul va komissiyaga kiradimi
  type Row = { fromStatus: string; toStatus: string; actorRole: string };
  const fits = (h: Row, f: object) => Object.entries(f).every(([k, v]) => (typeof v === 'object' ? h[k as keyof Row] !== v.not : h[k as keyof Row] === v));
  const counts = (rows: Row[]) => notClientClosed.OR.some(({ history: { none, some } }) =>
    none ? !rows.some((h) => fits(h, none)) : !!some && rows.some((h) => fits(h, some)));
  const done = (actorRole: string, fromStatus = 'IN_PROGRESS'): Row => ({ fromStatus, toStatus: 'DONE', actorRole });

  it("mijoz o'zi yopgani sanalmaydi, terminal yoki admin yakunlagani sanaladi", () => {
    expect(counts([done('TERMINAL')])).toBe(true);
    expect(counts([done('PLATFORM_ADMIN')])).toBe(true);
    // closeStuck yozadigan qator
    expect(counts([done('CLIENT')])).toBe(false);
    // Admin qayta ochdi, terminal yakunladi: ishni terminal tasdiqladi, yana sanaladi
    expect(counts([done('CLIENT'), { fromStatus: 'DONE', toStatus: 'IN_PROGRESS', actorRole: 'PLATFORM_ADMIN' }, done('TERMINAL')])).toBe(true);
    // Admin formasida DONE -> DONE saqlash yakunlash emas: mijoz yopgani pulga qaytmaydi
    expect(counts([done('CLIENT'), done('PLATFORM_ADMIN', 'DONE')])).toBe(false);
    // Tarixida DONE yo'q: shart boshqa sanoqqa qo'shilsa ham hech narsani to'smaydi
    expect(counts([])).toBe(true);
  });
});
