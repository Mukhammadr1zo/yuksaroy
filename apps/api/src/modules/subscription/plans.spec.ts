import { describe, expect, it } from 'vitest';
import { BadRequestException, ConflictException, type HttpException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SUBSCRIPTION_FALLBACK } from '@yuksaroy/domain';
import { planChecks, PlansAdminController } from './plans.controller';
import { planLimit, SubscriptionService } from './subscription.service';

/**
 * Tarif obuna narxining YAGONA manbai. Uch narsa muhim va uchalasi ham pulga tegadi:
 *
 * 1. Forma bazaga faqat tekshirilgan narsani yozadi. Admin o'ylab topgan imkoniyat
 *    nomi yoki bitta tili bo'sh nom o'tib ketmasligi kerak.
 * 2. Buyurtma HAR DOIM biror tarifdan: narx, ruxsat va chegara tarifdan olinadi va
 *    uning O'Z qatoriga ko'chiriladi. Aks holda admin narxni keyin o'zgartirsa to'lab
 *    qo'ygan odamning sharti ham o'zgarib ketardi.
 * 3. Oxirgi faol tarif sotuvdan olinmaydi: tarifsiz obuna sotib bo'lmay qoladi.
 */
const NAME = { uz: 'Vagon', ru: 'Vagon', en: 'Wagon' };
const FEAT = { uz: ['bir'], ru: ['odin'], en: ['one'] };

type Row = Record<string, unknown> & { id: string; code: string; priceMonthSom: number; grants: string[]; sort: number; active: boolean };
const plan = (p: Partial<Row> = {}): Row => ({
  id: 'p1', code: 'wagon', name: NAME, features: FEAT, priceMonthSom: 49_000,
  grants: ['WAGON'], limits: null, maxMonths: 12, sort: 0, active: true, ...p,
});
const FULL = plan({ id: 'p0', code: 'obuna', grants: ['PHONE', 'WAGON'], priceMonthSom: 99_000, limits: { phoneRevealDaily: 50 } });

/** Tashlangan xatoning kodi: tana HttpException ning xususiy maydonida turadi. */
async function code(fn: () => Promise<unknown>) {
  try { await fn(); } catch (e) { return ((e as HttpException).getResponse() as { code: string }).code; }
  throw new Error('xato kutilgan edi');
}

function setup(opts: { plans?: Row[] } = {}) {
  const created: Record<string, any>[] = [];
  const openWheres: Record<string, unknown>[] = [];
  let reads = 0;
  const tx = {
    subscription: {
      findFirst: async (a: { where: Record<string, unknown> }) => { openWheres.push(a.where); return null; },
      create: async (a: { data: Record<string, unknown> }) => { created.push(a.data); return { ...a.data, amountTiyin: a.data.amountTiyin as bigint }; },
    },
    $queryRaw: async () => [{ nextval: 1n }],
  };
  const prisma = {
    ...tx,
    // Sotuvdagi ro'yxat allaqachon tartib, keyin kod bo'yicha kelgan deb olinadi (bazadagi orderBy)
    plan: { findMany: async () => { reads++; return opts.plans ?? []; } },
    $transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
  } as never;
  const config = { get: async () => ({ payDetails: '', wagonSearchFree: 1 }) } as never;
  const svc = new SubscriptionService(prisma, config, { queued: async () => {} } as never, { recipients: async () => [], push: async () => {} } as never);
  return { svc, created, openWheres, reads: () => reads };
}

