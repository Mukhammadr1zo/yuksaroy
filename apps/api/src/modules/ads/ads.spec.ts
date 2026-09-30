import { describe, expect, it } from 'vitest';
import { AdsAdminController, AdsPublicController } from './ads.controller';

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
type Ad = {
  id: string; placement: string; title: string; body: string | null; imageUrl: string | null; href: string;
  buyer: string | null; pricePaidSom: number; delaySec: number; showSec: number; quietHours: number; locale: string | null;
};

function setup(opts: { ad?: Ad | null; rows?: Ad[]; subscriber?: boolean; userId?: string | null } = {}) {
  const calls: { where: Record<string, unknown> }[] = [];
  const prisma = {
    adPlacement: {
      findFirst: async (a: { where: Record<string, unknown> }) => { calls.push(a); return opts.ad ?? null; },
      findMany: async (a: { where: Record<string, unknown> }) => { calls.push(a); return opts.rows ?? []; },
    },
  } as never;
  // optionalUserId shu xizmatga boradi: token bor va u tekshiruvdan o'tsa userId chiqadi
  const tokens = { verifyAccess: () => ({ sub: opts.userId ?? 'u1' }) } as never;
  const subs = { isActive: async () => opts.subscriber ?? false } as never;
  const c = new AdsPublicController(prisma, tokens, subs);
  const req = { headers: opts.userId === null ? {} : { authorization: 'Bearer x' }, cookies: {} } as never;
  return { c, req, calls };
}

const AD: Ad = {
  id: 'a1', placement: 'terminal-aside', title: "Yuk sug'urtasi", body: 'Bir kunda', imageUrl: null,
  href: 'https://misol.uz', buyer: 'Misol MChJ', pricePaidSom: 500_000,
  delaySec: 8, showSec: 15, quietHours: 12, locale: null,
};
const BOTTOM: Ad = { ...AD, id: 'b1', placement: 'site-bottom', title: 'Ichki nom', body: "Yuk sug'urtasi: bir kunda", imageUrl: '/u/b.jpg' };

/**
 * Panel tomoni: soxta prisma, chunki bu yerda tekshirilayotgani baza emas, pastki banner
 * sharti. Vaqt oralig'i to'g'ri, ya'ni faqat shu shart yiqitadi.
 */
function admin(cur?: Partial<Ad> & { startsAt: Date; endsAt: Date }) {
  const saved: Record<string, unknown>[] = [];
  const prisma = {
    adPlacement: {
      create: async (a: { data: Record<string, unknown> }) => { saved.push(a.data); return { id: 'n1', ...a.data }; },
      findUnique: async () => cur ?? null,
      update: async (a: { data: Record<string, unknown> }) => { saved.push(a.data); return { id: 'a1', ...a.data }; },
    },
  } as never;
  const audit = { log: async () => {} } as never;
  const c = new AdsAdminController(prisma, audit, {} as never);
  return { c, saved };
}
const RANGE = { startsAt: '2026-10-01T00:00:00.000Z', endsAt: '2026-11-01T00:00:00.000Z' };
const NEW_BOTTOM = { placement: 'site-bottom', title: 'Ichki nom', href: 'https://misol.uz', status: 'ACTIVE', ...RANGE };

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

  it("til filtri yon blokda ham ishlaydi", async () => {
    // Nega kerak: banner yozuvi rasm ichida. Filtrsiz ruscha banner o'zbekcha terminal
    // sahifasida chiqardi va uch til uchun uch qator sotilsa ham faqat bittasi ko'rinardi.
    const f = setup({ ad: AD });
    await f.c.one(f.req, 'terminal-aside', 'ru');
    expect(f.calls[0]!.where.OR).toEqual([{ locale: null }, { locale: 'ru' }]);
    // Til berilmasa yoki tanilmasa filtr yo'q: reklama yo'qolib qolmaydi
    const g = setup({ ad: AD });
    await g.c.one(g.req, 'terminal-aside', 'yoq-til');
    expect(g.calls[0]!.where.OR).toBeUndefined();
  });
});

