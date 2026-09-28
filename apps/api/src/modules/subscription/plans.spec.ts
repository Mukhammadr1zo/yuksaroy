import { describe, expect, it } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { planChecks } from './plans.controller';
import { planLimit, SubscriptionService } from './subscription.service';

/**
 * Admin yaratadigan tarif. Ikki narsa muhim va ikkisi ham pulga tegadi:
 *
 * 1. Forma bazaga faqat tekshirilgan narsani yozadi. Admin o'ylab topgan imkoniyat
 *    nomi yoki bitta tili bo'sh nom o'tib ketmasligi kerak.
 * 2. Buyurtma narxi, ruxsati va chegarasi TARIFDAN olinadi va uning O'Z qatoriga
 *    ko'chiriladi. Aks holda admin narxni keyin o'zgartirsa to'lab qo'ygan odamning
 *    sharti ham o'zgarib ketardi.
 */
const NAME = { uz: 'Vagon', ru: 'Vagon', en: 'Wagon' };
const FEAT = { uz: ['bir'], ru: ['odin'], en: ['one'] };

const plan = (p: Record<string, unknown> = {}) => ({
  id: 'p1', code: 'wagon', name: NAME, features: FEAT, priceMonthSom: 49_000,
  grants: ['WAGON'], limits: null, maxMonths: 12, sort: 0, active: true, ...p,
});

function setup(opts: { plan?: Record<string, unknown> | null } = {}) {
  const created: Record<string, any>[] = [];
  const openWheres: Record<string, unknown>[] = [];
  const tx = {
    subscription: {
      findFirst: async (a: { where: Record<string, unknown> }) => { openWheres.push(a.where); return null; },
      create: async (a: { data: Record<string, unknown> }) => { created.push(a.data); return { ...a.data, amountTiyin: a.data.amountTiyin as bigint }; },
    },
    $queryRaw: async () => [{ nextval: 1n }],
  };
  const prisma = {
    ...tx,
    plan: { findFirst: async () => opts.plan ?? null },
    $transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
  } as never;
  const config = { get: async () => ({ subscriptionMonthSom: 99_000, wagonMonthSom: 99_000, payDetails: '', phoneRevealDaily: 50, wagonSearchFree: 1 }) } as never;
  const svc = new SubscriptionService(prisma, config, { queued: async () => {} } as never, { recipients: async () => [], push: async () => {} } as never);
  return { svc, created, openWheres };
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
    // Bosh obyekt = chegara yoq: umumiy sozlama ishlaydi
    expect(planChecks.checkLimits({})).toBe(null);
  });
});

describe('tarif bilan buyurtma', () => {
  it('narx, ruxsat va chegara tarifdan olinadi', async () => {
    const f = setup({ plan: plan({ priceMonthSom: 30_000, grants: ['WAGON'], limits: { phoneRevealDaily: 200 } }) });
    await f.svc.order('u1', 2, undefined, 'wagon');
    expect(f.created[0]!.amountTiyin).toBe(BigInt(2 * 30_000 * 100));
    expect(f.created[0]!.grants).toEqual(['WAGON']);
    // Chegara qatorga KO'CHIRILADI: tarif keyin o'zgarsa ham shart o'zgarmaydi
    expect(f.created[0]!.limits).toEqual({ phoneRevealDaily: 200 });
    expect(f.created[0]!.planId).toBe('p1');
  });

  it('tarif berilsa grant e`tiborga olinmaydi', async () => {
    const f = setup({ plan: plan({ grants: ['PHONE', 'WAGON'], priceMonthSom: 120_000 }) });
    await f.svc.order('u1', 1, 'WAGON', 'toliq');
    expect(f.created[0]!.grants).toEqual(['PHONE', 'WAGON']);
    expect(f.created[0]!.amountTiyin).toBe(BigInt(120_000 * 100));
  });

  it("sotuvdan olingan yoki noto'g'ri kod jim o'tmaydi", async () => {
    // Jim o'tsa odam arzon tarifni tanlab, hisobida eski umumiy narxni ko'rib qolardi
    const f = setup({ plan: null });
    await expect(f.svc.order('u1', 1, undefined, 'yoq')).rejects.toBeInstanceOf(NotFoundException);
    expect(f.created).toHaveLength(0);
  });

  it('tarifning eng uzun muddatidan oshmaydi', async () => {
    const f = setup({ plan: plan({ maxMonths: 3 }) });
    await expect(f.svc.order('u1', 6, undefined, 'wagon')).rejects.toBeInstanceOf(ConflictException);
    await expect(f.svc.order('u1', 3, undefined, 'wagon')).resolves.toBeTruthy();
  });

  it('ochiq buyurtma tarif bo`yicha ajratiladi', async () => {
    // Bir xil ruxsatli ikki tarifning narxi boshqa bo'lishi mumkin: shartda planId bo'lmasa
    // arzon tarifni so'ragan odamga qimmat tarifning ochiq buyurtmasi qaytarilardi
    const f = setup({ plan: plan() });
    await f.svc.order('u1', 1, undefined, 'wagon');
    expect(f.openWheres[0]).toMatchObject({ planId: 'p1' });
    const g = setup();
    await g.svc.order('u1', 1);
    expect(g.openWheres[0]).toMatchObject({ planId: null });
  });

  it('tarifsiz buyurtma bugungidek ishlaydi', async () => {
    const f = setup();
    await f.svc.order('u1', 1);
    expect(f.created[0]!.grants).toEqual(['PHONE', 'WAGON']);
    expect(f.created[0]!.amountTiyin).toBe(BigInt(99_000 * 100));
    expect(f.created[0]!.planId).toBe(null);
    expect(f.created[0]!.limits).toBe(undefined);
  });
});

describe('kunlik chegara', () => {
  it('tarifda son bo`lsa o`sha, bo`lmasa umumiy sozlama', () => {
    expect(planLimit({ phoneRevealDaily: 200 }, 'phoneRevealDaily', 50)).toBe(200);
    expect(planLimit(null, 'phoneRevealDaily', 50)).toBe(50);
    expect(planLimit(undefined, 'phoneRevealDaily', 50)).toBe(50);
    // Buzuq qiymat sozlamani buzmaydi: 0 va matn chegarani ochib yubormasin
    expect(planLimit({ phoneRevealDaily: 0 }, 'phoneRevealDaily', 50)).toBe(50);
    expect(planLimit({ phoneRevealDaily: 'cheksiz' }, 'phoneRevealDaily', 50)).toBe(50);
  });
});
