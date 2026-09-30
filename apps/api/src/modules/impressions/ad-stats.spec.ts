// Reklama sanog'i: bannerni sotgan odamga "necha marta ko'rildi, necha marta bosildi"
// degan savolga javob shu yerda qulflanadi. Yangi jadval yo'q: mavjud kunlik yig'ma
// qator ishlatiladi, ya'ni xom yozuv ham, IP ham, sessiya ham saqlanmaydi.
import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../../common/prisma.service';
import { ImpressionsService } from './impressions.service';

type GroupArgs = { by: string[]; where: Record<string, unknown>; _sum: { count: boolean } };
type Row = { targetId: string; surface: string; sum: number | null };

/** Bazani soxtalashtiramiz: birinchi groupBy jami, ikkinchisi 30 kunlik oyna. */
function fake(all: Row[], recent: Row[] = all, adIds: string[] = []) {
  const groups: GroupArgs[] = [];
  const finds: { where: Record<string, unknown> }[] = [];
  const out = (rows: Row[]) => rows.map((r) => ({ targetId: r.targetId, surface: r.surface, _sum: { count: r.sum } }));
  const prisma = {
    impression: {
      groupBy: async (a: GroupArgs) => { groups.push(a); return out(a.where.day ? recent : all); },
    },
    adPlacement: {
      findMany: async (a: { where: { id: { in: string[] } } }) => {
        finds.push(a);
        return a.where.id.in.filter((id) => adIds.includes(id)).map((id) => ({ id }));
      },
    },
  } as unknown as PrismaService;
  return { svc: new ImpressionsService(prisma), groups, finds };
}

describe('reklama sanog\'i', () => {
  it("bo'sh ro'yxatda bazaga umuman borilmaydi", async () => {
    const f = fake([]);
    expect(await f.svc.adStats([])).toEqual(new Map());
    expect(f.groups).toHaveLength(0);
  });

  it("ko'rildi va bosildi ajratiladi, jami va 30 kun alohida", async () => {
    const f = fake(
      [{ targetId: 'a1', surface: 'view', sum: 100 }, { targetId: 'a1', surface: 'click', sum: 7 }],
      [{ targetId: 'a1', surface: 'view', sum: 40 }, { targetId: 'a1', surface: 'click', sum: 3 }],
    );
    const s = await f.svc.adStats(['a1']);
    expect(s.get('a1')).toEqual({ views: 100, clicks: 7, closes: 0, views30: 40, clicks30: 3, closes30: 0 });
    expect(f.groups).toHaveLength(2); // banner boshiga so'rov emas: ikkita so'rov, xolos
  });

  /**
   * Bu tekshiruv aynan bitta jim xatoni ushlaydi: eski kod "click bo'lmasa view" deb
   * yozilgan edi, ya'ni yopish sanog'i qo'shilishi bilan har yopish bitta ko'rish
   * bo'lib sanalardi va sotib oluvchiga shishirilgan raqam ketardi.
   */
  it("yopildi ko'rildi ustiga qo'shilmaydi, har yuza o'z ustuniga tushadi", async () => {
    const f = fake(
      [
        { targetId: 'a1', surface: 'view', sum: 100 },
        { targetId: 'a1', surface: 'click', sum: 7 },
        { targetId: 'a1', surface: 'close', sum: 55 },
      ],
      [{ targetId: 'a1', surface: 'close', sum: 20 }],
    );
    const s = await f.svc.adStats(['a1']);
    expect(s.get('a1')).toEqual({ views: 100, clicks: 7, closes: 55, views30: 0, clicks30: 0, closes30: 20 });
  });

  it("hali ko'rilmagan banner nol beradi, undefined emas", async () => {
    const f = fake([]);
    const s = await f.svc.adStats(['a1', 'a2']);
    expect(s.get('a2')).toEqual({ views: 0, clicks: 0, closes: 0, views30: 0, clicks30: 0, closes30: 0 });
  });

  it("faqat 'ad' turi va view/click/close yuzasi so'raladi", async () => {
    const f = fake([]);
    await f.svc.adStats(['a1']);
    expect(f.groups[0]!.where).toMatchObject({ kind: 'ad', surface: { in: ['view', 'click', 'close'] } });
    expect(f.groups[0]!.by).toEqual(['targetId', 'surface']);
  });

  /**
   * Oyna chegarasi: 30 kun degani bugun bilan birga 30 ta kun, ya'ni 29 kun oldingi
   * kundan boshlanadi. Kun Toshkent bo'yicha: kechqurun kelgan bosish ertangi kunga
   * o'tib ketmasin.
   */
  it('30 kunlik oyna bugundan 29 kun oldin boshlanadi', async () => {
    const f = fake([]);
    await f.svc.adStats(['a1'], 30, new Date('2026-09-30T21:00:00Z')); // Toshkentda 1-oktabr
    const day = f.groups.find((g) => g.where.day)!.where.day as { gte: Date };
    expect(day.gte.toISOString().slice(0, 10)).toBe('2026-09-02');
  });

  it('oyna uzunligi berilsa shunga qarab suriladi', async () => {
    const f = fake([]);
    await f.svc.adStats(['a1'], 7, new Date('2026-09-30T09:00:00Z'));
    const day = f.groups.find((g) => g.where.day)!.where.day as { gte: Date };
    expect(day.gte.toISOString().slice(0, 10)).toBe('2026-09-24');
  });

  it("notanish yuza qatori sanoqqa qo'shilmaydi", async () => {
    const f = fake([{ targetId: 'a1', surface: 'list', sum: 999 }]);
    expect((await f.svc.adStats(['a1'])).get('a1')).toEqual({ views: 0, clicks: 0, closes: 0, views30: 0, clicks30: 0, closes30: 0 });
  });
});

