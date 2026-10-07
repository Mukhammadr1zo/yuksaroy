// Katalog qidiruvi va bosh sahifa raqamlari. Soxta prisma, baza yo'q.
//
// 1) Bitta joy lotin, o'zbek kirili yoki telefon apostrofi bilan yozilsa ham bir xil natija
//    chiqishi kerak. Ko'prik - slug: u lotin "stansiya-nom". Reestr sluglarida х -> h, ё -> e
//    (korhonasi, biokime), shuning uchun lotin x va yo uchun ikkinchi slug varianti ham bor.
//    Ilgari "Бекобод" 0 ta, "Bekobod" 8 ta; "qarshi neft" va "Қарши нефт" bir-birini ko'rmasdi.
//    So'rov so'zlarga bo'linadi: sahifa "Қўқон биокимё" ni "Qo'qon биокимё" qilib yuboradi va
//    ibora sifatida u hech narsaga mos kelmasdi. Rus imlosidagi nom (Фергана, Ташкент) hozircha
//    qamrovdan tashqarida.
// 2) /stats namunani sanamaydi: ilgari 26 e'lon, 11 kompaniya va bugungi 40 bo'sh joyning
//    deyarli hammasi namuna edi.
import { describe, expect, it } from 'vitest';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../common/prisma.service';
import { PrismaCatalogRepository, terminalWhere } from './prisma-catalog.repository';

const ci = (s: string) => ({ contains: s, mode: 'insensitive' });
/** Faqat q berilganda AND da faqat matn shartlari qoladi: har so'zga bitta OR ro'yxati. */
const wordOrs = (q: string) => (terminalWhere({ q }).AND as Prisma.TerminalWhereInput[]).map((w) => w.OR as Record<string, unknown>[]);
const textOr = (q: string) => wordOrs(q)[0]!;
const slugs = (q: string) => wordOrs(q).map((or) => or.filter((c) => 'slug' in c));

/** Shartni xotiradagi qatorga qo'llaydi (matn qidiruvi ishlatadigan qismi): bazadagidek topiladimi. */
type Row = Record<string, unknown>;
type Like = { contains: string; mode?: string };
function holds(w: Row, r: Row): boolean {
  return Object.entries(w).every(([k, v]) =>
    k === 'AND' ? (v as Row[]).every((x) => holds(x, r))
    : k === 'OR' ? (v as Row[]).some((x) => holds(x, r))
    : k === 'station' ? !!r.station && holds(v as Row, r.station as Row)
    : typeof r[k] === 'string' && ((v as Like).mode
      ? (r[k] as string).toLowerCase().includes((v as Like).contains.toLowerCase())
      : (r[k] as string).includes((v as Like).contains)));
}
const finds = (q: string, r: Row) => holds({ AND: terminalWhere({ q }).AND }, r);
// Jonli katalogdagi qatorlar (2026-10-07): nomi kirillda, slugda х -> h va ё -> e
const biokimyo: Row = { slug: 'qaqir-qoqon-biokime-mchj', name: 'Қўқон биокимё МЧЖ', stationNameRaw: 'Какир', station: { nameUz: 'Qaqir', nameRu: 'Какир' } };
const oilaviy: Row = { slug: 'yaypan-gulsanam-kelajagi-oilaviy-korhonasi', name: 'GULSANAM KELAJAGI Оилавий корхонаси', station: { nameUz: 'Yaypan', nameRu: 'Яйпан' } };

