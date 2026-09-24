// Kuzatuv qoidalari: framework yo'q, Prisma yo'q. Server ham, sayt ham shu bitta
// ro'yxatdan foydalanadi, shuning uchun oq ro'yxat ikki nusxa bo'lib ajralmaydi.
import { REGIONS } from './index';
import { LISTING_KINDS, TRUCK_TYPES } from './listing';
import { DEAL_KINDS } from './search';

export const WATCH_KINDS = ['CARGO', 'LISTING'] as const;
export type WatchKind = (typeof WATCH_KINDS)[number];

/**
 * Bir odamda nechta kuzatuv bo'lishi mumkin.
 * Nega 10: kuzatuv bepul va har biri kuniga bitta xabar berishi mumkin, ya'ni
 * bu son bir odamdan kelib chiqadigan kunlik xabar shifti hamdir.
 */
export const WATCH_MAX = 10;

/**
 * OQ RO'YXAT. Kuzatuvda faqat shu maydonlar saqlanadi va faqat shular solishtiriladi.
 * Ro'yxatda yo'q maydon yozilmaydi ham, o'qilmaydi ham.
 * Terminal joyi bu yerda ataylab yo'q: kuzatuv terminal bo'yicha ishlamaydi.
 *
 * `deal` (ijara/sotuv) ro'yxatda bor, chunki texnika sahifasida bu asosiy filtr: usiz
 * ijara kutgan odamga sotuv e'lonidan xabar ketardi va tugma sahifaning yarmida
 * umuman chizilmasdi.
 */
export const WATCH_FIELDS: Record<WatchKind, readonly string[]> = {
  CARGO: ['fromRegion', 'toRegion', 'truckType'],
  LISTING: ['listingKind', 'regionCode', 'truckType', 'deal'],
};

/**
 * Maydon uchun ruxsat etilgan qiymatlar.
 *
 * FUNKSIYA, jadval emas. Modul darajasidagi jadval REGIONS ni index.ts yuklanib
 * bo'lgunicha o'qib qo'yishi mumkin (aylanma import) va natija jimgina `undefined`
 * bo'lardi. Funksiya ichida o'qilsa eksport tartibi umuman ahamiyatsiz.
 */
const allowed = (f: string): readonly string[] =>
  f === 'truckType' ? TRUCK_TYPES
    : f === 'listingKind' ? LISTING_KINDS
      : f === 'deal' ? DEAL_KINDS
        : REGIONS;

export type WatchParams = Record<string, string>;

/** Kelgan obyektdan faqat oq ro'yxatdagi va ruxsat etilgan qiymatlar. Bo'sh = shart yo'q. */
export function pickParams(kind: WatchKind, raw: Record<string, unknown> | null | undefined): WatchParams {
  const out: WatchParams = {};
  for (const f of WATCH_FIELDS[kind]) {
    const v = typeof raw?.[f] === 'string' ? (raw[f] as string).trim() : '';
    if (v && allowed(f).includes(v)) out[f] = v;
  }
  return out;
}

/** Barqaror kalit: maydonlar tartibi kalitni o'zgartirmaydi (takroriy kuzatuvni topish uchun). */
export const watchKey = (kind: WatchKind, p: WatchParams): string =>
  `${kind}|${WATCH_FIELDS[kind].map((f) => `${f}=${p[f] ?? ''}`).join('&')}`;

export interface WatchRow { id: string; userId: string; kind: string; params: unknown }

/** Hodisa: ikkala ulanish nuqtasi ham shu shaklga keltiriladi. */
export interface WatchEvent {
  kind: WatchKind;
  /** Namuna qator: hech qachon xabar bermaydi. */
  isDemo: boolean;
  /**
   * Bu hodisada kuzatuvi HISOBGA OLINMAYDIGAN odamlar. Ikki guruh:
   *   1) egasi va uning tashkiloti a'zolari (o'z e'lonidan xabar olmasin);
   *   2) xabarni allaqachon boshqa sabab bilan oladiganlar (mashina e'loni, tashkilot
   *      a'zoligi). Ular chiqarib tashlanmasa kuzatuvining bugungi yagona xabari
   *      o'zlariga baribir keladigan xabarga sarflanardi va o'sha kuni faqat kuzatuv
   *      orqali keladigan ikkinchi yukdan bexabar qolardi.
   */
  skipUserIds: readonly string[];
  /** Solishtiriladigan qiymatlar. Ro'yxat bo'lsa ichida bo'lishi yetadi (xizmat hududlari). */
  values: Record<string, string | readonly string[] | null | undefined>;
}

/**
 * Mos kelgan kuzatuvlar.
 *
 * Ikki majburiy qoida AYNAN SHU YERDA, chaqiruvchida emas: ulanish nuqtasi ikkita va
 * uchinchisi qo'shilsa ham qoida o'zi bilan keladi.
 *   1) namuna qator (isDemo) hech qachon xabar bermaydi;
 *   2) skipUserIds dagilarga yuborilmaydi.
 *
 * Bo'sh shart "farqi yo'q" degani: hech narsa tanlamagan odam har yangilikni oladi,
 * lekin kuniga bir marta (chegara chaqiruvchida).
 */
export function matchWatches(e: WatchEvent, rows: readonly WatchRow[]): WatchRow[] {
  if (e.isDemo) return [];
  const skip = new Set(e.skipUserIds);
  return rows.filter((w) => {
    if (w.kind !== e.kind || skip.has(w.userId)) return false;
    const p = pickParams(e.kind, w.params as Record<string, unknown>);
    return WATCH_FIELDS[e.kind].every((f) => {
      const want = p[f];
      if (!want) return true;
      const got = e.values[f];
      // Yuboruvchi kuzov turini ko'rsatmagan bo'lsa har qanday kuzovga mos. Bu mavjud
      // tarqatish qoidasining aynan o'zi: yukda truckType berilmasa shart umuman
      // qo'yilmaydi. Hudud bunday emas: bo'sh hudud "hammasi" deb hisoblansa
      // Toshkentni kutgan odam hududsiz qatordan xabar olardi.
      if (got == null) return f === 'truckType';
      return Array.isArray(got) ? got.includes(want) : got === want;
    });
  });
}

/** Bitta hodisada bitta odamga bitta xabar: mos kuzatuvlar odam bo'yicha yig'iladi. */
export const watchUserIds = (matched: readonly WatchRow[]): string[] =>
  [...new Set(matched.map((w) => w.userId))];

export type WatchSlot = { same: string } | { full: true } | { add: true };

/**
 * Yangi kuzatuv qo'shilsinmi. Uch javob: aynan shunday kuzatuv bor (o'shaning id si),
 * chegara to'lgan, yoki qo'shsa bo'ladi.
 *
 * Takrorni tekshirish chegarani tekshirishdan OLDIN: bo'sh ekranda tugmani ikki marta
 * bosish oddiy hol va u odamning o'ninchi joyini yeb qo'ymasligi kerak.
 */
export function watchSlot(mine: readonly WatchRow[], kind: WatchKind, p: WatchParams): WatchSlot {
  const key = watchKey(kind, p);
  const same = mine.find((w) => w.kind === kind
    && watchKey(kind, pickParams(kind, w.params as Record<string, unknown>)) === key);
  if (same) return { same: same.id };
  if (mine.length >= WATCH_MAX) return { full: true };
  return { add: true };
}
