// Tashrif mayog'i: sanoq + Telegram xabari uchun sahifa yo'li. Soxta xizmatlar, baza yo'q.
import { describe, expect, it, vi } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ImpressionsController, VisitDto, reduceReferrer } from './impressions.controller';

function setup(userId: string | null = null) {
  const impressions = { recordVisit: vi.fn(async () => {}) };
  const activity = { visit: vi.fn() };
  const tokens = { verifyAccess: vi.fn(() => { if (!userId) throw new Error('x'); return { sub: userId }; }) };
  const c = new ImpressionsController(impressions as never, {} as never, {} as never, {} as never, {} as never, tokens as never, activity as never);
  // Har testga o'z IP si: chelaklar modul darajasida umumiy
  let n = 0;
  const call = (dto: VisitDto | undefined, ua = 'Mozilla/5.0 (iPhone) Safari') =>
    c.visit(`10.9.${Math.floor(++n / 250)}.${n % 250}`, { headers: { 'user-agent': ua }, cookies: userId ? { ys_access: 't' } : {} } as never, dto as never);
  return { call, impressions, activity };
}
const bad = async (o: object) => (await validate(plainToInstance(VisitDto, o))).length > 0;

describe('events/visit', () => {
  it("tanasiz (eski mijoz): sanoq bor, xabar yo'q", async () => {
    const { call, impressions, activity } = setup();
    expect(await call(undefined)).toEqual({ ok: true });
    expect(impressions.recordVisit).toHaveBeenCalledTimes(1);
    expect(activity.visit).not.toHaveBeenCalled();
  });

  it("first=false: sanoq yo'q, xabar bor", async () => {
    const { call, impressions, activity } = setup();
    await call({ path: '/x', first: false });
    expect(impressions.recordVisit).not.toHaveBeenCalled();
    expect(activity.visit).toHaveBeenCalledWith(expect.objectContaining({ path: '/x', userId: null, ua: 'Mozilla/5.0 (iPhone) Safari' }));
  });

  it("first=true va yo'l: ikkalasi ham", async () => {
    const { call, impressions, activity } = setup();
    await call({ path: '/terminals', referrer: 'https://google.com/search?q=secret#h', first: true });
    expect(impressions.recordVisit).toHaveBeenCalledTimes(1);
    expect(activity.visit).toHaveBeenCalledWith(expect.objectContaining({ referrer: 'google.com/search' }));
  });

  it('kirgan odam: userId uzatiladi', async () => {
    const { call, activity } = setup('u1');
    await call({ path: '/x', first: false });
    expect(activity.visit).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }));
  });

  it("xabar xizmati yiqilsa ham so'rov yiqilmaydi", async () => {
    const { call, activity } = setup();
    activity.visit.mockImplementation(() => { throw new Error('boom'); });
    await expect(call({ path: '/x' })).resolves.toEqual({ ok: true });
  });

  it("yo'l tekshiruvi: //evil, so'rov qatori, # va bo'sh joy rad", async () => {
    for (const path of ['//evil.com', '/x?y=1', '/x#h', '/a b', 'x', '/' + 'a'.repeat(2000)]) expect(await bad({ path })).toBe(true);
    for (const path of ['/', '/terminals/chuqursoy', '/ru/tarif']) expect(await bad({ path })).toBe(false);
  });

  it('first mantiqiy bo\'lishi shart', async () => { expect(await bad({ first: 'no' })).toBe(true); });
});

describe('reduceReferrer', () => {
  it("so'rov qatori va # tashlanadi", () => expect(reduceReferrer('https://google.com/search?q=secret', 'yuksaroy.uz')).toBe('google.com/search'));
  it("ildiz yo'l: faqat host", () => expect(reduceReferrer('https://t.me/', 'yuksaroy.uz')).toBe('t.me'));
  it("o'z sayt: faqat yo'l", () => expect(reduceReferrer('https://yuksaroy.uz/terminals?x=1', 'yuksaroy.uz')).toBe('/terminals'));
  it('yaroqsiz yoki http bo\'lmagan: tashlanadi', () => {
    expect(reduceReferrer('android-app://com.google', 'yuksaroy.uz')).toBeUndefined();
    expect(reduceReferrer('not a url', 'yuksaroy.uz')).toBeUndefined();
    expect(reduceReferrer('', 'yuksaroy.uz')).toBeUndefined();
  });
});
