// So'rov konteksti: IP, qurilma va kanal handlerga await dan keyin ham yetib borishi shart.
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { env } from '../../common/env';
import { contextHook, currentContext } from './request-context';

async function app() {
  const f = Fastify({ trustProxy: true });
  f.addHook('onRequest', contextHook as any);
  f.get('/x', async () => {
    await new Promise((r) => setTimeout(r, 5));
    return currentContext() ?? null;
  });
  return f;
}

describe('so\'rov konteksti', () => {
  it("web: sarlavhasiz so'rov, IP va UA await dan keyin ham o'qiladi", async () => {
    const f = await app();
    const r = await f.inject({ method: 'GET', url: '/x', headers: { 'user-agent': 'Mozilla/5.0 Test', 'x-forwarded-for': '84.54.12.3' } });
    expect(r.json()).toEqual({ ip: '84.54.12.3', ua: 'Mozilla/5.0 Test', channel: 'web' });
  });
  it('Bearer -> miniapp', async () => {
    const f = await app();
    const r = await f.inject({ method: 'GET', url: '/x', headers: { authorization: 'Bearer abc' } });
    expect(r.json().channel).toBe('miniapp');
  });
  it('x-internal-secret -> bot (Bearer dan ustun)', async () => {
    const f = await app();
    const r = await f.inject({ method: 'GET', url: '/x', headers: { 'x-internal-secret': env.INTERNAL_SECRET, authorization: 'Bearer abc' } });
    expect(r.json().channel).toBe('bot');
  });
  it("ikki so'rov bir-biriga aralashmaydi", async () => {
    const f = await app();
    const [a, b] = await Promise.all([
      f.inject({ method: 'GET', url: '/x', headers: { 'user-agent': 'A' } }),
      f.inject({ method: 'GET', url: '/x', headers: { 'user-agent': 'B' } }),
    ]);
    expect([a.json().ua, b.json().ua]).toEqual(['A', 'B']);
  });
});

describe("x-internal-secret tekshiruvi", () => {
  it("noto'g'ri sir -> web, IP saqlanadi", async () => {
    const f = await app();
    const r = await f.inject({ method: 'GET', url: '/x', headers: { 'x-internal-secret': 'x', 'x-forwarded-for': '84.54.12.3' } });
    expect(r.json()).toMatchObject({ channel: 'web', ip: '84.54.12.3' });
  });
});
