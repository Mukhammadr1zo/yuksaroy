// YukSaroy domen lug'ati: framework'siz. Prisma enum'lari shu bilan bir xil bo'lishi shart.
import { normalizeQuery, REGION_CENTERS, type SearchLang } from './search';
import { TransitionError } from './transition';

/** Tashkilot ichidagi rollar (Membership.roles). Shaxsiy rollar tashkilotsiz ham bo'ladi (DRIVER, JOB_SEEKER). */
export const ROLES = [
  'CLIENT',            // yuk egasi / logist
  'FORWARDER',         // ekspeditor
  'DECLARANT',         // deklarant
  'CARRIER',           // avtotashuvchi kompaniya
  'DRIVER',            // fura haydovchisi (shaxsiy)
  'TERMINAL_OPERATOR', // terminal xodimi
  'TERMINAL_ADMIN',    // terminal rahbari
  'ASSET_OWNER',       // vagon / teplovoz / shahobcha egasi
  'LOCO_SERVICE',      // lokomotiv (manevr) xizmati
  'JOB_SEEKER',        // ish izlovchi (shaxsiy)
  'PLATFORM_OPERATOR', // platforma operatori (moderatsiya, hujjat)
  'PLATFORM_ADMIN',
] as const;
export type Role = (typeof ROLES)[number];

/** Tashkilotsiz (shaxsiy profil) ishlay oladigan rollar. */
export const PERSONAL_ROLES: readonly Role[] = ['DRIVER', 'JOB_SEEKER'];

/** Tashkilot turi: qaysi rollar mumkinligini belgilaydi. */
export const ORG_KINDS = ['SHIPPER', 'FORWARDER', 'DECLARANT', 'CARRIER', 'TERMINAL', 'ASSET_OWNER', 'LOCO_SERVICE', 'PLATFORM'] as const;
export type OrgKind = (typeof ORG_KINDS)[number];

export const ORG_KIND_ROLES: Record<OrgKind, readonly Role[]> = {
  SHIPPER: ['CLIENT'],
  FORWARDER: ['FORWARDER', 'CLIENT'],
  DECLARANT: ['DECLARANT'],
  CARRIER: ['CARRIER', 'DRIVER'],
  TERMINAL: ['TERMINAL_OPERATOR', 'TERMINAL_ADMIN'],
  ASSET_OWNER: ['ASSET_OWNER'],
  LOCO_SERVICE: ['LOCO_SERVICE'],
  PLATFORM: ['PLATFORM_OPERATOR', 'PLATFORM_ADMIN'],
};

export const KYC_STATUSES = ['NONE', 'PENDING', 'VERIFIED', 'REJECTED'] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

/** OTP qoidalari: bot orqali yuboriladi (SMS emas). */
export const OTP = {
  length: 6,
  ttlSeconds: 5 * 60,
  maxAttempts: 3,
  resendAfterSeconds: 60,
} as const;

/** Parol bilan kirish: uzunlik, urinish soni va qulf muddati (daqiqa). */
export const PASSWORD = {
  minLength: 8,
  maxAttempts: 5,
  lockMinutes: 15,
} as const;

/**
 * Telefon raqami E.164 shakliga keltiriladi: "+998901234567".
 *
 * O'zbekiston raqami uchun "+" shart emas: "901234567" va "998901234567" ham qabul
 * qilinadi, chunki odamlarning katta qismi raqamni shunday yozadi. Boshqa davlat
 * raqami esa "+" bilan yoziladi, aks holda to'qqiz xonali qiymat qaysi davlatniki
 * ekani noma'lum bo'lib qoladi.
 *
 * Nega xalqaro: platforma import, eksport va tranzitni ham qamraydi, ya'ni yuk egasi
 * ham, tashuvchi ham chet eldan bo'lishi mumkin. Kod esa Telegram orqali boradi va u
 * har qanday davlat raqami uchun ishlaydi.
 */
export function normalizePhone(raw: string): string | null {
  const t = raw.trim();
  const d = t.replace(/\D/g, '');
  if (!d) return null;
  if (t.startsWith('+')) {
    // O'zbekiston raqami uzunligi qat'iy: +998 va to'qqiz xonali milliy qism
    if (d.startsWith('998')) return d.length === 12 ? `+998${d.slice(3)}` : null;
    // E.164: davlat kodi noldan boshlanmaydi, umumiy uzunlik 8 dan 15 gacha
    if (d.startsWith('0') || d.length < 8 || d.length > 15) return null;
    return `+${d}`;
  }
  // "+" siz yozilgan qiymat O'zbekiston raqami deb o'qiladi.
  // Uzunlik bo'yicha ajratiladi: "998123456" ning o'zi ham haqiqiy milliy raqam
  // (99 operator kodi, 8-12-34-56), shuning uchun uni prefiks deb kesib bo'lmaydi.
  if (d.length === 9) return `+998${d}`;
  if (d.length === 12 && d.startsWith('998')) return `+998${d.slice(3)}`;
  return null;
}

/**
 * Saqlashdan oldin: tanilgan raqam bitta shaklga keltiriladi, tanilmagani o'zgarmay qoladi.
 *
 * Nega bitta shakl: "90 123 45 67" va "+998901234567" bitta raqam, lekin bazada ikki xil
 * yozilsa ularni solishtirib bo'lmaydi (da'vodagi telefon mosligi, bir raqam ortidagi
 * hisoblar). Nega tanilmagani qoladi: reestrda "71 299-12-34, 71 299-12-35" kabi ikki
 * raqamli yoki eski shakldagi yozuvlar bor, rad etsak yoki o'chirsak ma'lumot yo'qolardi.
 * Bazadagi eski qatorlar aynan shu qoida bilan tuzatilgan (20261006010000 migratsiyasi).
 * Solishtirishda baribir ikkala tomon ham normalizePhone dan o'tadi: tanilmagan yozuvlar
 * o'zgarmay qolgan.
 */
export function storePhone(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  return t ? (normalizePhone(t) ?? t) : null;
}

// ───────────────────────── Katalog (S2) ─────────────────────────

