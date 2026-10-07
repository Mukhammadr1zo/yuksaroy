import { uzLocalToUtc } from '@yuksaroy/domain';

/**
 * Oylik tushum: tasdiqlangan obuna va Premium to'lovlari hamda sotilgan reklama bitta varaqqa yig'iladi.
 *
 * Oy TOSHKENT bo'yicha kesiladi. 30-sentabr 23:00 da kelgan pul UTC da oktabrga
 * tushardi va oy yakuni bankdagi ko'chirma bilan to'g'ri kelmay qolardi: farq besh soat.
 *
 * ponytail: guruhlash xotirada; oyiga minglab to'lov bo'lsa SQL date_trunc ga o'tkaziladi.
 */
const P = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit' });

/** "2026-09" */
export const monthKey = (d: Date) => {
  const p = P.formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g('year')}-${g('month')}`;
};

/**
 * Shu oy va o'tgan oy boshlanishi, TOSHKENT bo'yicha.
 *
 * UTC da kesilsa oyning oxirgi besh soati keyingi oyga tushib ketardi va oy yakuni
 * odam ko'rgan kalendar bilan to'g'ri kelmasdi.
 */
export function monthWindow(now = new Date()) {
  const k = monthKey(now);
  return { start: uzLocalToUtc(`${k}-01`, '00:00'), prevStart: uzLocalToUtc(`${monthBack(k, 1)}-01`, '00:00') };
}

/** `back` oy orqadagi kalit: "2026-09" dan 11 orqada "2025-10". Manfiy `back` oldinga yuradi: -1 keyingi oy (money.ts monthEnd shunga tayanadi). */
export function monthBack(key: string, back: number) {
  const [y, m] = key.split('-').map(Number);
  const t = y! * 12 + (m! - 1) - back;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

type Sub = { paidAt: Date | null; startsAt: Date | null; amountTiyin: bigint };
type Prem = { paidAt: Date | null; amountTiyin: bigint };
type Ad = { startsAt: Date; pricePaidSom: number };
export type RevenueMonth = { month: string; totalTiyin: number; subsTiyin: number; premiumTiyin: number; adsTiyin: number; payments: number; renewals: number };

/**
 * Sotilgan reklama shu oynada: reklama puli u BOSHLANGAN oyga yoziladi (startsAt).
 *
 * Nega to'lov sanasi emas: reklama modulida u yo'q. pricePaidSom panel varag'idagi oddiy son,
 * istalgan keyingi tahrirda yozilishi yoki o'zgarishi mumkin (forma har safar hamma maydonni
 * yuboradi, audit esa faqat maydon nomini yozadi). createdAt ham emas: yangi reklama sukutda
 * Qoralama, ya'ni qator sotuvdan oldin ochiladi, uning sanasi esa panelda hech qayerda
 * ko'rinmaydi. startsAt ni ega har sotuvga o'zi qo'yadi, reklamalar ro'yxati shu bo'yicha
 * saralangan va narx yonida turadi: oyning reklama puli qaysi qatorlardan yig'ilganini ega
 * o'sha ro'yxatdan tekshiradi. Reklama oldindan to'lanadi, ya'ni boshlanishdan uzoq emas.
 *
 * Holat qaralmaydi: u faqat ko'rsatishni boshqaradi, muddati tugab Qoralamaga qaytarilgan
 * reklamaning puli baribir kelgan. Boshlanmagani (lt: hozir) hali sanalmaydi.
 *
 * ponytail: bir qator = bir sotuv. Uzaytirish eski qatorga yozilsa hammasi birinchi oyga
 * tushadi, o'chirilgan reklama puli tarixdan ketadi; kerak bo'lsa paidAt li to'lov qatori.
 */
export const adSales = (gte: Date, lt: Date) => ({ pricePaidSom: { gt: 0 }, startsAt: { gte, lt } });

export function monthlyRevenue(subs: Sub[], prems: Prem[], ads: Ad[], now = new Date()): RevenueMonth[] {
  const first = monthBack(monthKey(now), 11); // to'liq bo'lmagan 13-oy varaqqa tushmasin
  const by = new Map<string, RevenueMonth>();
  const row = (k: string) => {
    let r = by.get(k);
    if (!r) { r = { month: k, totalTiyin: 0, subsTiyin: 0, premiumTiyin: 0, adsTiyin: 0, payments: 0, renewals: 0 }; by.set(k, r); }
    return r;
  };
  for (const s of subs) {
    if (!s.paidAt) continue;
    const k = monthKey(s.paidAt);
    if (k < first) continue;
    const r = row(k);
    const v = Number(s.amountTiyin); // BigInt JSON ga chiqmaydi
    r.subsTiyin += v; r.totalTiyin += v; r.payments += 1;
    // Tasdiqda startsAt faol obunaning tugash sanasidan boshlanadi: demak odam uzaytirgan
    if (s.startsAt && s.startsAt > s.paidAt) r.renewals += 1;
  }
  for (const o of prems) {
    if (!o.paidAt) continue;
    const k = monthKey(o.paidAt);
    if (k < first) continue;
    const r = row(k);
    const v = Number(o.amountTiyin);
    r.premiumTiyin += v; r.totalTiyin += v; r.payments += 1;
  }
  for (const a of ads) {
    const k = monthKey(a.startsAt);
    if (k < first) continue;
    const r = row(k);
    // Ustun Int (32 bit): * 100 ham 2^53 dan ancha past, ya'ni Number aniq, kasr chiqmaydi
    const v = a.pricePaidSom * 100;
    // payments ga qo'shilmaydi: u qo'lda tasdiqlash yuki, reklamada tasdiq navbati yo'q
    r.adsTiyin += v; r.totalTiyin += v;
  }
  return [...by.values()].sort((a, b) => (a.month < b.month ? 1 : -1)); // yangisi yuqorida
}

type Deal = { at: Date; priceTiyin: bigint | null };
export type DealMonth = { month: string; deals: number; volumeTiyin: number };

/**
 * Platformadagi bitimlar: mijoz tanlagan taklif narxi, tanlangan oyga. Tushum EMAS (pul
 * mijoz va ijrochi o'rtasida yuradi), shuning uchun RevenueMonth ga qo'shilmaydi.
 * Narxsiz taklif bitim bo'lib sanaladi, hajmga kirmaydi. 12 oy hamisha bor, yangisi
 * birinchi: bitimsiz oy nol bilan (mergeMonths bilan bir xil).
 */
export function monthlyDeals(deals: Deal[], now = new Date()): DealMonth[] {
  const cur = monthKey(now);
  const by = new Map<string, DealMonth>();
  for (let back = 0; back < 12; back++) { const month = monthBack(cur, back); by.set(month, { month, deals: 0, volumeTiyin: 0 }); }
  for (const d of deals) {
    const r = by.get(monthKey(d.at));
    if (!r) continue; // 12 oydan eski
    r.deals += 1;
    r.volumeTiyin += Number(d.priceTiyin ?? 0n); // taklif <= 1e12 tiyin (DTO), yig'indi 2^53 dan past
  }
  return [...by.values()];
}
