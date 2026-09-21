import { describe, expect, it } from 'vitest';
import { DRailwayClient, UpstreamError } from './d-railway.client';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const cfg = { url: 'https://dr.example/', email: 'a@b.c', password: 'pw' };

/** Soxta fetch: chaqiruvlar jurnali va tokenga qarab javob. */
function fake(opts: { rejectToken?: string; loginFail?: boolean } = {}) {
  const calls: { url: string; auth?: string; body?: string; signal?: AbortSignal | null }[] = [];
  let logins = 0;
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ url, auth: headers.authorization, body: typeof init?.body === 'string' ? init.body : undefined, signal: init?.signal });
    if (url.endsWith('/auth/login')) {
      logins++;
      if (opts.loginFail) return json(401, { detail: 'bad' });
      return json(200, { access_token: `tok${logins}`, token_type: 'bearer' });
    }
    if (headers.authorization === `Bearer ${opts.rejectToken}`) return json(401, { detail: 'expired' });
    if (url.includes('/wagon-history/none')) return json(200, { wagon_no: 'none', count: 0, modules: [], events: [] });
    if (url.includes('/wagon-history/gone')) return json(404, {});
    if (url.includes('/wagon-history/boom')) return json(500, {});
    return json(200, { wagon_no: '1', count: 1, modules: ['idle'], events: [{ event_date: '2026-09-01', station: 'A' }] });
  }) as typeof fetch;
  return { fetchFn, calls, logins: () => logins };
}

describe('DRailwayClient', () => {
  it("configured faqat uchala qiymat bo'lsa", () => {
    expect(new DRailwayClient(cfg, fake().fetchFn).configured).toBe(true);
    expect(new DRailwayClient({ url: cfg.url }, fake().fetchFn).configured).toBe(false);
  });

  it('bir marta kiradi, token keshlanadi, login form-urlencoded', async () => {
    const f = fake();
    const c = new DRailwayClient(cfg, f.fetchFn);
    expect((await c.history('1'))?.count).toBe(1);
    await c.history('1');
    expect(f.logins()).toBe(1);
    expect(f.calls[0].url).toBe('https://dr.example/api/v1/auth/login');
    expect(f.calls[0].body).toBe('username=a%40b.c&password=pw');
    expect(f.calls[1].auth).toBe('Bearer tok1');
    expect(f.calls[2].auth).toBe('Bearer tok1');
  });

  it('401 da bir marta qayta kiradi va takrorlaydi', async () => {
    const f = fake({ rejectToken: 'tok1' });
    const c = new DRailwayClient(cfg, f.fetchFn);
    expect((await c.history('1'))?.count).toBe(1);
    // login, 401 bilan so'rov, qayta login, muvaffaqiyatli so'rov
    expect(f.calls.map((x) => x.auth ?? 'login')).toEqual(['login', 'Bearer tok1', 'login', 'Bearer tok2']);
    // To'rtala bosqich bitta muddatni bo'lishadi: eng yomoni 10 soniya, 40 emas
    const signals = new Set(f.calls.map((x) => x.signal));
    expect(signals.size).toBe(1);
    expect([...signals][0]).toBeInstanceOf(AbortSignal);
  });

  it("ikkinchi 401 ham rad bo'lsa xato, cheksiz halqa yo'q", async () => {
    const f = fake({ rejectToken: 'tok2' });
    const c = new DRailwayClient(cfg, f.fetchFn);
    await c.history('1'); // tok1 bilan ishlaydi
    (c as unknown as { token: string }).token = 'tok2'; // eskirgan tokenni taqlid qilamiz
    // tok2 rad etiladi -> qayta login tok2 beradi -> yana rad -> xato
    await expect(c.history('1')).rejects.toBeInstanceOf(UpstreamError);
    expect(f.logins()).toBe(2);
  });

  it('topilmadi: 404 yoki bo\'sh events null; 500 va login xatosi UpstreamError', async () => {
    const c = new DRailwayClient(cfg, fake().fetchFn);
    expect(await c.history('none')).toBeNull();
    expect(await c.history('gone')).toBeNull();
    await expect(c.history('boom')).rejects.toBeInstanceOf(UpstreamError);
    await expect(new DRailwayClient(cfg, fake({ loginFail: true }).fetchFn).history('1')).rejects.toBeInstanceOf(UpstreamError);
    await expect(new DRailwayClient({}, fake().fetchFn).history('1')).rejects.toBeInstanceOf(UpstreamError);
  });
});