/**
 * Mayoq yo'li kirishsiz: begona odam ixtiyoriy id yuborib sotib oluvchiga
 * ko'rsatiladigan sonni shishira olmasin.
 */
describe('reklama mayog\'ini tekshirish', () => {
  it("noma'lum banner id jim tashlanadi, haqiqiysi qoladi", async () => {
    const f = fake([], [], ['a1']);
    const kept = await f.svc.keepRealAds([
      { kind: 'ad', targetId: 'a1', surface: 'view' },
      { kind: 'ad', targetId: 'yoq', surface: 'view' },
    ]);
    expect(kept).toEqual([{ kind: 'ad', targetId: 'a1', surface: 'view' }]);
    expect(f.finds).toHaveLength(1); // element boshiga so'rov yo'q
  });

  it("katalog mayoqlari tegilmaydi va reklama yo'q bo'lsa baza so'rovi ketmaydi", async () => {
    const f = fake([], [], []);
    const items = [{ kind: 'listing' as const, targetId: 'l1', surface: 'detail' }];
    expect(await f.svc.keepRealAds(items)).toEqual(items);
    expect(f.finds).toHaveLength(0);
  });

  it('tur bilan yuza mos kelmasa element tashlanadi', async () => {
    const f = fake([], [], ['a1']);
    const kept = await f.svc.keepRealAds([
      { kind: 'listing', targetId: 'l1', surface: 'click' }, // e'lon "bosildi" deb sanalmaydi
      { kind: 'ad', targetId: 'a1', surface: 'detail' }, // banner katalog yuzasiga tushmaydi
      { kind: 'ad', targetId: 'a1', surface: 'click' },
    ]);
    expect(kept).toEqual([{ kind: 'ad', targetId: 'a1', surface: 'click' }]);
  });

  /**
   * Banner id ommaviy, ya'ni id ni bilish qiyin emas. Bitta so'rovda 50 ta element
   * bo'lishi mumkin va record() bir xil uchlikni birlashtirib count += 50 qilardi,
   * ya'ni bitta so'rov bilan son 50 barobar shishardi. Endi bitta so'rovda bitta
   * banner uchun bitta yuza qoladi.
   */
  it('bitta so\'rovdagi takror bosishlar bittaga tushadi', async () => {
    const f = fake([], [], ['a1']);
    const spam = Array.from({ length: 50 }, () => ({ kind: 'ad' as const, targetId: 'a1', surface: 'click' }));
    expect(await f.svc.keepRealAds(spam)).toEqual([{ kind: 'ad', targetId: 'a1', surface: 'click' }]);
  });

  it("ko'rildi va bosildi alohida sanaladi, ikki banner ham o'zicha", async () => {
    const f = fake([], [], ['a1', 'a2']);
    const kept = await f.svc.keepRealAds([
      { kind: 'ad', targetId: 'a1', surface: 'view' },
      { kind: 'ad', targetId: 'a1', surface: 'click' },
      { kind: 'ad', targetId: 'a1', surface: 'view' }, // takror: tashlanadi
      { kind: 'ad', targetId: 'a2', surface: 'view' },
    ]);
    expect(kept).toHaveLength(3);
  });

  it("katalog mayoqlarida takror tegilmaydi: bir sahifada bir obyekt ikki yuzada ko'rinadi", async () => {
    const f = fake([], [], []);
    const items = [
      { kind: 'listing' as const, targetId: 'l1', surface: 'list' },
      { kind: 'listing' as const, targetId: 'l1', surface: 'list' },
    ];
    expect(await f.svc.keepRealAds(items)).toEqual(items);
  });

  it("bir xil banner id bir marta so'raladi", async () => {
    const f = fake([], [], ['a1']);
    await f.svc.keepRealAds([
      { kind: 'ad', targetId: 'a1', surface: 'view' },
      { kind: 'ad', targetId: 'a1', surface: 'click' },
    ]);
    expect(f.finds[0]!.where).toEqual({ id: { in: ['a1'] } });
  });
});
