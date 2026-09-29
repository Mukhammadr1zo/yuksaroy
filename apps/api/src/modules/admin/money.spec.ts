// Takroriy pul hisobi, sof: baza yo'q. Har holat bitta qoidaga (covers) qaytadi.
import { describe, expect, it } from 'vitest';
import { activeAt, covers, mergeMonths, monthEnd, monthlyOf, snapshot, subscriptionMonths, type SubRow } from './money';
import type { RevenueMonth } from './revenue';

// 2026-09-15, Toshkent kunduzi
const NOW = new Date('2026-09-15T06:00:00Z');
const sub = (userId: string, startsAt: string, endsAt: string, o: Partial<SubRow> = {}): SubRow => ({
  userId, paidAt: new Date(startsAt), startsAt: new Date(startsAt), endsAt: new Date(endsAt), amountTiyin: 9_900_000n, months: 1, ...o,
});

describe('covers', () => {
  const s = sub('u', '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z');
  it('startsAt qamraydi, endsAt qamramaydi', () => {
    expect(covers(s, new Date('2026-09-01T00:00:00Z'))).toBe(true);
    expect(covers(s, new Date('2026-10-01T00:00:00Z'))).toBe(false);
    expect(covers(s, new Date('2026-09-30T23:59:59Z'))).toBe(true);
  });
  it('paidAt null hech qayerda sanalmaydi', () => {
    expect(covers({ ...s, paidAt: null }, new Date('2026-09-10T00:00:00Z'))).toBe(false);
  });
  it('startsAt yoki endsAt yo\'q (PENDING) qamramaydi', () => {
    expect(covers({ ...s, startsAt: null }, NOW)).toBe(false);
    expect(covers({ ...s, endsAt: null }, NOW)).toBe(false);
  });
});

describe('oylik ekvivalent va oy oxiri', () => {
  it('12 oylik 990 000 so\'m = 82 500 so\'m/oy', () => {
    expect(monthlyOf(sub('u', '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z', { amountTiyin: 99_000_000n, months: 12 }))).toBe(8_250_000);
  });
  it('oy oxiri keyingi oyning Toshkent boshi', () => {
    expect(monthEnd('2026-09').toISOString()).toBe('2026-09-30T19:00:00.000Z');
    expect(monthEnd('2026-12').toISOString()).toBe('2026-12-31T19:00:00.000Z');
  });
});

describe('activeAt', () => {
  it('bir odamda ikki faol qator bitta odam, pul esa ikkalasidan', () => {
    const rows = [
      sub('u', '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z'),
      sub('u', '2026-09-05T00:00:00Z', '2026-10-05T00:00:00Z', { amountTiyin: 1_000_000n }),
    ];
    const a = activeAt(rows, NOW);
    expect(a.users.size).toBe(1);
    expect(a.mrrTiyin).toBe(9_900_000 + 1_000_000);
  });
});

describe('subscriptionMonths', () => {
  it('12 qator, yangisi birinchi, joriy oy birinchi', () => {
    const m = subscriptionMonths([], NOW);
    expect(m).toHaveLength(12);
    expect(m[0].month).toBe('2026-09');
    expect(m[11].month).toBe('2025-10');
  });

  it('endsAt = bekor vaqti: keyingi oyda ketgan deb sanaladi', () => {
    // Iyulda olgan, avgust o'rtasida bekor qilingan (pul kelgan): iyul oxirida faol, avgust oxirida yo'q
    const rows = [sub('u', '2026-07-03T00:00:00Z', '2026-08-15T00:00:00Z')];
    const by = Object.fromEntries(subscriptionMonths(rows, NOW).map((r) => [r.month, r]));
    expect(by['2026-07'].activeUsers).toBe(1);
    expect(by['2026-07'].newUsers).toBe(1);
    expect(by['2026-08'].activeUsers).toBe(0);
    expect(by['2026-08'].churnedUsers).toBe(1);
    expect(by['2026-09'].churnedUsers).toBe(0);
  });

  it('joriy oy oy oxirida o\'lchanadi: oy o\'rtasida tugagan odam prognozda yo\'q', () => {
    // 20-sentabrda tugaydi: bugun faol, oy oxirida emas
    const rows = [sub('u', '2026-08-20T00:00:00Z', '2026-09-20T00:00:00Z')];
    const cur = subscriptionMonths(rows, NOW)[0];
    expect(cur.month).toBe('2026-09');
    expect(cur.activeUsers).toBe(0);
    expect(cur.churnedUsers).toBe(1);
  });

  it('uzaytirish zanjirida odam bir marta va ketgan emas', () => {
    const rows = [
      sub('u', '2026-08-01T00:00:00Z', '2026-09-01T00:00:00Z'),
      sub('u', '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z'),
    ];
    const by = Object.fromEntries(subscriptionMonths(rows, NOW).map((r) => [r.month, r]));
    expect(by['2026-08'].activeUsers).toBe(1);
    expect(by['2026-09']).toMatchObject({ activeUsers: 1, newUsers: 0, churnedUsers: 0, mrrTiyin: 9_900_000 });
  });
});

describe('snapshot', () => {
  it('hozir faol, oy oxirida yo\'q: xavf ostida', () => {
    const rows = [
      sub('a', '2026-08-20T00:00:00Z', '2026-09-20T00:00:00Z'),
      sub('b', '2026-09-01T00:00:00Z', '2026-12-01T00:00:00Z', { amountTiyin: 29_700_000n, months: 3 }),
      sub('c', '2026-08-20T00:00:00Z', '2026-09-20T00:00:00Z', { paidAt: null }),
    ];
    const s = snapshot(rows, NOW);
    expect(s.activeUsers).toBe(2);
    expect(s.mrrTiyin).toBe(9_900_000 + 9_900_000);
    expect(s.activeEndUsers).toBe(1);
    expect(s.mrrEndTiyin).toBe(9_900_000);
    expect(s.atRiskUsers).toBe(1);
    expect(s.atRiskTiyin).toBe(9_900_000);
  });
});

describe('mergeMonths', () => {
  it('to\'lovsiz oy nol bilan chiqadi, tushum ustunlari mos oyga tushadi, joriy oy prognoz', () => {
    const subs = subscriptionMonths([], NOW);
    const rev: RevenueMonth[] = [{ month: '2026-08', totalTiyin: 5, subsTiyin: 3, premiumTiyin: 2, payments: 2, renewals: 1 }];
    const m = mergeMonths(rev, subs);
    expect(m).toHaveLength(12);
    expect(m[0]).toMatchObject({ month: '2026-09', totalTiyin: 0, payments: 0, forecast: true });
    expect(m[1]).toMatchObject({ month: '2026-08', totalTiyin: 5, subsTiyin: 3, premiumTiyin: 2, payments: 2, renewals: 1, forecast: false });
  });
});
