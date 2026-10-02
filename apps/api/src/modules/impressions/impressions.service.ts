import { Injectable } from '@nestjs/common';
import { uzLocalDate } from '@yuksaroy/domain';
import { PrismaService } from '../../common/prisma.service';
import { dayKeys, daySeries } from './day-series';

/*
 * 'wall': to'lov devoriga urilgan odam. Bu konversiyaning MAXRAJI: obuna soni ko'rinadi,
 * devorda to'xtab ketganlar esa ko'rinmasdi, ya'ni narx, bepul oyna va devor joyi
 * haqidagi uchala qaror ham tusmol bilan qilinardi.
 *
 * targetId devor nomi: 'phone' (raqam ochish) va 'wagon' (vagon qidiruvi). Bitta
 * jadvalda, chunki ikkisi yonma-yon qo'yilsa qaysi devor odamni ko'proq to'xtatayotgani
 * ko'rinadi.
 *
 * DIQQAT: 'wall' ommaviy DTO ga (impressions.controller.ts) QO'SHILMAYDI. O'sha yo'l
 * kirishsiz, ya'ni begona odam devor sonini bir so'rovda shishirib yuborardi va qaror
 * uchun yaroqsiz bo'lib qolardi. Bu son FAQAT serverda, 402 tashlanadigan joyda,
 * bir odam uchun kuniga bir marta yoziladi (wallDaily chelagi) - obuna soni ham ODAM
 * bo'yicha, ya'ni surat bilan maxraj bitta birlikda bo'lishi kerak.
 *
 * O'qiladigan joy: admin boshsahifasidagi raqam ochish kartasi (admin-home.controller.ts
 * reveals()), telefon va vagon devori alohida qator. Yozilib hech qayerda ko'rinmagan
 * son hech qanday qarorni qo'llab-quvvatlamaydi, shuning uchun o'quvchi bilan birga keldi.
 */
export type ImpressionKind = 'listing' | 'terminal' | 'org' | 'ad' | 'wall';
export interface ImpressionItem { kind: ImpressionKind; targetId: string; surface: string }

/**
 * Reklama banneri uchun uchta yuza: ko'rildi, bosildi va yopildi.
 *
 * "Yopildi" bezak emas, u aniq qarorga olib boradi: yopish ulushi yuqori bo'lsa
 * ko'rsatish muddati qisqartiriladi yoki jim vaqt uzaytiriladi.
 *
 * Nega domain dagi IMPRESSION_SURFACES ga qo'shilmadi: u ro'yxat katalog obyektining
 * kunlik qatorini (har yuza uchun ustun) belgilaydi, ya'ni unga yangi yuza qo'shilsa
 * e'lon egasining sahifasida "bosildi" degan bo'sh ustun paydo bo'lardi. Reklama
 * sanog'i butunlay boshqa hisob, shuning uchun ro'yxati ham alohida.
 */
export const AD_SURFACES = ['view', 'click', 'close'] as const;
export type AdSurface = (typeof AD_SURFACES)[number];
const isAdSurface = (s: string): s is AdSurface => (AD_SURFACES as readonly string[]).includes(s);

export interface AdStats { views: number; clicks: number; closes: number; views30: number; clicks30: number; closes30: number }

/**
 * Yuza -> ustun: har biri o'z nomi bilan yoziladi.
 *
 * Nega jadval, nega "click bo'lmasa view" emas: eski kod aynan shunday yozilgan edi va
 * yangi yuza qo'shilishi bilan u JIM buzilardi - har yopish bitta ko'rish bo'lib
 * sanalardi va sotib oluvchiga shishirilgan raqam ketardi. Hech qanday xato xabari
 * chiqmaydi, faqat son noto'g'ri bo'ladi. Endi yangi yuza qo'shilsa TypeScript bu
 * jadvalni to'ldirishni talab qiladi.
 */
const AD_FIELD: Record<AdSurface, 'views' | 'clicks' | 'closes'> = { view: 'views', click: 'clicks', close: 'closes' };
const ZERO_AD_STATS = (): AdStats => ({ views: 0, clicks: 0, closes: 0, views30: 0, clicks30: 0, closes30: 0 });