/**
 * Pastki banner. Uning javob shakli yon ustunlardan boshqa: sarlavha yo'q (ekranda faqat
 * rasm chiziladi), lekin uchta vaqt bor. Yon ustunlarning shakli o'zgarmagani ham shu
 * yerda qulflangan: u joylar allaqachon sotilgan.
 */
describe('pastki banner', () => {
  it("javobda sarlavha yo'q, uchta vaqt bor", async () => {
    const f = setup({ rows: [BOTTOM] });
    const b = (await f.c.rails(f.req)).bottom!;
    expect(b).not.toHaveProperty('title');
    expect(b).toMatchObject({ id: 'b1', delaySec: 8, showSec: 15, quietHours: 12 });
    // Tavsif qoladi: u ekranga chizilmaydi, havolaning ekran o'quvchi uchun nomi bo'ladi
    expect(b.body).toBe("Yuk sug'urtasi: bir kunda");
  });

  it("boshqa joylarning javobida sarlavha o'z joyida", async () => {
    const f = setup({ rows: [{ ...AD, placement: 'site-left' }], ad: AD });
    expect((await f.c.rails(f.req)).left).toHaveProperty('title', "Yuk sug'urtasi");
    expect((await f.c.one(f.req, 'terminal-aside')).ad).toHaveProperty('title', "Yuk sug'urtasi");
  });

  it("uchta joy bitta so'rovda olinadi", async () => {
    const f = setup({ rows: [{ ...AD, placement: 'site-left' }, { ...AD, id: 'r1', placement: 'site-right' }, BOTTOM] });
    const r = await f.c.rails(f.req);
    expect([r.left?.id, r.right?.id, r.bottom?.id]).toEqual(['a1', 'r1', 'b1']);
    expect(f.calls).toHaveLength(1);
  });

  it("obunachiga pastki banner ham chiqmaydi", async () => {
    const f = setup({ rows: [BOTTOM], subscriber: true });
    expect(await f.c.rails(f.req)).toEqual({ left: null, right: null, bottom: null });
  });

  it("rasm yoki tavsif bo'lmasa yaratilmaydi", async () => {
    await expect(admin().c.create('u1', { ...NEW_BOTTOM, body: 'Matn' } as never)).rejects.toThrow();
    await expect(admin().c.create('u1', { ...NEW_BOTTOM, imageUrl: '/u/b.jpg' } as never)).rejects.toThrow();
    const f = admin();
    await f.c.create('u1', { ...NEW_BOTTOM, body: 'Matn', imageUrl: '/u/b.jpg' } as never);
    expect(f.saved[0]).toMatchObject({ placement: 'site-bottom' });
  });

  it("faqat bitta maydon o'zgarganda bazadagi qiymat bilan tekshiriladi", async () => {
    // Bazada rasm ham tavsif ham bor: so'rovda faqat delaySec kelgani uchun yiqilmasligi kerak
    const f = admin({ ...BOTTOM, startsAt: new Date(RANGE.startsAt), endsAt: new Date(RANGE.endsAt) });
    await f.c.update('u1', 'b1', { delaySec: 10 } as never);
    expect(f.saved[0]).toMatchObject({ delaySec: 10 });
    // Bazadagi rasm o'chirilsa esa yiqiladi
    const g = admin({ ...BOTTOM, imageUrl: null, startsAt: new Date(RANGE.startsAt), endsAt: new Date(RANGE.endsAt) });
    await expect(g.c.update('u1', 'b1', { delaySec: 10 } as never)).rejects.toThrow();
  });

  it("til filtri: bo'sh tilli qator hamma tilda, 'ru' li qator faqat ru da", async () => {
    const f = setup({ rows: [BOTTOM] });
    await f.c.rails(f.req, 'ru');
    // Bo'sh locale YOKI aynan shu til: ikkinchi so'rov ochilmaydi, shart bitta where da
    expect(f.calls[0]!.where.OR).toEqual([{ locale: null }, { locale: 'ru' }]);
    const g = setup({ rows: [BOTTOM] });
    await g.c.rails(g.req, 'yoq-til');
    // Tanilmagan til = filtr yo'q: banner yo'qolib qolmaydi
    expect(g.calls[0]!.where.OR).toBeUndefined();
  });
});
