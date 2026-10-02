import { HttpException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../../common/audit.service';
import type { PlatformConfigService } from '../../common/platform-config.service';
import type { PrismaService } from '../../common/prisma.service';
import type { SubscriptionService } from '../subscription/subscription.service';
import type { ImpressionsService } from '../impressions/impressions.service';
import type { DRailwayClient } from './d-railway.client';
import { WagonController } from './wagon.controller';

/**
 * Kesh, egalik, kalit va navbat qoidalari. DB o'rnida xotiradagi qatorlar:
 * soxta prisma faqat kontroller ishlatadigan to'rtta so'rovni biladi.
 */
type Row = { id: string; userId: string; wagonNo: string; found: boolean; result: unknown; createdAt: Date };
type Where = { userId?: string; wagonNo?: string; createdAt?: { gt: Date }; result?: { not: unknown } };

function fakePrisma() {
  const rows: Row[] = [];
  const match = (r: Row, w: Where) =>
    (w.userId === undefined || r.userId === w.userId) &&
    (w.wagonNo === undefined || r.wagonNo === w.wagonNo) &&
    (w.createdAt === undefined || r.createdAt > w.createdAt.gt) &&
    (w.result === undefined || r.result !== null);
  const wagonSearch = {
    findFirst: async ({ where, orderBy }: { where: Where; orderBy?: { createdAt: 'desc' } }) => {
      const hit = rows.filter((r) => match(r, where));
      if (orderBy) hit.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return hit[0] ?? null;
    },
    findMany: async ({ where, orderBy, take }: { where: Where; orderBy?: { createdAt: 'desc' }; take?: number }) => {
      const hit = rows.filter((r) => match(r, where));
      // Tartib va kesish haqiqatan bajariladi: aks holda "eng yangisi qoladi" testi bo'sh o'tardi
      if (orderBy) hit.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return take ? hit.slice(0, take) : hit;
    },
    count: async ({ where }: { where: Where }) => rows.filter((r) => match(r, where)).length,
    create: async ({ data }: { data: { userId: string; wagonNo: string; found: boolean; result: unknown } }) => {
      // Prisma.DbNull bazada NULL bo'ladi: bu yerda null. Haqiqiy natijani `fetchedAt` bo'yicha ajratamiz
      const result = data.result && typeof data.result === 'object' && 'fetchedAt' in (data.result as object) ? data.result : null;
      const row: Row = { id: `r${rows.length + 1}`, ...data, result, createdAt: new Date() };
      rows.push(row);
      return row;
    },
  };
  return { rows, wagonSearch };
}

/** Bot yo'li uchun: chat raqami -> userId. Ro'yxatda yo'q chat bog'lanmagan hisoblanadi. */
function fakeLinks(links: Record<string, string>) {
  return {
    findUnique: async ({ where }: { where: { chatId: bigint } }) => {
      const userId = links[String(where.chatId)];
      return userId ? { userId } : null;
    },
  };
}

function setup(opts: {
  freeTotal?: number;
  subscriber?: boolean;
  missFirst?: Set<string>;
  links?: Record<string, string>;
  /** To'lov devorining sanog'i shu massivga tushadi. */
  walls?: Record<string, unknown>[];
  /** Sanoq yiqilgan holat: devor baribir 402 qaytarishi kerak. */
  wallFails?: boolean;
} = {}) {
  const db = fakePrisma();
  const upstreamCalls: string[] = [];
  const upstream = {
    configured: true,
    history: async (no: string) => {
      upstreamCalls.push(no);
      // Faqat BIRINCHI qidiruvda topilmaydi: keyingi qidiruv topadi. Shu bilan
      // "ro'yxat eng yangi qatorni ko'rsatadi" qoidasi sinovdan o'tadi
      if (opts.missFirst?.delete(no)) return null;
      return { count: 1, events: [{ event_date: '2026-09-01', station: 'A' }] };
    },
  } as unknown as DRailwayClient;
  const prisma = { wagonSearch: db.wagonSearch, telegramLink: fakeLinks(opts.links ?? {}) } as unknown as PrismaService;
  const c = new WagonController(
    prisma,
    { get: async () => ({ wagonSearchFree: opts.freeTotal ?? 1 }) } as unknown as PlatformConfigService,
    // Narx tarifdan: devor tanasidagi priceSom shu yerdan keladi
    { isActive: async () => opts.subscriber ?? false, priceFor: async () => 99_000 } as unknown as SubscriptionService,
    { log: async () => {} } as unknown as AuditService,
    upstream,
    {
      record: async (items: Record<string, unknown>[]) => {
        if (opts.wallFails) throw new Error('baza yiqildi');
        opts.walls?.push(...items);
        return { accepted: items.length };
      },
    } as unknown as ImpressionsService,
  );
  return { c, rows: db.rows, upstreamCalls };
}

const status = (p: Promise<unknown>) => p.then(() => 200, (e) => (e instanceof HttpException ? e.getStatus() : Promise.reject(e)));

describe('WagonController.search', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
  afterEach(() => vi.useRealTimers());

  it("boshidagi nol bilan va nolsiz bitta vagon: bitta kesh, bitta kvota, upstream ga nolsiz", async () => {
    const { c, upstreamCalls, rows } = setup();
    const r1 = await c.search('a', { no: '1234567' });
    expect(r1.wagonNo).toBe('1234567');
    const r2 = await c.search('a', { no: '01234567' });
    expect(r2.wagonNo).toBe('1234567');
    expect(upstreamCalls).toEqual(['1234567']);
    expect(rows).toHaveLength(1); // qayta ochish o'ziniki: qator yozilmaydi
  });

  it('kesh muddati upstream dan olingan vaqtdan: 5 soatda keshdan, 7 soatda yangidan', async () => {
    const { c, upstreamCalls, rows } = setup();
    vi.setSystemTime(new Date('2026-09-21T09:00:00Z'));
    await c.search('a', { no: '1234567' });
    vi.setSystemTime(new Date('2026-09-21T14:00:00Z'));
    await c.search('b', { no: '1234567' });
    expect(upstreamCalls).toHaveLength(1); // 5 soatda keshdan: upstream tinch
    expect(rows[1].result).toBeNull(); // keshdan olingan qator natijasiz: kvota uchun
    vi.setSystemTime(new Date('2026-09-21T19:00:00Z'));
    await c.search('c', { no: '1234567' });
    expect(upstreamCalls).toHaveLength(2);
  });

  it("oradan boshqa birov qidirgan bo'lsa ham o'zining vagonini qayta ochish bepul", async () => {
    const { c, rows } = setup({ freeTotal: 1 });
    vi.setSystemTime(new Date('2026-09-21T09:00:00Z'));
    await c.search('a', { no: '1234567' });
    vi.setSystemTime(new Date('2026-09-21T10:00:00Z'));
    await c.search('b', { no: '1234567' });
    vi.setSystemTime(new Date('2026-09-21T11:00:00Z'));
    expect(await status(c.search('a', { no: '1234567' }))).toBe(200);
    expect(rows.filter((r) => r.userId === 'a')).toHaveLength(1);
    // Boshqa vagon esa kvotadan: bepul qidiruv tugagan
    expect(await status(c.search('a', { no: '7654321' }))).toBe(402);
  });

  it('6 soatdan keyin qayta ochish yangi qidiruv', async () => {
    const { c } = setup({ freeTotal: 1 });
    vi.setSystemTime(new Date('2026-09-21T09:00:00Z'));
    await c.search('a', { no: '1234567' });
    vi.setSystemTime(new Date('2026-09-21T16:00:00Z'));
    expect(await status(c.search('a', { no: '1234567' }))).toBe(402);
  });

  it("bir vaqtda ikkita so'rov: bitta bepul qidiruv bir marta yeyiladi", async () => {
    const { c, upstreamCalls, rows } = setup({ freeTotal: 1 });
    const [s1, s2] = await Promise.all([status(c.search('a', { no: '1234567' })), status(c.search('a', { no: '7654321' }))]);
    expect([s1, s2].sort()).toEqual([200, 402]);
    expect(upstreamCalls).toHaveLength(1);
    expect(rows).toHaveLength(1);
  });

  it('obunachi cheksiz, har qidiruv qator yozadi', async () => {
    const { c, rows } = setup({ freeTotal: 0, subscriber: true });
    expect(await status(c.search('s', { no: '1234567' }))).toBe(200);
    expect(await status(c.search('s', { no: '7654321' }))).toBe(200);
    expect(rows).toHaveLength(2);
  });
});

