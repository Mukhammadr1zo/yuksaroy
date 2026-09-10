// YukSaroy domen lug'ati: framework'siz. Prisma enum'lari shu bilan bir xil bo'lishi shart.
import { normalizeQuery, type SearchLang } from './search';
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

/** O'zbekiston telefon raqamini E.164 ga normalizatsiya: 90 123 45 67 → +998901234567. */
export function normalizeUzPhone(raw: string): string | null {
  const d = raw.replace(/\D/g, '');
  const local = d.startsWith('998') ? d.slice(3) : d;
  if (local.length !== 9) return null;
  return `+998${local}`;
}

// ───────────────────────── Katalog (S2) ─────────────────────────

/** Mintaqaviy temir yo'l uzeli (RJU / MTU). Stansiya va shahobcha reestrlari shu kod bilan. */
export const RJUS = ['TAS', 'KOK', 'BUX', 'KUN', 'KAR', 'TER'] as const;
export type Rju = (typeof RJUS)[number];
export const RJU_LABELS: Record<Rju, string> = {
  TAS: 'Toshkent', KOK: "Qo'qon", BUX: 'Buxoro', KUN: "Qo'ng'irot", KAR: 'Qarshi', TER: 'Termiz',
};

export const TERMINAL_KINDS = ['YARD', 'CONTAINER', 'LC', 'SVX'] as const;
export type TerminalKind = (typeof TERMINAL_KINDS)[number];
export const TERMINAL_KIND_LABELS: Record<TerminalKind, string> = {
  YARD: 'Yuk saroyi', CONTAINER: 'Konteyner terminali', LC: 'Logistika markazi', SVX: 'Vaqtinchalik saqlash ombori',
};

export const TERMINAL_STATUSES = ['DRAFT', 'ACTIVE', 'HIDDEN'] as const;
export type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

/** Terminal xizmatlari. LOAD/UNLOAD: asosiy operatsiya, qolganlari qo'shimcha. */
export const SERVICE_CODES = ['LOAD', 'UNLOAD', 'WEIGH', 'STORAGE', 'SVX', 'CONTAINER', 'LAST_MILE', 'SHUNTING'] as const;
export type ServiceCode = (typeof SERVICE_CODES)[number];
export const SERVICE_LABELS: Record<ServiceCode, string> = {
  LOAD: 'Yuklash', UNLOAD: 'Tushirish', WEIGH: 'Tarozi', STORAGE: 'Omborda saqlash', SVX: 'SVX (bojxona ombori)',
  CONTAINER: 'Konteyner bilan ishlash', LAST_MILE: 'Oxirgi milya (avto)', SHUNTING: 'Manevr (teplovoz)',
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

/** Premium narxi (so'm, oyiga, bitta e'lon): marketing ROI kalkulyatori uchun; keyin PlatformConfig ga ko'chadi. */
export const PRICING = { premiumPerListingPerMonthSom: 149000, currency: 'UZS' } as const;

/** Premium: oylar soni -> tiyin (bitta e'lon). */
export function premiumAmountTiyin(months: number): number {
  return months * PRICING.premiumPerListingPerMonthSom * 100;
}

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
  slotHoldTtlMin: 10,
  terminalConfirmMin: 30,
  docSlaHours: 4,
} as const;
export type PlatformConfigKey = keyof typeof PLATFORM_DEFAULTS;

/** Tiyin → "12 670 so'm". */
export function formatSom(tiyin: number): string {
  const som = Math.round(tiyin / 100);
  return `${som.toLocaleString('ru-RU').replace(/ /g, ' ')} so'm`;
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
  { from: 'CONFIRMED', to: 'CANCELLED', actors: ['CLIENT', 'TERMINAL', 'ADMIN'] }, // terminal: NO_SHOW kodi bilan
  { from: 'IN_PROGRESS', to: 'DONE', actors: ['TERMINAL', 'ADMIN'] },
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

// ── Yordamchi qidiruv (lug'at asosidagi tahlil) ──
export * from './search';

// ── Tashkilot yorliqlari (uch tilda) va slug ──

export const ORG_KIND_LABELS: Record<SearchLang, Record<OrgKind, string>> = {
  uz: { SHIPPER: 'Yuk egasi', FORWARDER: 'Ekspeditor', DECLARANT: 'Deklarant', CARRIER: 'Avtotashuvchi', TERMINAL: 'Terminal', ASSET_OWNER: 'Texnika yoki shahobcha egasi', LOCO_SERVICE: 'Lokomotiv xizmati', PLATFORM: 'Platforma' },
  ru: { SHIPPER: 'Грузовладелец', FORWARDER: 'Экспедитор', DECLARANT: 'Декларант', CARRIER: 'Автоперевозчик', TERMINAL: 'Терминал', ASSET_OWNER: 'Владелец техники или пути', LOCO_SERVICE: 'Локомотивный сервис', PLATFORM: 'Платформа' },
  en: { SHIPPER: 'Shipper', FORWARDER: 'Forwarder', DECLARANT: 'Customs broker', CARRIER: 'Road carrier', TERMINAL: 'Terminal', ASSET_OWNER: 'Equipment or siding owner', LOCO_SERVICE: 'Locomotive service', PLATFORM: 'Platform' },
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

// ── Yordamchi LLM chegaralari va ochiq API ──

/** Lug'at parseri ishonchi shu chegaradan past bo'lsa LLM chaqiriladi; kunlik limitlar foydalanuvchi va mehmon uchun. */
export const YORDAMCHI = { llmThreshold: 0.6, guestDaily: 10, userDaily: 100, timeoutMs: 8000, maxTokens: 512 } as const;

/** Ochiq o'qish API (/v1/public): kontrakt versiyasi va IP bo'yicha daqiqalik limit. */

