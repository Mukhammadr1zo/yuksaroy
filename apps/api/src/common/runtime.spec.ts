// Jarayon xotirasi: halqa 50, yangisi birinchi, yo'l '?' dan kesiladi, Telegram hisoblagichlari.
import { describe, expect, it } from 'vitest';
import { pushError, recentErrors, recordTelegram, runtime, startedAt } from './runtime';

const err = (i: number, path = '/v1/x') => ({ status: 500, code: 'INTERNAL', method: 'GET', path, msg: `xato ${i}` });

describe('xatolar halqasi', () => {
  it('50 tadan oshmaydi, yangisi birinchi turadi', () => {
    for (let i = 0; i < 60; i++) pushError(err(i));
    const list = recentErrors();
    expect(list).toHaveLength(50);
    expect(list[0].msg).toBe('xato 59');
    expect(list[49].msg).toBe('xato 10');
  });

  it("yo'l '?' dan kesiladi: token qolmaydi; xabar 200 belgi", () => {
    pushError({ ...err(0, '/v1/auth?token=SECRET'), msg: 'm'.repeat(500) });
    const [e] = recentErrors();
    expect(e.path).toBe('/v1/auth');
    expect(e.path).not.toContain('SECRET');
    expect(e.msg).toHaveLength(200);
  });
});

describe('telegram belgisi', () => {
  it('ok va xato alohida sanaladi, oxirgi xato statusi qoladi', () => {
    const t = runtime.telegram;
    const ok0 = t.okSinceStart, fail0 = t.failSinceStart;
    const a = new Date('2026-09-29T10:00:00Z');
    const b = new Date('2026-09-29T10:01:00Z');
    recordTelegram(true, undefined, a);
    recordTelegram(false, 401, b);
    expect(t.okSinceStart).toBe(ok0 + 1);
    expect(t.failSinceStart).toBe(fail0 + 1);
    expect(t.lastOkAt).toEqual(a);
    expect(t.lastFailAt).toEqual(b);
    expect(t.lastFailStatus).toBe(401);
    recordTelegram(false, undefined, b);
    expect(t.lastFailStatus).toBeNull();
  });

  it('ishga tushgan vaqt bor va kunlik sikl boshida bo\'sh', () => {
    expect(startedAt).toBeInstanceOf(Date);
    expect(runtime.startedAt).toBe(startedAt);
  });
});
