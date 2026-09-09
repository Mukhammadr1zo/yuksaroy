import { describe, expect, it } from 'vitest';
import { DailyBucket, IpBucket, tashkentDay } from './ip-bucket';

describe('IpBucket', () => {
  it('limitgacha ruxsat, keyin rad, oyna o\'tgach yana ruxsat', () => {
    const b = new IpBucket(3, 60_000);
    const t0 = 1_000_000;
    expect(b.take('1.1.1.1', t0)).toBe(true);
    expect(b.take('1.1.1.1', t0 + 1)).toBe(true);
    expect(b.take('1.1.1.1', t0 + 2)).toBe(true);
    expect(b.take('1.1.1.1', t0 + 3)).toBe(false);
    expect(b.take('2.2.2.2', t0 + 3)).toBe(true); // boshqa IP mustaqil
    expect(b.take('1.1.1.1', t0 + 60_000)).toBe(true); // oyna tugadi
    expect(b.take('1.1.1.1', t0 + 60_001)).toBe(true);
  });

  it('remaining: yangi IP = limit, har take bilan kamayadi, 0 dan pastga tushmaydi, oyna o\'tgach tiklanadi', () => {
    const b = new IpBucket(2, 60_000);
    const t0 = 5_000_000;
    expect(b.remaining('9.9.9.9', t0)).toBe(2);
    b.take('9.9.9.9', t0);
    expect(b.remaining('9.9.9.9', t0)).toBe(1);
    b.take('9.9.9.9', t0);
    b.take('9.9.9.9', t0);
    expect(b.remaining('9.9.9.9', t0)).toBe(0);
    expect(b.remaining('9.9.9.9', t0 + 60_000)).toBe(2);
  });
});

describe('DailyBucket (Toshkent yarim tuni)', () => {
  it('limitgacha sanaydi, rad etganda used o\'zgarmaydi, Toshkent 00:00 da nolga qaytadi', () => {
    const b = new DailyBucket();
    const t0 = Date.UTC(2026, 8, 9, 10, 0, 0); // 15:00 Toshkent
    expect(b.take('u:1', 2, t0)).toEqual({ ok: true, used: 1, limit: 2 });
    expect(b.take('u:1', 2, t0 + 1)).toEqual({ ok: true, used: 2, limit: 2 });
    expect(b.take('u:1', 2, t0 + 2)).toEqual({ ok: false, used: 2, limit: 2 });
    expect(b.take('g:9.9.9.9', 1, t0)).toEqual({ ok: true, used: 1, limit: 1 }); // boshqa kalit mustaqil
    const beforeMidnight = Date.UTC(2026, 8, 9, 18, 59, 59); // 23:59:59 Toshkent
    expect(b.take('u:1', 2, beforeMidnight).ok).toBe(false);
    const afterMidnight = Date.UTC(2026, 8, 9, 19, 0, 0); // 00:00 Toshkent, 10-sentabr
    expect(tashkentDay(afterMidnight)).toBe(tashkentDay(beforeMidnight) + 1);
    expect(b.take('u:1', 2, afterMidnight)).toEqual({ ok: true, used: 1, limit: 2 });
    expect(b.take('u:2', 0, t0)).toEqual({ ok: false, used: 0, limit: 0 }); // limit 0 = o'chirilgan
  });
});