/**
 * Soatlik chegara IKKI xil: upstream ga boradigan qidiruv (30) va umumiy bo'ron (120).
 * Ilgari bitta chelak edi va keshdagi raqam ham uni yeb qo'yardi, ya'ni bir partiyani
 * soatiga ikki marta yangilab bo'lmasdi.
 *
 * DIQQAT: chelaklar modul darajasida va setup() ularni tozalamaydi. Shuning uchun har
 * test o'zining noyob foydalanuvchi nomini oladi.
 */
describe('vagon qidiruvi: partiya va chegara', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
  afterEach(() => vi.useRealTimers());

  it('keshdan kelgan javob soatlik chegarani yemaydi', async () => {
    const { c, upstreamCalls } = setup({ subscriber: true });
    vi.setSystemTime(new Date('2026-09-22T09:00:00Z'));
    const nos = Array.from({ length: 20 }, (_, i) => String(3000000 + i));
    for (const no of nos) expect(await status(c.search('r6-cache-a', { no }))).toBe(200);
    expect(upstreamCalls).toHaveLength(20);
    // Ikkinchi odam o'sha 20 tasini oladi: hammasi keshdan, upstream tinch
    for (const no of nos) expect(await status(c.search('r6-cache-b', { no }))).toBe(200);
    expect(upstreamCalls).toHaveLength(20);
    // Va uning upstream chegarasi hali butun: 11 ta yangi raqam ham o'tadi
    for (let i = 0; i < 11; i++) expect(await status(c.search('r6-cache-b', { no: String(3100000 + i) }))).toBe(200);
  });

  it('upstream ga soatiga 30 ta yangi raqam, 31-si rad etiladi', async () => {
    const { c } = setup({ subscriber: true });
    vi.setSystemTime(new Date('2026-09-22T09:00:00Z'));
    for (let i = 0; i < 30; i++) expect(await status(c.search('r6-limit', { no: String(3200000 + i) }))).toBe(200);
    expect(await status(c.search('r6-limit', { no: '3299999' }))).toBe(429);
  });

  it('oxirgi qidirganlarim: takrorsiz, yangisidan eskisiga, holati eng yangi qatordan', async () => {
    const { c } = setup({ subscriber: true, missFirst: new Set(['3300001']) });
    vi.setSystemTime(new Date('2026-09-22T09:00:00Z'));
    await c.search('r6-recent', { no: '3300001' }); // topilmadi
    await c.search('r6-recent', { no: '3300002' });
    // 6 soatdan keyin o'sha vagon qayta qidiriladi va endi topiladi
    vi.setSystemTime(new Date('2026-09-22T16:00:00Z'));
    const me = await c.search('r6-recent', { no: '3300001' }).then(() => c.me('r6-recent'));
    expect(me.recent.map((r) => r.wagonNo)).toEqual(['3300001', '3300002']);
    // Map bilan yig'ilsa bu yerda eski (false) qator qolardi
    expect(me.recent[0].found).toBe(true);
  });
});