/** Admin kontrolleri uchun soxta baza: sanoq va topish haqiqatan qatorlarga qaraydi. */
function admin(rows: Row[], opts: { race?: boolean } = {}) {
  const writes: string[] = [];
  let invalidated = 0;
  const prisma: Record<string, any> = {
    plan: {
      findUnique: async ({ where }: { where: { id: string } }) => rows.find((r) => r.id === where.id) ?? null,
      count: async ({ where }: { where: { active: boolean; id: { not: string }; grants?: { has: string } } }) =>
        rows.filter((r) => r.active === where.active && r.id !== where.id.not && (!where.grants || r.grants.includes(where.grants.has))).length,
      create: async ({ data }: { data: Record<string, unknown> }) => { writes.push('create'); return { id: 'new', ...data }; },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => { writes.push('update'); return { ...rows.find((r) => r.id === where.id), ...data }; },
      delete: async () => { writes.push('delete'); },
    },
  };
  // Poyga: Serializable tranzaksiya yiqilganda Prisma P2034 tashlaydi
  prisma.$transaction = async (fn: (t: unknown) => Promise<unknown>) => {
    if (opts.race) throw new Prisma.PrismaClientKnownRequestError('poyga', { code: 'P2034', clientVersion: 'test' });
    return fn(prisma);
  };
  const subs = { invalidatePlans: () => { invalidated++; } } as never;
  const c = new PlansAdminController(prisma as never, { log: async () => {} } as never, subs);
  return { c, writes, invalidated: () => invalidated };
}

describe('tarif formasini tekshirish', () => {
  it('uch tilning hammasi shart', () => {
    expect(() => planChecks.checkName({ uz: 'Vagon', ru: 'Vagon' })).toThrow(BadRequestException);
    expect(planChecks.checkName({ uz: ' Vagon ', ru: 'Vagon', en: 'Wagon' })).toEqual(NAME);
  });

  it("tavsif bo'sh qator bilan o'tmaydi", () => {
    expect(() => planChecks.checkFeatures({ uz: [], ru: ['a'], en: ['a'] })).toThrow(BadRequestException);
    expect(() => planChecks.checkFeatures({ uz: ['  '], ru: ['a'], en: ['a'] })).toThrow(BadRequestException);
    expect(planChecks.checkFeatures(FEAT)).toEqual(FEAT);
  });

  it("admin yangi imkoniyat o'ylab topa olmaydi", () => {
    // Oq ro'yxatsiz "BEPUL_HAMMASI" degan ruxsat bazaga tushib, hech qayerda
    // o'qilmay, odam esa to'lab turgan bo'lardi
    expect(() => planChecks.checkGrants(['PHONE', 'HAMMASI'])).toThrow(BadRequestException);
    expect(() => planChecks.checkGrants([])).toThrow(BadRequestException);
    expect(planChecks.checkGrants(['WAGON', 'WAGON'])).toEqual(['WAGON']);
  });

  it('chegara kaliti ham oq royxatdan, qiymati butun son', () => {
    expect(() => planChecks.checkLimits({ wagonKuniga: 5 })).toThrow(BadRequestException);
    expect(() => planChecks.checkLimits({ phoneRevealDaily: 1.5 })).toThrow(BadRequestException);
    expect(() => planChecks.checkLimits({ phoneRevealDaily: -1 })).toThrow(BadRequestException);
    expect(planChecks.checkLimits({ phoneRevealDaily: 200 })).toEqual({ phoneRevealDaily: 200 });
    expect(planChecks.checkLimits({})).toBe(null);
  });
});

