import { describe, expect, it } from 'vitest';
import { AdsPublicController } from './ads.controller';

/**
 * Reklamaning ikki qoidasi shu yerda qulflangan.
 *
 * Birinchisi: OBUNACHIGA REKLAMA KO'RSATILMAYDI. Odam pul to'lab reklama ko'rsa
 * obunaning ma'nosi pasayadi. Bu qoida serverda, chunki ekranda yashirish reklamani
 * baribir javobga qo'shib yuborardi.
 *
 * Ikkinchisi: bitta joyda bitta reklama. Bir vaqtda bir nechta faol bo'lsa eng keyin
 * boshlangani olinadi, ya'ni yangi shartnoma eskisining ustiga chiqadi.
 */
type Ad = { id: string; title: string; body: string | null; imageUrl: string | null; href: string; buyer: string | null; pricePaidSom: number };

function setup(opts: { ad?: Ad | null; subscriber?: boolean; userId?: string | null } = {}) {
  const calls: { where: Record<string, unknown> }[] = [];
  const prisma = {
    adPlacement: {
      findFirst: async (a: { where: Record<string, unknown> }) => { calls.push(a); return opts.ad ?? null; },
    },
  } as never;
  // optionalUserId shu xizmatga boradi: token bor va u tekshiruvdan o'tsa userId chiqadi
  const tokens = { verifyAccess: () => ({ sub: opts.userId ?? 'u1' }) } as never;
  const subs = { isActive: async () => opts.subscriber ?? false } as never;
  const c = new AdsPublicController(prisma, tokens, subs);
  const req = { headers: opts.userId === null ? {} : { authorization: 'Bearer x' }, cookies: {} } as never;
  return { c, req, calls };
}

const AD: Ad = { id: 'a1', title: "Yuk sug'urtasi", body: 'Bir kunda', imageUrl: null, href: 'https://misol.uz', buyer: 'Misol MChJ', pricePaidSom: 500_000 };

describe('yon tomondagi reklama', () => {
  it('tanilmagan joy uchun hech narsa qaytmaydi', async () => {
    const f = setup({ ad: AD });
    expect(await f.c.one(f.req, 'yoq-joy')).toEqual({ ad: null });
    // Baza so'rovi umuman ketmaydi: noto'g'ri parametr bilan ish boshlanmaydi
    expect(f.calls).toHaveLength(0);
  });

  it('joy uchun faol reklama qaytadi', async () => {
    const f = setup({ ad: AD });
    const r = await f.c.one(f.req, 'terminal-aside');
    expect(r.ad?.id).toBe('a1');
    const w = f.calls[0]!.where;
    expect(w.placement).toBe('terminal-aside');
    expect(w.status).toBe('ACTIVE');
    // Sana oralig'i shartda: muddati o'tgan reklama chiqmaydi
    expect(w.startsAt).toBeDefined();
    expect(w.endsAt).toBeDefined();
  });

  it("sotuv ma'lumoti ommaviy javobda yo'q", async () => {
    const f = setup({ ad: AD });
    const r = await f.c.one(f.req, 'terminal-aside');
    expect(r.ad).not.toHaveProperty('buyer');
    expect(r.ad).not.toHaveProperty('pricePaidSom');
  });

  it("reklama yo'q bo'lsa null", async () => {
    const f = setup({ ad: null });
    expect(await f.c.one(f.req, 'listing-aside')).toEqual({ ad: null });
  });

  it("obunachiga reklama ko'rsatilmaydi", async () => {
    const f = setup({ ad: AD, subscriber: true });
    expect(await f.c.one(f.req, 'terminal-aside')).toEqual({ ad: null });
    // Baza so'rovi ham ketmaydi: obunachi ekani aniqlangach ish tugaydi
    expect(f.calls).toHaveLength(0);
  });

  it("obunasi tugagan foydalanuvchi reklamani ko'radi", async () => {
    const f = setup({ ad: AD, subscriber: false });
    expect((await f.c.one(f.req, 'terminal-aside')).ad?.id).toBe('a1');
  });

  it("mehmon reklamani ko'radi", async () => {
    const f = setup({ ad: AD, userId: null });
    expect((await f.c.one(f.req, 'terminal-aside')).ad?.id).toBe('a1');
  });
});