describe("katalog qidiruvi: lotin, kirill va telefon apostrofi", () => {
  it.each<[string, string]>([
    ['Bekobod', 'bekobod'],
    ['Бекобод', 'bekobod'],
    ["Farg'ona", 'fargona'],
    ['Farg\u2018ona', 'fargona'],
    ['Farg\u2019ona', 'fargona'],
    ['Farg\u02BBona', 'fargona'],
    ['Farg\u02BCona', 'fargona'],
    ['Fargona', 'fargona'],
  ])('%s slug bo\'yicha "%s" ni ham qidiradi', (q, slug) => {
    expect(textOr(q)).toContainEqual({ slug: { contains: slug } });
  });

  it("ko'p so'zli so'rov: har so'z alohida shart, lotin va kirill bir xil slugga tushadi", () => {
    for (const q of ['qarshi neft', 'Қарши нефт']) {
      expect(slugs(q)).toEqual([[{ slug: { contains: 'qarshi' } }], [{ slug: { contains: 'neft' } }]]);
    }
  });

  it.each([
    ["Qo'qon биокимё"], // sahifa shaharni lug'at nomiga almashtiradi, qolgan so'z kirillda
    ['Қўқон биокимё'],
    ["Qo'qon biokimyo"], // to'g'ri lotin: slugda faqat biokime
    ['biokimyo qoqon'], // so'z tartibi ahamiyatsiz
  ])('%s: jonli qator topiladi', (q) => {
    expect(finds(q, biokimyo)).toBe(true);
  });

  it("so'zlardan biri qatorda bo'lmasa u chiqmaydi", () => {
    expect(finds("Qo'qon neft", biokimyo)).toBe(false);
  });

  it("lotin x va yo uchun reestr slugi varianti (х -> h, ё -> e); yo' (йў) ga tegilmaydi", () => {
    expect(finds('oilaviy korxonasi', oilaviy)).toBe(true);
    expect(textOr('korxonasi')).toContainEqual({ slug: { contains: 'korhonasi' } });
    expect(textOr('биокимё')).toContainEqual({ slug: { contains: 'biokime' } });
    expect(slugs("yo'lovchi")).toEqual([[{ slug: { contains: 'yolovchi' } }]]);
    // Ikki harfli variant (yol -> el) deyarli har slugda bor: qo'shilmaydi
    expect(slugs('yol')).toEqual([[{ slug: { contains: 'yol' } }]]);
  });

  it("so'zlar 8 tadan oshmaydi: uzun q bazaga og'ir so'rov bo'lib ketmasin", () => {
    expect(wordOrs(Array(20).fill('neft').join(' '))).toHaveLength(8);
  });

  it("telefon apostrofi to'g'ri apostrofga aylanadi: nomlar bazada ' bilan", () => {
    expect(textOr('Farg\u2018ona')).toContainEqual({ name: ci("Farg'ona") });
    expect(textOr('Farg\u02BCona')).toContainEqual({ name: ci("Farg'ona") });
  });

  it("kirill so'rov lotinchasi bilan ham solishtiriladi, lotin so'rovda shart takrorlanmaydi", () => {
    expect(textOr('Бекобод')).toEqual(expect.arrayContaining([{ name: ci('Бекобод') }, { name: ci('bekobod') }]));
    expect(textOr('Bekobod').filter((c) => 'name' in c)).toHaveLength(1);
  });

  it("yo'l egasining nomi va stansiyaning ruscha nomi ham qidiriladi", () => {
    expect(textOr('Бекабад')).toEqual(expect.arrayContaining([
      { ownerNameRaw: ci('Бекабад') },
      { station: { OR: [{ nameUz: ci('Бекабад') }, { nameRu: ci('Бекабад') }] } },
    ]));
  });

  it("faqat belgidan iborat so'rov hamma qatorni topmaydi: bo'sh slug sharti qo'shilmaydi", () => {
    expect(textOr('-').some((c) => 'slug' in c)).toBe(false);
  });

  it("q bo'lmasa matn sharti yo'q", () => {
    expect(terminalWhere({}).AND).toEqual([]);
  });

  it("stansiya qidiruvi: kirillda yozilgan o'zbekcha nom lotin nomni topadi", async () => {
    const calls: { where: { OR?: unknown[] } }[] = [];
    const prisma = { station: { findMany: async (a: { where: { OR?: unknown[] } }) => { calls.push(a); return []; } } } as unknown as PrismaService;
    const repo = new PrismaCatalogRepository(prisma);
    await repo.searchStations('Бекобод', undefined, 20);
    await repo.searchStations('Bekobod', undefined, 20);
    expect(calls[0]!.where.OR).toContainEqual({ nameUz: ci('bekobod') });
    expect(calls[1]!.where.OR).toHaveLength(3);
  });
});

describe('/stats: namuna sanalmaydi', () => {
  type Row = { isDemo: boolean };
  const rows = (demo: number, real: number): Row[] => [...Array(demo).fill({ isDemo: true }), ...Array(real).fill({ isDemo: false })];
  /** count where.isDemo ni rostdan qo'llaydi: kodda filtr bo'lmasa namuna ham sanaladi. */
  const count = (xs: Row[]) => async (a: { where: { isDemo?: boolean } }) => xs.filter((r) => a.where.isDemo === undefined || r.isDemo === a.where.isDemo).length;

  it("e'lon, kompaniya, terminal va bugungi bo'sh joy faqat haqiqiy qatorlardan; javob shakli o'zgarmaydi", async () => {
    // Uchta namuna terminalda bugun 40 joy, bitta haqiqiysida 2
    const slots = [
      { terminalId: 'n1', isDemo: true, capacity: 12 }, { terminalId: 'n2', isDemo: true, capacity: 14 },
      { terminalId: 'n3', isDemo: true, capacity: 14 }, { terminalId: 'r1', isDemo: false, capacity: 2 },
    ];
    const prisma = {
      terminal: { count: count(rows(3, 1)) },
      station: { count: async () => 281 },
      listing: { count: count(rows(25, 1)) },
      organization: { count: count(rows(10, 1)) },
      timeSlot: {
        findMany: async (a: { where: { terminal: { isDemo?: boolean } } }) => slots
          .filter((s) => a.where.terminal.isDemo === undefined || s.isDemo === a.where.terminal.isDemo)
          .map((s) => ({ terminalId: s.terminalId, capacity: s.capacity, booked: 0, held: 0, bookings: [] })),
      },
      visit: { aggregate: async () => ({ _sum: { count: 140 } }), groupBy: async () => [] },
    } as unknown as PrismaService;

    const stats = await new PrismaCatalogRepository(prisma).publicStats();
    expect(stats).toEqual({ terminals: 1, sidings: 1, stations: 281, listings: 1, companies: 1, freeSlotsToday: 2, visits30: 140, visitRegions: [] });
  });
});