/** Mintaqaviy temir yo'l uzeli (RJU / MTU). Stansiya va shahobcha reestrlari shu kod bilan. */
export const RJUS = ['TAS', 'KOK', 'BUX', 'KUN', 'KAR', 'TER'] as const;
export type Rju = (typeof RJUS)[number];
export const RJU_LABELS: Record<Rju, string> = {
  TAS: 'Toshkent', KOK: "Qo'qon", BUX: 'Buxoro', KUN: "Qo'ng'irot", KAR: 'Qarshi', TER: 'Termiz',
};

/**
 * Terminal turi transport bo'yicha: temir yo'l, avto yoki ikkisi ham.
 * Shahobcha yo'l ham temir yo'l yuk terminali, shuning uchun RAIL ga kiradi.
 * Inshoot turi (yuk saroyi, konteyner maydoni, SVX) endi alohida tur emas, xizmat orqali beriladi.
 */
export const TERMINAL_KINDS = ['RAIL', 'ROAD', 'MULTI'] as const;
export type TerminalKind = (typeof TERMINAL_KINDS)[number];
export const TERMINAL_KIND_LABELS: Record<TerminalKind, string> = {
  RAIL: "Temir yo'l yuk terminali", ROAD: 'Avto yuk terminali', MULTI: "Avto va temir yo'l terminali",
};

export const TERMINAL_STATUSES = ['DRAFT', 'ACTIVE', 'HIDDEN'] as const;
export type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

/** Terminal xizmatlari. LOAD/UNLOAD: asosiy operatsiya, qolganlari qo'shimcha. */
export const SERVICE_CODES = ['LOAD', 'UNLOAD', 'WEIGH', 'STORAGE', 'SVX', 'CONTAINER', 'LAST_MILE', 'SHUNTING'] as const;
export type ServiceCode = (typeof SERVICE_CODES)[number];
export const SERVICE_LABELS: Record<ServiceCode, string> = {
  LOAD: 'Yuklash', UNLOAD: 'Tushirish', WEIGH: 'Tarozi', STORAGE: 'Omborda saqlash', SVX: 'SVX (bojxona ombori)',
  CONTAINER: 'Konteyner bilan ishlash', LAST_MILE: 'Avtoda yetkazib berish', SHUNTING: 'Manevr (teplovoz)',
};
export const OPERATIONS = ['LOAD', 'UNLOAD'] as const;
export type Operation = (typeof OPERATIONS)[number];

export const TARIFF_UNITS = ['PER_TON', 'PER_WAGON', 'PER_OPERATION', 'PER_DAY'] as const;
export type TariffUnit = (typeof TARIFF_UNITS)[number];
export const TARIFF_UNIT_LABELS: Record<TariffUnit, string> = { PER_TON: 'tonna', PER_WAGON: 'vagon', PER_OPERATION: 'operatsiya', PER_DAY: 'kun' };

export const CLAIM_STATUSES = ['NONE', 'PENDING', 'APPROVED', 'REJECTED'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];
/** Terminal va shahobcha da'vosi uchun bir xil holatlar: shu massiv, alohida nom. */
export const TERMINAL_CLAIM_STATUSES = CLAIM_STATUSES;

/** Baho chegaralari: 1..5, matn 1000 belgigacha, terminal javobi 30 kun ichida, o'rtacha minToShow bahodan keyin ko'rsatiladi. */
export const REVIEW = { min: 1, max: 5, maxText: 1000, maxReplyDays: 30, minToShow: 3 } as const;

/** O'rtacha bahoni ko'rsatish qoidasi: kam bahodan "5,0" chiqmasin. count < minToShow bo'lsa avg berilmaydi. */
export function ratingDisplay(r: { avg: number; count: number }): { show: boolean; avg: number | null; count: number } {
  const show = r.count >= REVIEW.minToShow;
  return { show, avg: show ? r.avg : null, count: r.count };
}
/** Ko'rsatish yuzalari (Impression.surface). */
/** 'contact': telefon ochilgani (kim kimning raqamini olgani izi, firibgarlik tekshiruvi uchun) */
export const IMPRESSION_SURFACES = ['list', 'map', 'detail', 'compare', 'bot', 'contact'] as const;
export type ImpressionSurface = (typeof IMPRESSION_SURFACES)[number];

/** Yangi baho qo'shilganda o'rtacha (2 xona) va sonni qayta hisoblash. Chiqarib tashlangan (excluded) baho bu yerga kelmaydi. */
export function recomputeRating(prev: { avg: number; count: number }, newRating: number): { avg: number; count: number } {
  const count = prev.count + 1;
  return { avg: Math.round(((prev.avg * prev.count + newRating) / count) * 100) / 100, count };
}

/** PlatformConfig kalitlari va F1 standart qiymatlari. Foiz: 300 = 3,00 %. */
export const PLATFORM_DEFAULTS = {
  commissionPct: 0,
  commissionPayer: 'TERMINAL' as 'TERMINAL' | 'CLIENT',
  /**
   * Komissiya va'dasidagi chegara: oyiga shuncha bajarilgan buyurtmadan oshganda
   * komissiya kiritiladi. Ommaviy sahifalarda ham shu son yozilgan, shuning uchun
   * sukut aynan 100: matnlar bilan zid ketmasin.
   */
  commissionThresholdOrders: 100,
  slotHoldTtlMin: 10,
  terminalConfirmMin: 30,
  /*
   * Obuna narxi va kunlik raqam soni bu yerda YO'Q: ular tarifda (Plan jadvali).
   * Ilgari narx sozlamada, tarif esa alohida edi va ikkisi bir-biriga zid ketardi:
   * admin tarifni arzonlashtirsa devor baribir sozlamadagi narxni ko'rsatardi.
   * Endi bitta manba. Tarif topilmaganda ishlaydigan qiymat SUBSCRIPTION_FALLBACK da.
   */
  /** Obunasiz odamga nechta raqam bepul (umrbod, kunlik emas). 0 = bepul yo'q, ya'ni hozirgi tartib. */
  phoneRevealFree: 0,
  /** Obunasiz odamga nechta vagon qidiruvi bepul (umrbod, kunlik emas): "birinchisi tekin". */
  wagonSearchFree: 1,
  /** Yordam chatida kuniga nechta savol LLM ga ketadi (tez-tez so'raladigan savollar bepul va cheksiz). */
  helpAskDaily: 30,
  /** Qo'lda to'lov rekvizitlari: karta yoki hisob raqami va qabul qiluvchi. Bo'sh bo'lsa odam murojaat formasiga yuboriladi. */
  payDetails: '' as string,
} as const;
export type PlatformConfigKey = keyof typeof PLATFORM_DEFAULTS;