/** Ko'rsatishlar: kun bo'yicha yig'ma (foydalanuvchi ma'lumoti yo'q). */
@Injectable()
export class ImpressionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Bir xil (kind, target, surface) lar birlashtiriladi; kun Toshkent bo'yicha; upsert count += n. */
  async record(items: ImpressionItem[], now = new Date()) {
    const day = new Date(uzLocalDate(now));
    const n = new Map<string, number>();
    for (const i of items) {
      const k = JSON.stringify([i.kind, i.targetId, i.surface]);
      n.set(k, (n.get(k) ?? 0) + 1);
    }
    // ponytail: har guruh uchun bitta upsert (50 tagacha) bitta tranzaksiyada; yuk oshsa bitta INSERT ... ON CONFLICT
    await this.prisma.$transaction(
      [...n].map(([k, count]) => {
        const [kind, targetId, surface] = JSON.parse(k) as [string, string, string];
        return this.prisma.impression.upsert({
          where: { kind_targetId_day_surface: { kind, targetId, day, surface } },
          create: { kind, targetId, day, surface, count },
          update: { count: { increment: count } },
        });
      }),
    );
    return { accepted: items.length };
  }

  /**
   * Reklama mayoqlarini tozalash: faqat bazada chindan bor banner sanaladi.
   *
   * Bu yo'l kirishsiz, ya'ni begona odam ixtiyoriy id yuborib sotib oluvchiga
   * ko'rsatiladigan sonni shishira olardi. Notanish element JIM tashlanadi, butun
   * so'rov yiqilmaydi: bir sahifada bir nechta mayoq bo'ladi va bittasi eskirgani
   * uchun qolganlari yo'qolmasin.
   *
   * Tur bilan yuza ham mos bo'lishi shart: 'ad' faqat view/click, katalog obyekti esa
   * faqat o'z yuzalari. Aks holda reklama sanog'iga katalog mayog'ini quyish mumkin edi.
   *
   * Banner id ommaviy (GET /ads javobida turadi), ya'ni id ni tekshirishning o'zi yetmaydi.
   * Shuning uchun bitta so'rovda bitta banner uchun bitta ko'rildi va bitta bosildi
   * qoladi: haqiqiy brauzer ham aynan shunday yuboradi, begona odam esa 50 talik
   * ro'yxatni bir xil element bilan to'ldirib sonni 50 barobar shishira olardi
   * (record() bir xil uchlikni birlashtirib count += 50 qilardi).
   */
  async keepRealAds(items: readonly ImpressionItem[]): Promise<ImpressionItem[]> {
    const fit = items.filter((i) => (i.kind === 'ad') === isAdSurface(i.surface));
    const ids = [...new Set(fit.filter((i) => i.kind === 'ad').map((i) => i.targetId))];
    if (!ids.length) return fit; // reklama mayog'i yo'q: bazaga borilmaydi
    const rows = await this.prisma.adPlacement.findMany({ where: { id: { in: ids } }, select: { id: true } });
    const real = new Set(rows.map((r) => r.id));
    const seen = new Set<string>();
    return fit.filter((i) => {
      if (i.kind !== 'ad') return true;
      if (!real.has(i.targetId)) return false;
      const k = `${i.targetId}:${i.surface}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  /**
   * Banner sanog'i: ko'rildi va bosildi, jami va oxirgi 30 kun.
   *
   * Nega ikki oyna: jami sotuvchiga "shu joy umuman ishlaydimi" deydi, 30 kunlik son esa
   * hozirgi shartnoma bo'yicha hisobot beradi. Ikkalasi bitta juft so'rovda olinadi,
   * qator boshiga so'rov yuborilmaydi.
   */
  async adStats(ids: readonly string[], days = 30, now = new Date()): Promise<Map<string, AdStats>> {
    const out = new Map<string, AdStats>();
    if (!ids.length) return out; // bo'sh ro'yxatda bazaga umuman borilmaydi
    for (const id of ids) out.set(id, ZERO_AD_STATS());
    const where = { kind: 'ad', targetId: { in: [...new Set(ids)] }, surface: { in: [...AD_SURFACES] } };
    const from = new Date(dayKeys(now, days)[0]!);
    const [all, recent] = await Promise.all([
      this.prisma.impression.groupBy({ by: ['targetId', 'surface'], where, _sum: { count: true } }),
      this.prisma.impression.groupBy({ by: ['targetId', 'surface'], where: { ...where, day: { gte: from } }, _sum: { count: true } }),
    ]);
    const add = (rows: { targetId: string; surface: string; _sum: { count: number | null } }[], suffix: '' | '30') => {
      for (const r of rows) {
        const s = out.get(r.targetId);
        if (!s || !isAdSurface(r.surface)) continue;
        const key = (AD_FIELD[r.surface] + suffix) as keyof AdStats;
        s[key] += r._sum.count ?? 0;
      }
    };
    add(all, '');
    add(recent, '30');
    return out;
  }

  /**
   * E'lon (yoki terminal) sahifasi necha marta ochilgan, umrbod.
   * Manba `Listing.views` emas: u server sahifani qayta yasaganda oshadi, sahifa esa
   * 60 soniya keshlanadi, ya'ni bir daqiqada kelgan yuz odam bitta bo'lib sanalardi.
   * Bu yerdagi son brauzerdan kelgan 'detail' mayoqlaridan, ya'ni har ochilish sanaladi.
   */
  async detailViews(kind: ImpressionKind, targetIds: readonly string[]): Promise<Record<string, number>> {
    if (!targetIds.length) return {};
    const rows = await this.prisma.impression.groupBy({
      by: ['targetId'],
      where: { kind, targetId: { in: [...targetIds] }, surface: 'detail' },
      _sum: { count: true },
    });
    return Object.fromEntries(rows.map((r) => [r.targetId, r._sum.count ?? 0]));
  }

  /**
   * Oxirgi 30 kunda eng ko'p ochilgan obyektlar, ko'pidan kamiga.
   *
   * 'detail' yuzasi: ro'yxatda ko'ringani qiziqish emas, sahifani OCHGANI qiziqish.
   * Saralash ham, chegara ham bazada: xotiraga faqat `take` ta qator keladi.
   * Ikkinchi kalit targetId: teng sonli qatorlar sahifadan sahifaga sakramaydi.
   * Nol ochilgan obyekt umuman qaytmaydi: chaqiruv navbati faqat talab bor obyektdan tuziladi.
   */
  async topDetailViews(kind: ImpressionKind, take: number, now = new Date()): Promise<{ id: string; views: number }[]> {
    const rows = await this.prisma.impression.groupBy({
      by: ['targetId'],
      where: { kind, surface: 'detail', day: { gte: new Date(dayKeys(now)[0]!) } },
      _sum: { count: true },
      orderBy: [{ _sum: { count: 'desc' } }, { targetId: 'asc' }],
      take,
    });
    return rows.map((r) => ({ id: r.targetId, views: r._sum.count ?? 0 }));
  }

  /**
   * Bitta tashrif: kun va joy bo'yicha yig'iladi.
   *
   * Xom yozuv saqlanmaydi: na IP, na sessiya, na sahifa manzili. Ya'ni bu jadvaldan
   * bitta odamni ajratib olib bo'lmaydi, faqat "shu kuni shu joydan nechta" chiqadi.
   */
  async recordVisit(geo: { country: string; region: string }, now = new Date()) {
    const day = new Date(uzLocalDate(now));
    await this.prisma.visit.upsert({
      where: { day_country_region: { day, country: geo.country, region: geo.region } },
      create: { day, country: geo.country, region: geo.region, count: 1 },
      update: { count: { increment: 1 } },
    });
  }

  /** Oxirgi 30 kun: kunlar qatori, viloyatlar va davlatlar kesimi. */
  async visits(now = new Date()) {
    const keys = dayKeys(now);
    const from = new Date(keys[0]!);
    const rows = await this.prisma.visit.findMany({
      where: { day: { gte: from } },
      select: { day: true, country: true, region: true, count: true },
    });
    const byDay = new Map<string, number>(keys.map((k) => [k, 0]));
    const byRegion = new Map<string, number>();
    const byCountry = new Map<string, number>();
    let total = 0;
    for (const r of rows) {
      const k = r.day.toISOString().slice(0, 10);
      byDay.set(k, (byDay.get(k) ?? 0) + r.count);
      byCountry.set(r.country, (byCountry.get(r.country) ?? 0) + r.count);
      if (r.region) byRegion.set(r.region, (byRegion.get(r.region) ?? 0) + r.count);
      total += r.count;
    }
    const sorted = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]);
    return {
      total,
      days: keys.map((day) => ({ day, count: byDay.get(day) ?? 0 })),
      regions: sorted(byRegion).map(([region, count]) => ({ region, count })),
      countries: sorted(byCountry).map(([country, count]) => ({ country, count })),
    };
  }

  /** Oxirgi 30 kun: { days: [{ day, list, map, detail, compare, bot }], totals }. */
  async series(kind: ImpressionKind, targetId: string, now = new Date()) {
    const keys = dayKeys(now);
    const rows = await this.prisma.impression.findMany({ where: { kind, targetId, day: { gte: new Date(keys[0]!) } }, select: { day: true, surface: true, count: true } });
    return daySeries(rows, keys);
  }
}