/*
 * Bot yo'li. Eng muhimi: u qidiruvning O'ZI emas, faqat "kim so'radi" savoliga javob
 * beradigan qobiq. Shuning uchun testlar kvota va obuna devori shu yo'lda ham
 * ishlashini tekshiradi: aks holda telefon devori bot orqali chetlab o'tilardi.
 */
describe('WagonController.telegramSearch', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
  afterEach(() => vi.useRealTimers());

  it("bog'lanmagan chat rad etiladi", async () => {
    const { c, upstreamCalls } = setup({ links: {} });
    expect(await status(c.telegramSearch({ chatId: '777', no: '4400001' }))).toBe(403);
    // Upstream ga umuman bormaydi: bog'lanmagan chat pul turadigan chaqiruvni boshlamaydi
    expect(upstreamCalls).toHaveLength(0);
  });

  it("chat raqami raqam bo'lmasa 400", async () => {
    const { c } = setup({ links: { '777': 'u-tg-badchat' } });
    expect(await status(c.telegramSearch({ chatId: 'salom', no: '4400001' }))).toBe(400);
  });

  it("kvota botda ham sanaladi va tugagach obuna so'raladi", async () => {
    const { c, rows } = setup({ freeTotal: 1, links: { '777': 'u-tg-quota' } });
    vi.setSystemTime(new Date('2026-09-25T09:00:00Z'));
    expect(await status(c.telegramSearch({ chatId: '777', no: '4400001' }))).toBe(200);
    // Ikkinchi vagon bepul kvotadan tashqarida: 402
    expect(await status(c.telegramSearch({ chatId: '777', no: '4400002' }))).toBe(402);
    expect(rows).toHaveLength(1);
  });

  it("bot va sayt bitta kvotani baham ko'radi", async () => {
    const { c } = setup({ freeTotal: 1, links: { '777': 'u-tg-shared' } });
    vi.setSystemTime(new Date('2026-09-25T09:00:00Z'));
    // Saytdan qidirdi: bepul kvota tugadi
    expect(await status(c.search('u-tg-shared', { no: '4500001' }))).toBe(200);
    // Botdan o'sha odam yangi vagonni so'radi: kvota umumiy, ya'ni devor turadi
    expect(await status(c.telegramSearch({ chatId: '777', no: '4500002' }))).toBe(402);
  });

  it('obunachi botdan ham cheksiz qidiradi', async () => {
    const { c } = setup({ subscriber: true, freeTotal: 0, links: { '777': 'u-tg-sub' } });
    vi.setSystemTime(new Date('2026-09-25T09:00:00Z'));
    for (let i = 0; i < 3; i++) {
      expect(await status(c.telegramSearch({ chatId: '777', no: String(4600001 + i) }))).toBe(200);
    }
  });

  it("noto'g'ri raqam upstream ga bormaydi", async () => {
    const { c, upstreamCalls } = setup({ subscriber: true, links: { '777': 'u-tg-badno' } });
    expect(await status(c.telegramSearch({ chatId: '777', no: '123' }))).toBe(400);
    expect(upstreamCalls).toHaveLength(0);
  });
});