/**
 * Tarif topilmaganda ishlaydigan qiymatlar. Sozlama EMAS, admin o'zgartirmaydi.
 *
 * Qachon ishlaydi: tariflar paydo bo'lishidan oldin sotib olingan obuna qatorida
 * kunlik son yo'q (limits null); veb API ga yeta olmaganda narxni ko'rsatishi kerak.
 * Ikkisi ham bugungi haqiqiy qiymat, ya'ni eski mijoz uchun hech narsa o'zgarmaydi.
 */
export const SUBSCRIPTION_FALLBACK = { priceMonthSom: 99000, phoneRevealDaily: 50 } as const;

/** Tiyin → "12 670 so'm". */
const CURRENCY_WORD: Record<SearchLang, string> = { uz: "so'm", ru: 'сум', en: 'UZS' };
export function formatSom(tiyin: number, lang: SearchLang = 'uz'): string {
  const som = Math.round(tiyin / 100);
  return `${som.toLocaleString(lang === 'en' ? 'en-US' : 'ru-RU').replace(/[  ]/g, ' ')} ${CURRENCY_WORD[lang]}`;
}

/** "Toshkent-tovar" → "toshkent-tovar". */
export function slugify(s: string): string {
  return s.toLowerCase().replace(/[ʻ'`’]/g, '').normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ───────────────────────── Booking + Orders (S3) ─────────────────────────

export const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const ORDER_STATUS_LABELS: Record<SearchLang, Record<OrderStatus, string>> = {
  uz: {
    PENDING: 'Tasdiq kutilmoqda', CONFIRMED: 'Tasdiqlandi', REJECTED: 'Rad etildi', EXPIRED: 'Muddati o\'tdi',
    IN_PROGRESS: 'Bajarilmoqda', DONE: 'Yakunlandi', CANCELLED: 'Bekor qilindi',
  },
  ru: {
    PENDING: 'Ожидает подтверждения', CONFIRMED: 'Подтверждён', REJECTED: 'Отклонён', EXPIRED: 'Срок истёк',
    IN_PROGRESS: 'В работе', DONE: 'Завершён', CANCELLED: 'Отменён',
  },
  en: {
    PENDING: 'Awaiting confirmation', CONFIRMED: 'Confirmed', REJECTED: 'Rejected', EXPIRED: 'Expired',
    IN_PROGRESS: 'In progress', DONE: 'Completed', CANCELLED: 'Cancelled',
  },
};
/** Yakuniy holatlar: bundan keyin o'tish yo'q. */
export const ORDER_FINAL: readonly OrderStatus[] = ['REJECTED', 'EXPIRED', 'DONE', 'CANCELLED'];

export const BOOKING_STATUSES = ['HOLD', 'CONFIRMED', 'RELEASED'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const SLOT_STATUSES = ['OPEN', 'CLOSED'] as const;
export type SlotStatus = (typeof SLOT_STATUSES)[number];

export const COMMISSION_PAYERS = ['CLIENT', 'TERMINAL'] as const;
export type CommissionPayer = (typeof COMMISSION_PAYERS)[number];

export const DIRECTIONS = ['LOCAL', 'IMPORT', 'EXPORT'] as const;
export type Direction = (typeof DIRECTIONS)[number];
export const DIRECTION_LABELS: Record<Direction, string> = { LOCAL: 'Ichki', IMPORT: 'Import', EXPORT: 'Eksport' };

/** Buyurtma ichidagi hodisalar (OrderStatusHistory.code): holat o'zgarmasdan qayd etiladi. */
export const ORDER_EVENT_CODES = ['ARRIVED', 'WEIGHED', 'LOADED', 'UNLOADED', 'DEPARTED', 'NO_SHOW'] as const;
export type OrderEventCode = (typeof ORDER_EVENT_CODES)[number];
export const ORDER_EVENT_LABELS: Record<SearchLang, Record<OrderEventCode, string>> = {
  uz: { ARRIVED: 'Yetib keldi', WEIGHED: 'Tortildi', LOADED: 'Yuklandi', UNLOADED: 'Tushirildi', DEPARTED: 'Jo\'nadi', NO_SHOW: 'Kelmadi' },
  ru: { ARRIVED: 'Прибыл', WEIGHED: 'Взвешен', LOADED: 'Загружен', UNLOADED: 'Выгружен', DEPARTED: 'Отправлен', NO_SHOW: 'Не явился' },
  en: { ARRIVED: 'Arrived', WEIGHED: 'Weighed', LOADED: 'Loaded', UNLOADED: 'Unloaded', DEPARTED: 'Departed', NO_SHOW: 'No show' },
};

/** O'tishni kim qila oladi. */
export const ACTORS = ['CLIENT', 'TERMINAL', 'SYSTEM', 'ADMIN'] as const;
export type Actor = (typeof ACTORS)[number];

/** Buyurtma holat-mashinasi (6.5). Boshqa o'tish yo'q. */
export const ORDER_TRANSITIONS: readonly { from: OrderStatus; to: OrderStatus; actors: readonly Actor[] }[] = [
  { from: 'PENDING', to: 'CONFIRMED', actors: ['TERMINAL', 'ADMIN'] },
  { from: 'PENDING', to: 'REJECTED', actors: ['TERMINAL', 'ADMIN'] },
  { from: 'PENDING', to: 'EXPIRED', actors: ['SYSTEM'] },
  { from: 'PENDING', to: 'CANCELLED', actors: ['CLIENT', 'ADMIN'] },
  { from: 'CONFIRMED', to: 'IN_PROGRESS', actors: ['TERMINAL', 'ADMIN'] },
  // Terminal: vaqt boshlanguncha sabab bilan (TERMINAL_CANCEL), keyin NO_SHOW kodi bilan. Vaqt sharti
  // bu jadvalda yo'q: u OrderActionsUseCase da (common/stuck-orders.ts dagi chegaralar)
  { from: 'CONFIRMED', to: 'CANCELLED', actors: ['CLIENT', 'TERMINAL', 'ADMIN'] },
  { from: 'IN_PROGRESS', to: 'DONE', actors: ['TERMINAL', 'ADMIN'] },
  // Mijoz faqat qotgan buyurtmani yopadi (pastdagi ORDER_STUCK_DAYS). Vaqt sharti bu jadvalda
  // yo'q: u OrderActionsUseCase.closeStuck da (customerCloseAt) va o'sha tekshiruv MAJBURIY.
  // Jadvalning o'zi mijozga DONE ni istalgan paytda ruxsat beradi, shuning uchun mijoz tomonida
  // canOrderTransition dan tugma chiqarilmasin: UI serverdan kelgan closeAt ga qaraydi
  { from: 'CONFIRMED', to: 'DONE', actors: ['CLIENT'] },
  { from: 'IN_PROGRESS', to: 'DONE', actors: ['CLIENT'] },
];

export { TransitionError } from './transition';

/** O'tish mumkinmi; mumkin bo'lmasa TransitionError. */
export function assertOrderTransition(from: OrderStatus, to: OrderStatus, actor: Actor): void {
  const rows = ORDER_TRANSITIONS.filter((t) => t.from === from && t.to === to);
  if (!rows.length) throw new TransitionError(from, to, actor, 'NOT_ALLOWED');
  if (!rows.some((t) => t.actors.includes(actor))) throw new TransitionError(from, to, actor, 'WRONG_ACTOR');
}

export function canOrderTransition(from: OrderStatus, to: OrderStatus, actor: Actor): boolean {
  try { assertOrderTransition(from, to, actor); return true; } catch { return false; }
}

/** Hodisa (ARRIVED/WEIGHED/…) faqat shu holatlarda qayd etiladi. */
export const ORDER_EVENT_STATUSES: readonly OrderStatus[] = ['CONFIRMED', 'IN_PROGRESS'];

/**
 * Qotib qolgan buyurtma: CONFIRMED yoki IN_PROGRESS da ORDER_STUCK_DAYS kun hech qanday
 * harakat yo'q (holat o'zgarishi ham, "yetib keldi", "yuklandi" kabi hodisa ham). Egasi
 * 2026-10-06 da tanladi: 7 kun. Shundan keyin admin bosh sahifasida ogohlantirish chiqadi
 * va mijoz buyurtmani o'zi yopa oladi, ya'ni baho yoza oladi.
 *
 * Nega: DONE ni baholanadigan tomonning o'zi (terminal) bosadi. Yomon ishlagan terminal
 * uchun eng foydali yo'l tugmani bosmaslik edi: buyurtma abadiy ochiq qolardi, mijoz
 * baho yoza olmasdi va o'rtacha ball doim yuqori ko'rinardi.
 *
 * Bitta ta'rif ikki joyda ishlaydi: api dagi common/stuck-orders.ts (ogohlantirish sanog'i
 * va admin ro'yxatidagi filtr) va mijozning yopish huquqi. Ikkalasi ham qarorni shu yerdagi
 * orderIdleSince ga beradi, bazadagi shart faqat nomzodlarni toraytiradi.
 */
export const ORDER_STUCK_DAYS = 7;
export const ORDER_STUCK_STATUSES: readonly OrderStatus[] = ['CONFIRMED', 'IN_PROGRESS'];

/**
 * Buyurtma qachondan beri harakatsiz: eng oxirgi hodisa, xizmat tugaydigan payt, tasdiq va
 * yaratilgan paytdan eng kechi. Slot hisobga olinadi, chunki kelasi oyga band qilingan
 * buyurtma qotgan emas, u shunchaki o'z kunini kutyapti.
 *
 * Pullik saqlash (storageDays) xizmat vaqtini cho'zadi: yuk omborda turgan kunlarda
 * terminalning hech narsa bosmasligi tabiiy. Ilgari saqlash hisobga olinmasdi va mijoz
 * yuki hali omborda turgan buyurtmani "qotgan" deb yopa olardi; shundan keyin terminal uni
 * yakunlay olmas va saqlash kunlari uchun akt ham, hisob ham tuzilmasdi. storageDays
 * majburiy maydon: chaqiruvchi uni unutib qo'ysa kompilyator to'xtatsin.
 */
export function orderIdleSince(o: { lastActivityAt: Date | null; slotEndsAt: Date | null; confirmedAt: Date | null; createdAt: Date; storageDays: number | null }): Date {
  // Saqlash slot tugagandan boshlanadi; slot bo'lmasa tasdiqdan, u ham bo'lmasa yaratilgan paytdan
  const start = o.slotEndsAt ?? o.confirmedAt ?? o.createdAt;
  const serviceEnd = o.storageDays && o.storageDays > 0 ? new Date(start.getTime() + o.storageDays * 86_400_000) : o.slotEndsAt;
  const ts = [o.lastActivityAt, serviceEnd, o.confirmedAt, o.createdAt].filter((d): d is Date => !!d).map((d) => d.getTime());
  return new Date(Math.max(...ts));
}

/** Mijoz qotgan buyurtmani o'zi yopa oladigan payt. Holat qotishi mumkin bo'lmasa null. */
export function customerCloseAt(status: OrderStatus, idleSince: Date): Date | null {
  return ORDER_STUCK_STATUSES.includes(status) ? new Date(idleSince.getTime() + ORDER_STUCK_DAYS * 86_400_000) : null;
}

/** Slot va SLA qoidalari: sonlar PlatformConfig'dan (bu yerda faqat chegaralar). */
export const BOOKING = {
  /** Bitta hold uchun maksimal uzaytirish soni. */
  maxExtends: 1,
  /** Mijoz tasdiqlangan buyurtmani slotdan necha soat oldin bekor qila oladi. */
  cancelBeforeHours: 12,
  /** Slot oynasi: terminal sozlamasidagi default (6 × 2 soat). */
  defaultWindows: [
    ['08:00', '10:00'], ['10:00', '12:00'], ['12:00', '14:00'],
    ['14:00', '16:00'], ['16:00', '18:00'], ['18:00', '20:00'],
  ] as readonly (readonly [string, string])[],
  defaultCapacity: 3,
  /** Slotlar oldindan necha kunga ochiladi. */
  horizonDays: 30,
} as const;

/** "YS-1041": buyurtma raqami. */
export function formatOrderNo(seq: number): string {
  return `YS-${String(seq).padStart(4, '0')}`;
}

/** "YS-1041" -> "YS-10**": ommaviy sharhlarda buyurtma raqami yashiriladi. */
export function maskOrderNo(no: string): string {
  return no.slice(0, -2) + '**';
}

/** Toshkent vaqtidagi "2026-09-10" + "08:00" → UTC Date. O'zbekiston yil bo'yi UTC+5, yozgi vaqt yo'q. */
export const UZ_UTC_OFFSET_MINUTES = 5 * 60;
export function uzLocalToUtc(localDate: string, hhmm: string): Date {
  const [y, m, d] = localDate.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0) - UZ_UTC_OFFSET_MINUTES * 60_000);
}
/** UTC Date → Toshkent kunidagi "2026-09-10". */
export function uzLocalDate(at: Date): string {
  return new Date(at.getTime() + UZ_UTC_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

/** Oy nomlari: sana odamga ko'rinadigan hamma joyda shu jadvaldan olinadi. */
export const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'] as const;

/** "2026-10-04" -> "4-oktabr". Serverda ham ishlaydi: Intl jadvali kerak emas. */
export function uzDateText(iso: string): string {
  const [, m, d] = iso.split('-');
  const name = UZ_MONTHS[Number(m) - 1];
  return name ? `${Number(d)}-${name}` : iso;
}

// ── Hujjatlar va hisob (S4, M5.1) ──

/** F1 da ikki hujjat: bajarilgan ishlar dalolatnomasi va to'lov uchun hisob. */
export const DOC_KINDS = ['ACT', 'INVOICE'] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export const DOC_KIND_LABELS: Record<DocKind, string> = {
  ACT: 'Bajarilgan ishlar dalolatnomasi',
  INVOICE: "To'lov uchun hisob",
};

export const DOCUMENT_STATUSES = ['READY', 'VOID'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/** Hisob holati (6.7). F1 da onlayn to'lov yo'q: to'lov bank o'tkazmasi bilan, operator belgilaydi. */
export const INVOICE_STATUSES = ['DRAFT', 'ISSUED', 'PAID_OFFLINE', 'OVERDUE', 'VOID'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Qoralama',
  ISSUED: "To'lov kutilmoqda",
  PAID_OFFLINE: "To'landi (bank o'tkazmasi)",
  OVERDUE: 'Muddati o\'tgan',
  VOID: 'Bekor qilingan',
};
export const INVOICE_TRANSITIONS: readonly { from: InvoiceStatus; to: InvoiceStatus }[] = [
  { from: 'DRAFT', to: 'ISSUED' },
  { from: 'ISSUED', to: 'PAID_OFFLINE' },
  { from: 'ISSUED', to: 'OVERDUE' },
  { from: 'ISSUED', to: 'VOID' },
  { from: 'OVERDUE', to: 'PAID_OFFLINE' },
  { from: 'OVERDUE', to: 'VOID' },
  { from: 'DRAFT', to: 'VOID' },
];
export function canInvoiceTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return INVOICE_TRANSITIONS.some((t) => t.from === from && t.to === to);
}

export const INVOICE = {
  /** Hisob berilgandan keyin to'lov muddati. */
  dueDays: 5,
} as const;

/** "AKT-0007" */
export function formatActNo(seq: number): string {
  return `AKT-${String(seq).padStart(4, '0')}`;
}
/** "HF-0007" */
export function formatInvoiceNo(seq: number): string {
  return `HF-${String(seq).padStart(4, '0')}`;
}

// ── Hududlar (joylashuv) ──
// Stansiya emas, viloyat: platforma temir yo'l infratuzilmasiga emas, hududga bog'lanadi.
export const REGIONS = [
  'UZ-TK', 'UZ-TO', 'UZ-SI', 'UZ-JI', 'UZ-SA', 'UZ-BU', 'UZ-NW', 'UZ-QA',
  'UZ-SU', 'UZ-XO', 'UZ-QR', 'UZ-AN', 'UZ-NG', 'UZ-FA',
] as const;
export type RegionCode = (typeof REGIONS)[number];
export const REGION_LABELS: Record<RegionCode, string> = {
  'UZ-TK': 'Toshkent shahri',
  'UZ-TO': 'Toshkent viloyati',
  'UZ-SI': 'Sirdaryo viloyati',
  'UZ-JI': 'Jizzax viloyati',
  'UZ-SA': 'Samarqand viloyati',
  'UZ-BU': 'Buxoro viloyati',
  'UZ-NW': 'Navoiy viloyati',
  'UZ-QA': 'Qashqadaryo viloyati',
  'UZ-SU': 'Surxondaryo viloyati',
  'UZ-XO': 'Xorazm viloyati',
  'UZ-QR': "Qoraqalpog'iston Respublikasi",
  'UZ-AN': 'Andijon viloyati',
  'UZ-NG': 'Namangan viloyati',
  'UZ-FA': "Farg'ona viloyati",
};

/** Ikki nuqta orasidagi masofa, km (haversine). Xaritadan radius bo'yicha qidiruv uchun. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Ikki viloyat markazi orasidagi taxminiy masofa, km.
 *
 * Nega markaz: yuk so'rovida faqat "qaysi viloyatdan qaysi viloyatga" beriladi, aniq manzil yo'q.
 * Yo'lning haqiqiy uzunligi emas, taqqoslash uchun asos: taklif narxini km ga bo'lib ko'rish
 * shu songa tayanadi. Bir viloyat ichidagi yo'nalish yoki noma'lum kod = null, chunki
 * "0 km" hech qanday qarorni qo'llab-quvvatlamaydi va so'm/km ni cheksizga aylantiradi.
 */
export function regionRouteKm(from: string | null | undefined, to: string | null | undefined): number | null {
  const a = REGION_CENTERS[from as RegionCode], b = REGION_CENTERS[to as RegionCode];
  return a && b && from !== to ? Math.round(distanceKm(a.lat, a.lng, b.lat, b.lng)) : null;
}

// ── Yordamchi qidiruv (lug'at asosidagi tahlil) ──
export * from './search';

// ── Tashkilot yorliqlari (uch tilda) va slug ──

export const ORG_KIND_LABELS: Record<SearchLang, Record<OrgKind, string>> = {
  uz: { SHIPPER: 'Yuk egasi', FORWARDER: 'Ekspeditor', DECLARANT: 'Deklarant', CARRIER: 'Avtotashuvchi', TERMINAL: 'Terminal', ASSET_OWNER: 'Texnika egasi', LOCO_SERVICE: 'Lokomotiv xizmati', PLATFORM: 'Platforma' },
  ru: { SHIPPER: 'Грузовладелец', FORWARDER: 'Экспедитор', DECLARANT: 'Декларант', CARRIER: 'Автоперевозчик', TERMINAL: 'Терминал', ASSET_OWNER: 'Владелец техники', LOCO_SERVICE: 'Локомотивный сервис', PLATFORM: 'Платформа' },
  en: { SHIPPER: 'Shipper', FORWARDER: 'Forwarder', DECLARANT: 'Customs broker', CARRIER: 'Road carrier', TERMINAL: 'Terminal', ASSET_OWNER: 'Equipment owner', LOCO_SERVICE: 'Locomotive service', PLATFORM: 'Platform' },
};

export const KYC_STATUS_LABELS: Record<SearchLang, Record<KycStatus, string>> = {
  uz: { NONE: 'Tasdiqlanmagan', PENDING: 'Tekshiruvda', VERIFIED: 'Tasdiqlangan', REJECTED: 'Rad etilgan' },
  ru: { NONE: 'Не подтверждено', PENDING: 'На проверке', VERIFIED: 'Подтверждено', REJECTED: 'Отклонено' },
  en: { NONE: 'Not verified', PENDING: 'Under review', VERIFIED: 'Verified', REJECTED: 'Rejected' },
};

export const CLAIM_STATUS_LABELS: Record<SearchLang, Record<ClaimStatus, string>> = {
  uz: { NONE: "Da'vo yo'q", PENDING: "Da'vo tekshiruvda", APPROVED: 'Egasi tasdiqlangan', REJECTED: "Da'vo rad etilgan" },
  ru: { NONE: 'Без заявки', PENDING: 'Заявка на проверке', APPROVED: 'Владелец подтверждён', REJECTED: 'Заявка отклонена' },
  en: { NONE: 'Unclaimed', PENDING: 'Claim under review', APPROVED: 'Owner confirmed', REJECTED: 'Claim rejected' },
};

/** Tashkilot slug'i: kirill ham lotinga o'giriladi ("Ташкент Логистик" -> "tashkent-logistik"), bo'sh bo'lsa 'tashkilot'. */
export function orgSlug(name: string): string {
  return slugify(normalizeQuery(name)) || 'tashkilot';
}

// ── E'lonlar (texnika va avtotransport) ──
export * from './listing';

// ── Shoshilinch xizmat so'rovlari (/urgent) ──

export const URGENT_KINDS = ['LOCO_CALL', 'WAGON_REPAIR', 'CRANE', 'OTHER'] as const;
export type UrgentKind = (typeof URGENT_KINDS)[number];
export const URGENT_KIND_LABELS: Record<SearchLang, Record<UrgentKind, string>> = {
  uz: { LOCO_CALL: 'Teplovoz chaqirish', WAGON_REPAIR: "Vagon ta'miri", CRANE: 'Kran', OTHER: 'Boshqa' },
  ru: { LOCO_CALL: 'Вызов тепловоза', WAGON_REPAIR: 'Ремонт вагона', CRANE: 'Кран', OTHER: 'Другое' },
  en: { LOCO_CALL: 'Locomotive call', WAGON_REPAIR: 'Wagon repair', CRANE: 'Crane', OTHER: 'Other' },
};

export const URGENT_STATUSES = ['OPEN', 'AWARDED', 'CLOSED', 'CANCELLED'] as const;
export type UrgentStatus = (typeof URGENT_STATUSES)[number];
export const URGENT_OFFER_STATUSES = ['SENT', 'AWARDED', 'DECLINED'] as const;
export type UrgentOfferStatus = (typeof URGENT_OFFER_STATUSES)[number];

/** "UR-1001": shoshilinch so'rov raqami (urgent_no_seq, 1001 dan boshlanadi). */
export function formatUrgentNo(seq: number): string {
  return `UR-${seq}`;
}

// ── Yordamchi LLM chegaralari ──

/** Lug'at parseri ishonchi shu chegaradan past bo'lsa LLM chaqiriladi; kunlik limitlar foydalanuvchi va mehmon uchun. */
export const YORDAMCHI = { llmThreshold: 0.6, guestDaily: 10, userDaily: 100, timeoutMs: 8000, maxTokens: 512 } as const;



// ───────────────────────── Xizmatlar markazi va yuk bozori ─────────────────────────

/** Xizmatlar markazi: kim xizmat ko'rsatadi. Tashkilot turi emas, odam yoki firma o'zini shu bilan e'lon qiladi. */
export const SERVICE_TYPES = ['FORWARDER', 'CASHIER', 'DOCS'] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];
export const SERVICE_TYPE_LABELS: Record<SearchLang, Record<ServiceType, string>> = {
  uz: { FORWARDER: 'Ekspeditor', CASHIER: 'Tovar kassiri', DOCS: "Hujjat to'ldirish" },
  ru: { FORWARDER: 'Экспедитор', CASHIER: 'Товарный кассир', DOCS: 'Оформление документов' },
  en: { FORWARDER: 'Freight forwarder', CASHIER: 'Freight cashier', DOCS: 'Document preparation' },
};

/**
 * To'lov sharti: yuk egasi qanday to'laydi. Tashuvchi narxni aynan shunga qarab aytadi,
 * shuning uchun bu maydon telefonda so'raladigan birinchi savolni yopadi.
 *
 * Yorliqlar JSON ga emas, shu yerga yozildi: ularni API ham (Telegram xabari oluvchining
 * tilida ketadi), veb ham bitta manbadan oladi.
 */
export const PAYMENT_TERMS = ['CASH', 'TRANSFER', 'TRANSFER_VAT'] as const;
export type PaymentTerm = (typeof PAYMENT_TERMS)[number];
export const PAYMENT_TERM_LABELS: Record<SearchLang, Record<PaymentTerm, string>> = {
  uz: { CASH: 'Naqd', TRANSFER: "O'tkazma", TRANSFER_VAT: "O'tkazma, qo'shilgan qiymat solig'i bilan" },
  ru: { CASH: 'Наличные', TRANSFER: 'Перечисление', TRANSFER_VAT: 'Перечисление с НДС' },
  en: { CASH: 'Cash', TRANSFER: 'Bank transfer', TRANSFER_VAT: 'Bank transfer with VAT' },
};

/** Telegram xabari oluvchining tilida ketadi, shuning uchun "mashina" so'zi ham shu yerda. */
export const TRUCKS_WORD: Record<SearchLang, string> = { uz: 'ta mashina', ru: 'маш.', en: 'trucks' };

/**
 * Bozor so'rovi: xizmat so'rovi (SERVICE) va yuk e'loni (CARGO) bir xil hayot siklida
 * yashaydi: ochiq -> taklif tanlandi -> yopiq. Shoshilinch so'rovlar (/urgent) bilan bir xil
 * shakl, lekin maydonlari boshqa (yo'nalish, og'irlik, sana), shuning uchun alohida jadval.
 *
 * DONE va CLOSED ataylab ikki xil: CLOSED "boshqa taklif kerak emas" degani (ish bo'lmasa
 * ham bosiladi), DONE esa "ish haqiqatan bajarildi". Bajarilgan ish soni ishonch belgisi,
 * shuning uchun u ikki ma'noli tugmadan sanalmaydi.
 */
export const MARKET_BOARDS = ['SERVICE', 'CARGO'] as const;
export type MarketBoard = (typeof MARKET_BOARDS)[number];
export const MARKET_STATUSES = ['OPEN', 'AWARDED', 'DONE', 'CLOSED', 'CANCELLED'] as const;
export type MarketStatus = (typeof MARKET_STATUSES)[number];
export const MARKET_OFFER_STATUSES = ['SENT', 'AWARDED', 'DECLINED'] as const;
export type MarketOfferStatus = (typeof MARKET_OFFER_STATUSES)[number];
export const MARKET = {
  descriptionMax: 2000,
  titleMax: 120,
  /** Bir so'rovga bir ta'minotchidan bitta taklif. */
  offersPerRequestPerProvider: 1,
  requestsPerHour: 5,
  offersPerHour: 20,
  listTake: 100,
  /** Ochiq so'rov shuncha kundan keyin ro'yxatdan tushadi (yopilmaydi, faqat ko'rinmaydi). */
  staleDays: 30,
} as const;

/** Vagon raqami: 7 yoki 8 raqam (oxirgisi nazorat raqami). Faqat raqamlar saqlanadi. */
export const WAGON = { noMinDigits: 7, noMaxDigits: 8 } as const;
export function normalizeWagonNo(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  return digits.length >= WAGON.noMinDigits && digits.length <= WAGON.noMaxDigits ? digits : null;
}

/**
 * Matndan vagon raqamlari: har qanday raqam bo'lmagan belgi ajratadi (vergul, yangi
 * qator, probel), shuning uchun odam ro'yxatni qayerdan nusxalasa ham ishlaydi.
 * Noto'g'rilari alohida qaytadi: ular qidirilmaydi, lekin odam nimasi tushib
 * qolganini ko'rishi kerak.
 */
export function parseWagonNos(text: string): { ok: string[]; bad: string[] } {
  const ok: string[] = [];
  const bad: string[] = [];
  const seen = new Set<string>();
  for (const part of text.split(/\D+/)) {
    if (!part) continue;
    // "01234567" va "1234567" serverda bitta vagon: ro'yxatda ham bitta bo'lsin
    const key = part.replace(/^0+(?=\d)/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    (normalizeWagonNo(part) ? ok : bad).push(part);
  }
  return { ok, bad };
}

// Kuzatuv qoidalari.
export * from './watch';

/**
 * Shikoyat qilinadigan obyektlar.
 *
 * Nomlash: umumiy to'rttasi (listing, terminal, service, request) telefon ochish
 * yo'lidagi turlar bilan ataylab bir xil atalgan, ya'ni bitta tushuncha ikki joyda
 * ikki xil atalmaydi. Farq ikkitomonlama: 'order' faqat shu yerda bor (telefon ochish
 * yo'lida buyurtma yo'q), 'org' va 'offer' esa faqat u yerda - ular ustida shikoyat
 * tugmasi chizilmaydi.
 */
export const REPORT_TARGETS = ['listing', 'terminal', 'service', 'request', 'order'] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_TARGET_LABELS: Record<SearchLang, Record<ReportTarget, string>> = {
  uz: { listing: "E'lon", terminal: 'Terminal', service: 'Xizmat sahifasi', request: "So'rov", order: 'Buyurtma' },
  ru: { listing: 'Объявление', terminal: 'Терминал', service: 'Страница услуги', request: 'Запрос', order: 'Заказ' },
  en: { listing: 'Listing', terminal: 'Terminal', service: 'Service page', request: 'Request', order: 'Order' },
};

/**
 * Sabab kodi. Ro'yxat qisqa: uzun ro'yxatdan odam baribir "Boshqa" ni tanlaydi.
 *
 * COPYRIGHT OTHER dan oldin turadi, chunki "Boshqa" doim oxirgi variant bo'lishi
 * kerak: ro'yxat oxirida turmasa odam uni to'liq o'qimay tanlab yuboradi. O'z surati
 * yoki matni ruxsatsiz ishlatilganini ko'rgan odamga shu qatorgacha alohida yo'l
 * yo'q edi, "Boshqa" esa panelda tartiblashga yaramaydi.
 */
export const REPORT_REASONS = ['SPAM', 'WRONG', 'PHONE', 'FRAUD', 'COPYRIGHT', 'OTHER'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<SearchLang, Record<ReportReason, string>> = {
  uz: { SPAM: 'Reklama yoki takroriy', WRONG: "Ma'lumot noto'g'ri", PHONE: 'Telefon javob bermaydi', FRAUD: "Aldov yoki oldindan pul so'rash", COPYRIGHT: 'Mualliflik huquqi buzilgan', OTHER: 'Boshqa' },
  ru: { SPAM: 'Реклама или дубль', WRONG: 'Неверные данные', PHONE: 'Телефон не отвечает', FRAUD: 'Обман или предоплата', COPYRIGHT: 'Нарушены авторские права', OTHER: 'Другое' },
  en: { SPAM: 'Spam or duplicate', WRONG: 'Wrong details', PHONE: 'Phone does not answer', FRAUD: 'Scam or upfront payment', COPYRIGHT: 'Copyright infringed', OTHER: 'Other' },
};

export const REPORT_STATUSES = ['NEW', 'RESOLVED', 'DISMISSED'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_STATUS_LABELS: Record<SearchLang, Record<ReportStatus, string>> = {
  uz: { NEW: 'Yangi', RESOLVED: 'Hal qilindi', DISMISSED: "O'rinsiz" },
  ru: { NEW: 'Новая', RESOLVED: 'Решена', DISMISSED: 'Отклонена' },
  en: { NEW: 'New', RESOLVED: 'Resolved', DISMISSED: 'Dismissed' },
};

/** Matn chegaralari va bitta odamning bir soatdagi eng ko'p shikoyati. */
export const REPORT = { textMin: 10, textMax: 1000, perHour: 5 } as const;
export * from './owner-kind';

/**
 * Reklama joylari. Ikki xil: sahifaning ikki yonidagi ustunlar va tafsilot
 * sahifasidagi yon blok.
 *
 * site-left va site-right: HAR BIR ochiq sahifada, matndan tashqarida, uzun bo'yli
 * banner (tashqi brendlar uchun). Ular matnni siqmaydi, shuning uchun faqat keng
 * ekranda, mazmun ustuni yonida bo'sh joy bo'lganda chiziladi. Tor ekranda
 * chizilmaydi: mazmunni banner uchun siqish katalogni buzardi.
 *
 * terminal-aside va listing-aside: tafsilot sahifasidagi haqiqiy yon ustun ichida,
 * har ekranda ko'rinadi.
 *
 * site-bottom: pastda yotgan past banner, TOR EKRANDA HAM chiqadi. Yon ustunlar tor
 * ekranda chizilmaydi, ya'ni telefonda sotiladigan joy umuman yo'q edi; shu banner
 * aynan shuning uchun bor va uning ichida sarlavha chizilmaydi (faqat rasm).
 *
 * Nomi "slot" emas: bu so'z bron oynasi uchun band. Inglizcha "spot" ham o'sha bron
 * oynasining tarjimasi, shuning uchun u ham ishlatilmaydi.
 *
 * Tartib muhim: panelda tanlash ro'yxati aynan shu tartibda chiziladi, shuning uchun
 * sayt bo'ylab sotiladigan uchta joy ro'yxat boshida birga turadi.
 */
export const AD_PLACEMENTS = ['site-left', 'site-right', 'site-bottom', 'terminal-aside', 'listing-aside'] as const;
/**
 * Pastki banner. Alohida nomlangan, chunki uning javob shakli boshqa: sarlavhasiz,
 * lekin uchta vaqt bilan.
 */
export const AD_BOTTOM = 'site-bottom';
/**
 * Pastki bannerning sukut vaqtlari, egasi tasdiqlagan: 8 soniyada chiqadi, 15 soniya
 * turadi, yopilgach 12 soat qayta ko'rinmaydi (ya'ni kuniga ko'pi bilan ikki marta).
 *
 * Bazadagi ustunlarning sukut qiymati ham aynan shu: qator qo'lda to'ldirilmasa ham
 * banner shu o'lchov bilan ishlaydi.
 */
export const AD_BOTTOM_DEFAULTS = { delaySec: 8, showSec: 15, quietHours: 12 } as const;
/** Ikki yon ustun: bitta so'rovda olinadi va bitta komponent chizadi. */
export const AD_RAILS = ['site-left', 'site-right'] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];

export const AD_STATUSES = ['DRAFT', 'ACTIVE'] as const;
export type AdStatus = (typeof AD_STATUSES)[number];

/**
 * Obuna nimani ochadi.
 *
 * Bitta bayroq o'rniga ro'yxat: telefon raqami va vagon qidiruvi alohida narxlanadi,
 * lekin bitta obuna ikkalasini ham ochishi mumkin (eski obunalar aynan shunday).
 */
export const SUBSCRIPTION_GRANTS = ['PHONE', 'WAGON'] as const;
export type SubscriptionGrant = (typeof SUBSCRIPTION_GRANTS)[number];

/**
 * Tarif ichida admin belgilay oladigan chegaralar.
 *
 * Oq ro'yxat: admin ixtiyoriy nom yozib yangi imkoniyat "o'ylab topa" olmaydi. Faqat
 * kod chindan tekshiradigan chegara shu yerda turadi. Hozir bittasi: obunachining
 * kunlik telefon ochish soni. Kod o'qimaydigan kalit qo'shilsa u ekranda son bo'lib
 * ko'rinardi-yu hech narsani cheklamasdi.
 */
export const PLAN_LIMIT_KEYS = ['phoneRevealDaily'] as const;
export type PlanLimitKey = (typeof PLAN_LIMIT_KEYS)[number];

/** Tarif nomi va tavsif satrlari uch tilda: admin yozgan matnni tarjima tizimi tarjima qila olmaydi. */
export const PLAN_LOCALES = ['uz', 'ru', 'en'] as const;

/**
 * Reklama qaysi tilda chiqishi. Ro'yxat tarifdagisi bilan bitta: sayt uchta tilda,
 * to'rtinchi til qo'shilsa ikkalasiga ham birdan qo'shilishi kerak.
 */
export const AD_LOCALES = PLAN_LOCALES;