describe('admin tarif qorovullari', () => {
  const body = { code: 'tel', name: NAME, features: FEAT, priceMonthSom: 10_000 };

  it('telefon ruxsatli tarif kunlik sonsiz yaratilmaydi', async () => {
    // Son endi sozlamada yo'q: tarifda ham bo'lmasa devor nechta raqam ochilishini ayta olmasdi
    const a = admin([]);
    expect(await code(() => a.c.create('adm', { ...body, grants: ['PHONE'] }))).toBe('PLAN_PHONE_LIMIT');
    expect(await code(() => a.c.create('adm', { ...body, grants: ['PHONE'], limits: { phoneRevealDaily: 0 } }))).toBe('PLAN_PHONE_LIMIT');
    await expect(a.c.create('adm', { ...body, grants: ['PHONE'], limits: { phoneRevealDaily: 30 } })).resolves.toBeTruthy();
    // Faqat vagon tarifiga son kerak emas
    await expect(a.c.create('adm', { ...body, grants: ['WAGON'] })).resolves.toBeTruthy();
  });

  it("yangilashda qoida yangilangan qatorga qaraydi", async () => {
    const a = admin([plan({ id: 'w', grants: ['WAGON'], limits: null }), plan({ id: 't', grants: ['PHONE'], limits: { phoneRevealDaily: 30 } })]);
    // Vagon tarifiga telefon qo'shilsa son ham kerak
    expect(await code(() => a.c.update('adm', 'w', { grants: ['PHONE', 'WAGON'] }))).toBe('PLAN_PHONE_LIMIT');
    // Telefon tarifidan son olib tashlansa ham
    expect(await code(() => a.c.update('adm', 't', { limits: {} }))).toBe('PLAN_PHONE_LIMIT');
    await expect(a.c.update('adm', 't', { priceMonthSom: 20_000 })).resolves.toBeTruthy();
  });

  it("oxirgi faol tarif o'chirilmaydi va sotuvdan olinmaydi", async () => {
    const one = admin([plan({ id: 'p1' })]);
    expect(await code(() => one.c.remove('adm', 'p1'))).toBe('LAST_PLAN');
    expect(await code(() => one.c.update('adm', 'p1', { active: false }))).toBe('LAST_PLAN');
    expect(one.writes).toEqual([]);
    // Narxni o'zgartirish sotuvdan olish emas
    await expect(one.c.update('adm', 'p1', { priceMonthSom: 1 })).resolves.toBeTruthy();
  });

  it("boshqa faol tarif bo'lsa o'chirish mumkin; o'chiq tarif hech qachon oxirgi emas", async () => {
    const two = admin([plan({ id: 'p1' }), plan({ id: 'p2', code: 'b' })]);
    await expect(two.c.remove('adm', 'p1')).resolves.toEqual({ id: 'p1', deleted: true });
    const off = admin([plan({ id: 'p1' }), plan({ id: 'p2', code: 'b', active: false })]);
    await expect(off.c.remove('adm', 'p2')).resolves.toBeTruthy();
    await expect(off.c.update('adm', 'p2', { active: false })).resolves.toBeTruthy();
  });

  it("qorovul ruxsat bo'yicha: telefonni ochadigan oxirgi tarif vagon tarifi qolsa ham ketmaydi", async () => {
    // Aks holda telefon raqami o'rnidagi taklifga urilgan odam kartada faqat vagon
    // tarifini ko'rar, sotib olar va raqam baribir ochilmas edi
    const a = admin([FULL, plan({ id: 'w' })]);
    expect(await code(() => a.c.remove('adm', 'p0'))).toBe('LAST_PLAN');
    expect(await code(() => a.c.update('adm', 'p0', { active: false }))).toBe('LAST_PLAN');
    // Telefon ruxsatini olib tashlash ham sotuvdan olish
    expect(await code(() => a.c.update('adm', 'p0', { grants: ['WAGON'] }))).toBe('LAST_PLAN');
    expect(a.writes).toEqual([]);
    // Vagon tarifi ketishi mumkin: vagonni obuna ham beradi
    await expect(a.c.remove('adm', 'w')).resolves.toBeTruthy();
    // Poygada yiqilgan ikkinchi admin ham LAST_PLAN oladi, 500 emas
    const r = admin([plan({ id: 'p1' }), plan({ id: 'p2', code: 'b' })], { race: true });
    expect(await code(() => r.c.remove('adm', 'p1'))).toBe('LAST_PLAN');
    // Narx o'zgarishi tranzaksiyasiz o'tadi
    await expect(r.c.update('adm', 'p1', { priceMonthSom: 5 })).resolves.toBeTruthy();
  });

  it('har yozuvdan keyin kesh tozalanadi', async () => {
    // Tozalanmasa admin narxni o'zgartirib, bir daqiqa eski narxda buyurtma olardi
    const a = admin([plan({ id: 'p1' }), plan({ id: 'p2', code: 'b' })]);
    await a.c.create('adm', { ...body, grants: ['WAGON'] });
    await a.c.update('adm', 'p1', { sort: 3 });
    await a.c.remove('adm', 'p2');
    expect(a.invalidated()).toBe(3);
  });
});