/**
 * To'lov devorining sanog'i. Ilgari konversiyaning faqat suratini (obuna soni) ko'rish
 * mumkin edi, MAXRAJI esa yo'q edi: nechta odam devorga urilib ketgani hech qayerda
 * yozilmasdi, ya'ni narx va bepul oyna tusmol bilan tanlanardi.
 */
describe("vagon devorining sanog'i", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
  afterEach(() => vi.useRealTimers());

  it('402 tashlanganda bitta qator yoziladi', async () => {
    const walls: Record<string, unknown>[] = [];
    const { c } = setup({ freeTotal: 0, walls });
    expect(await status(c.search('w-wall-1', { no: '5100001' }))).toBe(402);
    expect(walls).toEqual([{ kind: 'wall', targetId: 'wagon', surface: 'view' }]);
  });

  it("o'tib ketgan qidiruvda devor sanog'i yozilmaydi", async () => {
    const walls: Record<string, unknown>[] = [];
    const { c } = setup({ freeTotal: 1, walls });
    expect(await status(c.search('w-wall-2', { no: '5200001' }))).toBe(200);
    expect(walls).toHaveLength(0);
  });

  it("sanoq yiqilsa 402 baribir tashlanadi", async () => {
    const { c } = setup({ freeTotal: 0, wallFails: true });
    expect(await status(c.search('w-wall-3', { no: '5300001' }))).toBe(402);
  });

  it("botdan kelgan devor ham sanaladi: ikki yo'l bitta sonni to'ldiradi", async () => {
    const walls: Record<string, unknown>[] = [];
    const { c } = setup({ freeTotal: 0, walls, links: { '777': 'w-wall-4' } });
    expect(await status(c.telegramSearch({ chatId: '777', no: '5400001' }))).toBe(402);
    expect(walls).toHaveLength(1);
  });

  /*
   * Son URINISHNI emas, ODAMNI sanaydi. Nega muhim: obuna soni (surat) odam bo'yicha,
   * ya'ni maxraj urinish bo'yicha sanalsa nisbat bir necha barobar past chiqib, narx
   * va bepul oyna haqidagi qaror teskari tomonga olinardi.
   */
  it("bir odam kuniga bir marta: ikkinchi urinishda qator qo'shilmaydi", async () => {
    const walls: Record<string, unknown>[] = [];
    const { c } = setup({ freeTotal: 0, walls });
    expect(await status(c.search('w-wall-5', { no: '5500001' }))).toBe(402);
    expect(await status(c.search('w-wall-5', { no: '5500002' }))).toBe(402);
    expect(walls).toHaveLength(1);
  });
});
