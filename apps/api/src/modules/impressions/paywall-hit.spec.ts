// Ko'rsatkichlar qulfi (obunachiga) va devor sanog'i (odam + kun + devor, bazada). Soxta Prisma, baza yo'q.
import { describe, expect, it } from 'vitest';
import type { HttpException } from '@nestjs/common';
import type { PrismaService } from '../../common/prisma.service';
import type { ListingsUseCase } from '../listings/application/listings.usecase';
import type { OrderAccess } from '../orders/application/order-access';
import type { SubscriptionService } from '../subscription/subscription.service';
import { ImpressionsController } from './impressions.controller';
import { ImpressionsService } from './impressions.service';

/** Soxta PaywallHit: noyob kalit (userId, kind, day) bazadagidek ishlaydi, ya'ni skipDuplicates takrorni tashlaydi. */
function fakeHits() {
  const rows = new Map<string, { userId: string; kind: string; day: Date }>();
  const prisma = {
    paywallHit: {
      createMany: async ({ data, skipDuplicates }: { data: { userId: string; kind: string; day: Date }[]; skipDuplicates?: boolean }) => {
        for (const d of data) {
          const k = `${d.userId}|${d.kind}|${d.day.toISOString()}`;
          if (rows.has(k) && !skipDuplicates) throw new Error('unique');
          rows.set(k, d);
        }
      },
    },
  } as unknown as PrismaService;
  return { rows, svc: new ImpressionsService(prisma) };
}

describe("devor sanog'i: odam + kun + devor", () => {
  it('bir odam bir kunda bir devorga besh marta urilsa bitta qator', async () => {
    const { rows, svc } = fakeHits();
    const at = new Date('2026-11-02T08:00:00Z');
    for (let i = 0; i < 5; i++) await svc.paywallHit('u1', 'phone', new Date(at.getTime() + i * 60_000));
    expect(rows.size).toBe(1);
  });

  it('devorlar alohida, odamlar alohida', async () => {
    const { rows, svc } = fakeHits();
    const at = new Date('2026-11-02T08:00:00Z');
    await svc.paywallHit('u1', 'phone', at);
    await svc.paywallHit('u1', 'wagon', at);
    await svc.paywallHit('u1', 'metrics', at);
    await svc.paywallHit('u2', 'phone', at);
    expect(rows.size).toBe(4);
  });

  it("ertasi kuni yangi qator, kun Toshkent bo'yicha kesiladi", async () => {
    const { rows, svc } = fakeHits();
    // 18:59 UTC = 23:59 Toshkent (2-noyabr), 19:01 UTC = 00:01 Toshkent (3-noyabr)
    await svc.paywallHit('u1', 'phone', new Date('2026-11-02T18:59:00Z'));
    await svc.paywallHit('u1', 'phone', new Date('2026-11-02T19:01:00Z'));
    expect([...rows.values()].map((r) => r.day.toISOString().slice(0, 10)).sort()).toEqual(['2026-11-02', '2026-11-03']);
  });
});

/** Ko'rsatkichlar endpointi: egalik o'tadi, obuna bor-yo'qligi hal qiladi. */
function metrics(opts: { subscriber: boolean; owner?: boolean }) {
  const hits: [string, string][] = [];
  const prisma = {
    inquiry: { count: async () => 3 },
    order: { count: async () => 2 },
    impression: { groupBy: async () => [] },
  } as unknown as PrismaService;
  const notOwner = () => Object.assign(new Error('403'), { status: 403 });
  const listings = { owned: async () => { if (opts.owner === false) throw notOwner(); return {}; } } as unknown as ListingsUseCase;
  const access = { assertTerminalOf: async () => { if (opts.owner === false) throw notOwner(); } } as unknown as OrderAccess;
  const subs = {
    active: async () => (opts.subscriber ? { id: 's1' } : null),
    priceFor: async () => 99_000,
  } as unknown as SubscriptionService;
  const impressions = {
    paywallHit: async (u: string, k: string) => { hits.push([u, k]); },
    series: async () => ({ days: [], totals: { all: 0 } }),
    detailViews: async () => ({ l1: 7 }),
  } as unknown as ImpressionsService;
  const c = new ImpressionsController(impressions, prisma, listings, access, subs);
  return { c, hits };
}
const refusal = async (f: () => Promise<unknown>) => {
  try {
    await f();
  } catch (e) {
    const h = e as HttpException;
    return { status: h.getStatus?.() ?? (e as { status?: number }).status, body: h.getResponse?.() as Record<string, unknown> };
  }
  return null;
};

describe("egasi ko'rsatkichlari: faqat obunachiga", () => {
  it("obunasiz e'lon egasi 402 oladi va devor sanog'i yoziladi", async () => {
    const { c, hits } = metrics({ subscriber: false });
    const r = await refusal(() => c.listing('u1', 'l1'));
    expect(r?.status).toBe(402);
    expect(r?.body).toMatchObject({ code: 'SUBSCRIPTION_REQUIRED', kind: 'metrics', priceSom: 99_000 });
    expect(hits).toEqual([['u1', 'metrics']]);
  });

  it('obunasiz terminal xodimi ham 402 oladi', async () => {
    const { c, hits } = metrics({ subscriber: false });
    expect((await refusal(() => c.terminal('u1', 't1')))?.status).toBe(402);
    expect(hits).toEqual([['u1', 'metrics']]);
  });

  it("obunachiga ko'rsatkichlar beriladi, devor yozilmaydi", async () => {
    const { c, hits } = metrics({ subscriber: true });
    expect(await c.listing('u1', 'l1')).toMatchObject({ inquiries: 3, views: 7 });
    expect(await c.terminal('u1', 't1')).toMatchObject({ inquiries: 3, orders: 2 });
    expect(hits).toHaveLength(0);
  });

  it('begona obyekt 403 oladi va devorga urilgan deb sanalmaydi', async () => {
    const { c, hits } = metrics({ subscriber: false, owner: false });
    expect((await refusal(() => c.listing('u1', 'l1')))?.status).toBe(403);
    expect((await refusal(() => c.terminal('u1', 't1')))?.status).toBe(403);
    expect(hits).toHaveLength(0);
  });
});