describe('sukut tarif va ruxsat bo`yicha tanlov', () => {
  it('ikkala ruxsatli tarif afzal: tartib, keyin narx', async () => {
    // Faqat vagon tarifi eng arzon va birinchi tursa ham sukut u emas: obuna sotib olgan
    // odamga telefon ochilmay qolardi
    const f = setup({ plans: [
      plan({ id: 'w', code: 'wagon', priceMonthSom: 10_000, sort: 0 }),
      plan({ id: 'a', code: 'a', grants: ['PHONE', 'WAGON'], priceMonthSom: 200_000, sort: 0 }),
      plan({ id: 'b', code: 'b', grants: ['PHONE', 'WAGON'], priceMonthSom: 100_000, sort: 1 }),
      plan({ id: 'c', code: 'c', grants: ['PHONE', 'WAGON'], priceMonthSom: 150_000, sort: 0 }),
    ] });
    // Tartib 0 dagi ikkitadan arzoni
    expect((await f.svc.defaultPlan())?.id).toBe('c');
  });

  it("to'liq tarif yo'q bo'lsa ro'yxatdagi birinchi faol tarif", async () => {
    const f = setup({ plans: [plan({ id: 'w' }), plan({ id: 't', code: 'tel', grants: ['PHONE'] })] });
    expect((await f.svc.defaultPlan())?.id).toBe('w');
  });

  it('ruxsat berilsa aynan shu ruxsatli tarif afzal, arzon to`liq tarif emas', async () => {
    const f = setup({ plans: [plan({ id: 'full', code: 'obuna', grants: ['PHONE', 'WAGON'], priceMonthSom: 30_000 }), plan({ id: 'w', priceMonthSom: 49_000 })] });
    await f.svc.order('u1', 1, 'WAGON');
    expect(f.created[0]!.grants).toEqual(['WAGON']);
    expect(f.created[0]!.amountTiyin).toBe(BigInt(49_000 * 100));
    // Aynan shu ruxsatli tarif bo'lmasa ruxsatni beradigan har qanday tarif
    const g = setup({ plans: [plan({ id: 'full', code: 'obuna', grants: ['PHONE', 'WAGON'], priceMonthSom: 30_000 })] });
    await g.svc.order('u1', 1, 'WAGON');
    expect(g.created[0]!.planId).toBe('full');
  });

  it("sotuvda tarif yo'q: buyurtma ochilmaydi", async () => {
    const f = setup();
    expect(await code(() => f.svc.order('u1', 1))).toBe('NO_PLAN');
    expect(await code(() => f.svc.order('u1', 1, 'WAGON'))).toBe('NO_PLAN');
    expect(f.created).toHaveLength(0);
  });

  it('narx devori: ruxsatni beradigan eng arzon tarif, tarif bo`lmasa zaxira son', async () => {
    const f = setup({ plans: [FULL, plan({ id: 'w', priceMonthSom: 49_000 })] });
    expect(await f.svc.priceFor('WAGON')).toBe(49_000);
    expect(await f.svc.priceFor('PHONE')).toBe(99_000);
    expect(await setup().svc.priceFor('PHONE')).toBe(SUBSCRIPTION_FALLBACK.priceMonthSom);
  });

  it('kunlik son zanjiri: obuna qatori, sukut tarif, zaxira', async () => {
    const f = setup({ plans: [FULL] });
    expect(await f.svc.dailyLimitFor({ phoneRevealDaily: 200 })).toBe(200);
    expect(await f.svc.dailyLimitFor(null)).toBe(50);
    expect(await setup().svc.dailyLimitFor(null)).toBe(SUBSCRIPTION_FALLBACK.phoneRevealDaily);
  });

  it('kesh: bir daqiqada bitta o`qish, tozalangach qayta', async () => {
    const f = setup({ plans: [FULL] });
    await f.svc.activePlans();
    await f.svc.defaultPlan();
    expect(f.reads()).toBe(1);
    f.svc.invalidatePlans();
    await f.svc.activePlans();
    expect(f.reads()).toBe(2);
  });
});

