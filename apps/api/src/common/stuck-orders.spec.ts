import { describe, expect, it } from 'vitest';
import { customerCloseAt, orderIdleSince } from '@yuksaroy/domain';
import { stuckOrderWhere } from './stuck-orders';

const d = (s: string) => new Date(s);

describe('qotgan buyurtma', () => {
  it("harakatsizlik eng kech paytdan sanaladi: kelajakdagi slot buyurtmani qotgan qilmaydi", () => {
    const since = orderIdleSince({ lastActivityAt: d('2026-10-01T10:00:00Z'), slotEndsAt: d('2026-11-01T12:00:00Z'), confirmedAt: d('2026-09-30T08:00:00Z'), createdAt: d('2026-09-29T08:00:00Z') });
    expect(since).toEqual(d('2026-11-01T12:00:00Z'));
  });

  it("hodisasi ham, sloti ham bo'lmasa tasdiq yoki yaratilgan payt olinadi", () => {
    expect(orderIdleSince({ lastActivityAt: null, slotEndsAt: null, confirmedAt: null, createdAt: d('2026-09-29T08:00:00Z') })).toEqual(d('2026-09-29T08:00:00Z'));
  });

  it("mijoz 7 kundan keyin yopa oladi, faqat CONFIRMED va IN_PROGRESS da", () => {
    const since = d('2026-10-01T00:00:00Z');
    expect(customerCloseAt('IN_PROGRESS', since)).toEqual(d('2026-10-08T00:00:00Z'));
    expect(customerCloseAt('CONFIRMED', since)).toEqual(d('2026-10-08T00:00:00Z'));
    expect(customerCloseAt('PENDING', since)).toBeNull();
    expect(customerCloseAt('DONE', since)).toBeNull();
  });

  it("bazadagi shart xuddi shu chegarani ishlatadi", () => {
    const w = stuckOrderWhere(d('2026-10-08T00:00:00Z'));
    expect(w.createdAt).toEqual({ lte: d('2026-10-01T00:00:00Z') });
    expect(w.history).toEqual({ none: { at: { gt: d('2026-10-01T00:00:00Z') } } });
  });
});
