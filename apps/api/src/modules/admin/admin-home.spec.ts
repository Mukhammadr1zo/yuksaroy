import { describe, expect, it } from 'vitest';
import { QUEUE_KEYS, type QueueKey, type QueueStat } from '../../common/admin-queues';
import { dayKeys } from '../impressions/day-series';
import { alertsOf, fillSeries, growthPair, sortWork } from './admin-home';

const empty = (): Record<QueueKey, QueueStat> =>
  Object.fromEntries(QUEUE_KEYS.map((k) => [k, { count: 0, oldest: null }])) as Record<QueueKey, QueueStat>;

describe('30 kunlik qator', () => {
  it("bo'sh kun 0, kalitlar tartibida 30 ta, bugun oxirgi", () => {
    // 2026-09-29 20:30 UTC = 30-sentabr 01:30 Toshkent: kun kaliti Toshkent bo'yicha
    const now = new Date('2026-09-29T20:30:00Z');
    const keys = dayKeys(now);
    const s = fillSeries(new Map([['2026-09-30', 4], ['2026-09-01', 2], ['2026-08-31', 9]]), keys);
    expect(s).toHaveLength(30);
    expect(keys[29]).toBe('2026-09-30');
    expect(s[29]).toBe(4);
    expect(s[0]).toBe(2); // 2026-09-01 oynaning birinchi kuni
    expect(s.reduce((a, b) => a + b, 0)).toBe(6); // 31-avgust oynadan tashqarida
  });
});

describe("o'sish oynalari", () => {
  it('7 kun va undan oldingi 7 kun, tutashgan chegara', () => {
    const now = new Date('2026-09-29T10:00:00Z');
    const p = growthPair(now);
    expect(p.last.gte.toISOString()).toBe('2026-09-22T10:00:00.000Z');
    expect(p.prev.lt).toEqual(p.last.gte);
    expect(p.prev.gte.toISOString()).toBe('2026-09-15T10:00:00.000Z');
  });
});

describe('bugungi ish', () => {
  it("bo'sh navbat chiqmaydi, eng eskisi birinchi, sanasiz oxirida", () => {
    const s = empty();
    s.listingsPendingReview = { count: 2, oldest: new Date('2026-09-20T00:00:00Z') };
    s.orgsPendingKyc = { count: 1, oldest: new Date('2026-09-10T00:00:00Z') };
    s.premiumPending = { count: 3, oldest: null };
    const w = sortWork(s);
    expect(w.map((x) => x.key)).toEqual(['orgsPendingKyc', 'listingsPendingReview', 'premiumPending']);
    expect(w[0]!.href).toBe('/admin/moderation?tab=kyc');
    expect(w[2]!.oldestAt).toBeNull();
  });
});

describe('ogohlantirishlar', () => {
  const ok = { ok: true, ms: 12 };

  it("sog' holatda hech narsa", () => {
    expect(alertsOf({ phonePlans: 2, wagon: { errors: 0, total: 40 }, ads: { expired: 0, ending: 0 }, db: ok })).toEqual([]);
  });

  it('vagon manbasi: yarmidan boshlab bad, undan kam warn', () => {
    expect(alertsOf({ phonePlans: 1, wagon: { errors: 5, total: 10 }, ads: null, db: ok })[0]).toEqual({ code: 'WAGON_UPSTREAM', tone: 'bad', n: 5, of: 10 });
    expect(alertsOf({ phonePlans: 1, wagon: { errors: 4, total: 10 }, ads: null, db: ok })[0]!.tone).toBe('warn');
  });

  it("tarif yo'q bad; reklama warn; baza sekin yoki yotgan bad", () => {
    expect(alertsOf({ phonePlans: 0, wagon: null, ads: { expired: 2, ending: 1 }, db: { ok: true, ms: 800 } }).map((a) => `${a.code}:${a.tone}`))
      .toEqual(['DB_SLOW:bad', 'NO_ACTIVE_PLAN:bad', 'AD_EXPIRED:warn', 'AD_ENDING:warn']);
    expect(alertsOf({ phonePlans: null, wagon: null, ads: null, db: { ok: false } })).toEqual([{ code: 'DB_DOWN', tone: 'bad' }]);
  });
});