describe('tarif bilan buyurtma', () => {
  it('narx, ruxsat va chegara tarifdan olinadi', async () => {
    const f = setup({ plans: [FULL, plan({ priceMonthSom: 30_000, grants: ['WAGON'], limits: { phoneRevealDaily: 200 } })] });
    await f.svc.order('u1', 2, undefined, 'wagon');
    expect(f.created[0]!.amountTiyin).toBe(BigInt(2 * 30_000 * 100));
    expect(f.created[0]!.grants).toEqual(['WAGON']);
    // Chegara qatorga KO'CHIRILADI: tarif keyin o'zgarsa ham shart o'zgarmaydi
    expect(f.created[0]!.limits).toEqual({ phoneRevealDaily: 200 });
    expect(f.created[0]!.planId).toBe('p1');
  });

  it('tarif berilsa grant e`tiborga olinmaydi', async () => {
    const f = setup({ plans: [plan({ code: 'toliq', grants: ['PHONE', 'WAGON'], priceMonthSom: 120_000 }), plan({ id: 'w', code: 'wagon' })] });
    await f.svc.order('u1', 1, 'WAGON', 'toliq');
    expect(f.created[0]!.grants).toEqual(['PHONE', 'WAGON']);
    expect(f.created[0]!.amountTiyin).toBe(BigInt(120_000 * 100));
  });

  it("sotuvdan olingan yoki noto'g'ri kod jim o'tmaydi", async () => {
    // Jim o'tsa odam arzon tarifni tanlab, hisobida boshqa narxni ko'rib qolardi
    const f = setup({ plans: [FULL] });
    await expect(f.svc.order('u1', 1, undefined, 'yoq')).rejects.toBeInstanceOf(NotFoundException);
    expect(f.created).toHaveLength(0);
  });

  it('tarifning eng uzun muddatidan oshmaydi', async () => {
    const f = setup({ plans: [plan({ maxMonths: 3 })] });
    await expect(f.svc.order('u1', 6, undefined, 'wagon')).rejects.toBeInstanceOf(ConflictException);
    expect(await code(() => f.svc.order('u1', 6))).toBe('PLAN_MAX_MONTHS');
    await expect(f.svc.order('u1', 3, undefined, 'wagon')).resolves.toBeTruthy();
  });

  it('ochiq buyurtma tarif bo`yicha ajratiladi', async () => {
    // Bir xil ruxsatli ikki tarifning narxi boshqa bo'lishi mumkin: shartda planId bo'lmasa
    // arzon tarifni so'ragan odamga qimmat tarifning ochiq buyurtmasi qaytarilardi
    const f = setup({ plans: [FULL, plan()] });
    await f.svc.order('u1', 1, undefined, 'wagon');
    expect(f.openWheres[0]).toMatchObject({ planId: 'p1' });
    const g = setup({ plans: [FULL, plan()] });
    await g.svc.order('u1', 1);
    expect(g.openWheres[0]).toMatchObject({ planId: 'p0' });
  });

  it("tur berilmasa sukut tarif: ikkala ruxsat, chegarasi bilan", async () => {
    const f = setup({ plans: [FULL, plan()] });
    await f.svc.order('u1', 1);
    expect(f.created[0]!.grants).toEqual(['PHONE', 'WAGON']);
    expect(f.created[0]!.amountTiyin).toBe(BigInt(99_000 * 100));
    expect(f.created[0]!.planId).toBe('p0');
    expect(f.created[0]!.limits).toEqual({ phoneRevealDaily: 50 });
  });
});

describe('kunlik chegara', () => {
  it('tarifda son bo`lsa o`sha, bo`lmasa berilgan zaxira', () => {
    expect(planLimit({ phoneRevealDaily: 200 }, 'phoneRevealDaily', 50)).toBe(200);
    expect(planLimit(null, 'phoneRevealDaily', 50)).toBe(50);
    expect(planLimit(undefined, 'phoneRevealDaily', 50)).toBe(50);
    // Buzuq qiymat zaxirani buzmaydi: 0 va matn chegarani ochib yubormasin
    expect(planLimit({ phoneRevealDaily: 0 }, 'phoneRevealDaily', 50)).toBe(50);
    expect(planLimit({ phoneRevealDaily: 'cheksiz' }, 'phoneRevealDaily', 50)).toBe(50);
  });
});
