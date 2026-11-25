import { REGION_LABELS, type RegionCode } from '@yuksaroy/domain';
import { clip, esc } from '../../common/telegram';
import type { ActivityCategory, ActivityEvent } from './activity.types';
import { fields, no, q, s, som, somRaw, why } from './text';

/*
 * Har amal uchun bitta yozuv: toifa, belgi, matn va OQ RO'YXATdagi faktlar.
 * Xabarga meta dan FAQAT shu yerda nomlangan kalitlar tushadi: umumiy dump yo'q, noma'lum amal
 * uchun ham. Parol, kod, token, payRef, chat va murojaat matni bu yerda yo'q va bo'lmaydi.
 */
export type RefType = 'Listing' | 'Terminal' | 'Organization' | 'User' | 'Order' | 'MarketRequest' | 'UrgentRequest';

export interface Facts {
  m: Record<string, unknown>;
  e: ActivityEvent;
  /** Yozuv nomi (e'lon sarlavhasi, tashkilot nomi...); topilmasa undefined. Matn xom, q() o'raydi. */
  ref: (type: RefType, id: unknown) => string | undefined;
}

export interface CatalogEntry {
  cat: ActivityCategory;
  emoji: string | ((f: Facts) => string);
  label: string | ((f: Facts) => string);
  /** Falsy qiymatlar tashlanadi, qolgani ", " bilan bog'lanadi. */
  facts?: (f: Facts) => (string | false | null | undefined)[];
  /** Admin yo'li; webUrl() mutlaq qiladi. */
  href?: (f: Facts) => string | undefined;
  channel?: 'web' | 'miniapp' | 'bot';
}

const enc = encodeURIComponent;
const E = (f: Facts) => f.e.entityId;
const on = (v: unknown) => v === true;
const n0 = (v: unknown) => (typeof v === 'number' && v > 0 ? v : 0);
/** "Nomi" qo'shtirnoqda yoki yo'q. */
const nm = (f: Facts, t: RefType, id: unknown) => q(f.ref(t, id));
/** Obyekt sahifasi: /admin/<base>/<entityId>. */
const adm = (base: string) => (f: Facts) => (E(f) ? `${base}/${enc(E(f)!)}` : undefined);
/** Matn qiymati ro'yxati (rollar). */
const list = (v: unknown) => (Array.isArray(v) ? s(v.filter((x) => typeof x === 'string').join(', '), 60) : undefined);

const VIA: Record<string, string> = { otp: 'Telegram kodi bilan', google: 'Google orqali', password: 'parol bilan', password_reset: 'parolni tiklab', telegram_webapp: 'Mini App orqali' };
const REASON: Record<string, string> = {
  BAD_CREDENTIALS: "parol noto'g'ri yoki raqam topilmadi", OTP_WRONG: "kod noto'g'ri", OTP_EXPIRED: 'kod eskirgan', OTP_LOCKED: 'kod urinishlari tugadi',
  OTP_NOT_FOUND: 'kod topilmadi', LOGIN_LOCKED: 'hisob vaqtincha qulflandi', GOOGLE_INVALID: 'Google tasdiqlamadi',
  TG_INITDATA_INVALID: 'Mini App imzosi yaroqsiz', TG_INITDATA_EXPIRED: 'Mini App imzosi yaroqsiz',
};
const via = (f: Facts) => (typeof f.m.via === 'string' ? (VIA[f.m.via] ?? s(f.m.via, 30)) : undefined);
const sent = (f: Facts) => (f.m.sent === true ? 'kod Telegramga yuborildi' : f.m.sent === false ? "bot ulanmagan, bot havolasi berildi" : undefined);

const STATUS: Record<string, string> = { PENDING: 'moderatsiyaga tushdi', ACTIVE: "saytda ko'rinadi" };
const KIND: Record<string, string> = {
  SHIPPER: 'yuk egasi', FORWARDER: 'ekspeditor', DECLARANT: 'deklarant', CARRIER: 'tashuvchi', TERMINAL: 'terminal', ASSET_OWNER: 'texnika egasi', LOCO_SERVICE: 'lokomotiv xizmati',
};
const REVEAL_WORD: Record<string, string> = { listing: "e'lon", terminal: 'terminal', org: 'tashkilot', service: 'xizmat', request: "so'rov", offer: 'taklif' };
const REVEAL_REF: Record<string, RefType> = { listing: 'Listing', terminal: 'Terminal', org: 'Organization' };
const REVEAL_HREF: Record<string, string> = { listing: '/admin/listings', terminal: '/admin/terminals', org: '/admin/orgs' };
const LEVEL: Record<string, string> = { owner: 'ega', moderator: 'moderator' };

/** Buyurtma raqami: meta da bo'lsa shu, bo'lmasa yozuv nomidan. */
const orderNo = (f: Facts) => (s(f.m.no, 30) ? String(f.m.no) : f.ref('Order', E(f)));
const ordHref = (f: Facts) => {
  const n = orderNo(f);
  return n ? `/admin/orders?open=${enc(n)}` : '/admin/orders';
};
const mktHref = (f: Facts) => {
  const n = f.ref('MarketRequest', E(f));
  return n ? `/admin/market?q=${enc(n)}` : '/admin/market';
};
const urgHref = (f: Facts) => {
  const n = s(f.m.no, 30) ? String(f.m.no) : f.ref('UrgentRequest', E(f));
  return n ? `/admin/urgent?q=${enc(n)}` : '/admin/urgent';
};
const subHref = (f: Facts) => (E(f) ? `/admin/subscriptions?open=${enc(E(f)!)}` : '/admin/subscriptions');
const modHref = (tab: string) => (f: Facts) => `/admin/moderation?tab=${tab}${E(f) ? `#${enc(E(f)!)}` : ''}`;
const userHref = (f: Facts) => (f.e.actorId ? `/admin/users/${enc(f.e.actorId)}` : undefined);

/** Bir xil tuzilishli amallar oilasi: kalit -> [belgi, matn, qo'shimcha faktlar]. */
function family(cat: ActivityCategory, rows: Record<string, [string, string]>, extra: Pick<CatalogEntry, 'facts' | 'href'>): Record<string, CatalogEntry> {
  return Object.fromEntries(Object.entries(rows).map(([k, [emoji, label]]) => [k, { cat, emoji, label, ...extra }]));
}

const ok2 = (f: Facts, a: string, b: string) => (on(f.m.approve) ? a : b);

export const CATALOG: Record<string, CatalogEntry> = {
  // ── 2.1 Kirish, ro'yxatdan o'tish, hisob ──
  'auth.login': {
    cat: 'login',
    emoji: (f) => (on(f.m.isNew) ? '🆕' : '🔐'),
    label: (f) => (on(f.m.isNew) ? "Ro'yxatdan o'tdi" : 'Kirdi'),
    facts: (f) => [via(f), on(f.m.phoneLinked) && "telefon raqamini bog'ladi"],
  },
  'auth.telegram_webapp': {
    cat: 'login',
    emoji: (f) => (on(f.m.isNew) ? '🆕' : '📱'),
    label: (f) => (on(f.m.isNew) ? "Ro'yxatdan o'tdi (Telegram Mini App)" : 'Telegram Mini App orqali kirdi'),
    facts: (f) => [on(f.m.isNew) && "telefon hali bog'lanmagan", s(f.m.startParam, 40) && `boshlash: ${s(f.m.startParam, 40)}`],
    channel: 'miniapp',
  },
  'auth.telegram.link': {
    cat: 'login',
    emoji: (f) => (on(f.m.isNew) ? '🆕' : '🔗'),
    label: (f) => (on(f.m.isNew) ? "Ro'yxatdan o'tdi (Telegram bot)" : "Telegramni botga bog'ladi"),
    facts: (f) => [s(f.m.username, 40) && `@${s(f.m.username, 40)}`, on(f.m.codeSent) && 'kirish kodi yuborildi'],
  },
  'auth.otp.request': { cat: 'login', emoji: '📨', label: "Kirish kodini so'radi", facts: (f) => [sent(f)] },
  'auth.failed': {
    cat: 'loginFailed',
    emoji: '⚠️',
    label: 'Kira olmadi',
    facts: (f) => [via(f), typeof f.m.reason === 'string' && (REASON[f.m.reason] ?? s(f.m.reason, 40))],
  },
  'auth.logout': { cat: 'login', emoji: '🚪', label: 'Chiqdi' },
  'auth.password.reset.request': { cat: 'login', emoji: '📨', label: "Parolni tiklash kodini so'radi", facts: (f) => [sent(f)] },
  'auth.password.set': { cat: 'login', emoji: '🔑', label: "Parol o'rnatdi" },
  'auth.password.reset': { cat: 'login', emoji: '🔑', label: 'Parolni tikladi' },
  'auth.phone.change': {
    cat: 'login',
    emoji: '📱',
    label: 'Telefon raqamini almashtirdi',
    facts: (f) => [s(f.m.from, 20) && `eski: ${s(f.m.from, 20)}`, s(f.m.to, 20) && `yangi: ${s(f.m.to, 20)}`],
  },
  'auth.profile.update': { cat: 'action', emoji: '✏️', label: "Profilini o'zgartirdi", facts: (f) => [fields(f.m.fields)], href: userHref },
  'auth.delete': {
    cat: 'action',
    emoji: '🗑',
    label: "Hisobini o'chirdi",
    facts: (f) => {
      // Ism va telefon o'chirishdan OLDIN meta ga yozilgan: keyin hisob anonimlashadi
      const who = [s(f.m.name), s(f.m.phone)].filter(Boolean).join(' ');
      const tr = (f.m.transferred as unknown[] | undefined)?.length;
      const or = (f.m.orphaned as unknown[] | undefined)?.length;
      return [who || false, Array.isArray(f.m.transferred) && tr! > 0 && `${tr} ta tashkilot topshirildi`, Array.isArray(f.m.orphaned) && or! > 0 && `${or} ta tashkilot egasiz qoldi`];
    },
    href: userHref,
  },

  // ── 2.2 E'lon, fayl, so'rov, chat ──
  'listing.create': { cat: 'action', emoji: '📢', label: "E'lon yaratdi", facts: (f) => [nm(f, 'Listing', E(f)), nm(f, 'Organization', f.m.orgId)], href: adm('/admin/listings') },
  'listing.update': { cat: 'action', emoji: '✏️', label: "E'lonni tahrirladi", facts: (f) => [nm(f, 'Listing', E(f)), fields(f.m.fields)], href: adm('/admin/listings') },
  'listing.publish': {
    cat: 'action',
    emoji: '📢',
    label: "E'lonni joyladi",
    facts: (f) => [nm(f, 'Listing', E(f)), typeof f.m.status === 'string' && (STATUS[f.m.status] ?? s(f.m.status, 30))],
    href: adm('/admin/listings'),
  },
  'listing.archive': { cat: 'action', emoji: '📦', label: "E'lonni arxivladi", facts: (f) => [nm(f, 'Listing', E(f))], href: adm('/admin/listings') },
  'listing.delete': { cat: 'action', emoji: '🗑', label: "E'lonni o'chirdi", facts: (f) => [s(f.m.slug, 60)] },
  'inquiry.create': {
    cat: 'action',
    emoji: '💬',
    label: "So'rov yubordi",
    facts: (f) => [
      f.m.listingId ? nm(f, 'Listing', f.m.listingId) && `e'lon ${nm(f, 'Listing', f.m.listingId)}` : undefined,
      f.m.terminalId ? nm(f, 'Terminal', f.m.terminalId) && `terminal ${nm(f, 'Terminal', f.m.terminalId)}` : s(f.m.terminal, 60) && `terminal ${s(f.m.terminal, 60)}`,
    ],
    href: (f) => (E(f) ? `/dashboard/inquiries/${enc(E(f)!)}` : undefined),
  },
  'inquiry.noReply': {
    cat: 'action',
    emoji: '🔕',
    label: "So'rovga javob kelmaganini belgiladi",
    href: (f) => (E(f) ? `/dashboard/inquiries/${enc(E(f)!)}` : undefined),
  },
  // Xabar MATNI hech qachon ko'rsatilmaydi
  'chat.message': {
    cat: 'action',
    emoji: '💬',
    label: 'Chatda xabar yozdi',
    facts: (f) => [
      f.m.listingId ? nm(f, 'Listing', f.m.listingId) && `e'lon ${nm(f, 'Listing', f.m.listingId)}` : undefined,
      f.m.terminalId ? nm(f, 'Terminal', f.m.terminalId) && `terminal ${nm(f, 'Terminal', f.m.terminalId)}` : undefined,
      n0(f.m.len) > 0 && `${n0(f.m.len)} belgi`,
      n0(f.m.files) > 0 && `+${n0(f.m.files)} fayl`,
    ],
    href: (f) => (E(f) ? `/dashboard/inquiries/${enc(E(f)!)}` : undefined),
  },
  'upload.create': {
    cat: 'action',
    emoji: '📎',
    label: 'Fayl yukladi',
    facts: (f) => [
      f.m.kind === 'photo' ? 'rasm' : f.m.kind === 'doc' ? 'hujjat' : undefined,
      n0(f.m.bytes) > 0 && `${(n0(f.m.bytes) / 1048576).toFixed(1).replace('.', ',')} MB`,
    ],
  },
  'listing.review.create': {
    cat: 'action',
    emoji: '⭐',
    label: "E'longa baho qo'ydi",
    facts: (f) => [nm(f, 'Listing', f.m.listingId), n0(f.m.rating) > 0 && `${n0(f.m.rating)}/5`],
    href: () => '/admin/reviews',
  },
  'listing.review.reply': { cat: 'action', emoji: '💬', label: "E'lon sharhiga javob yozdi", facts: (f) => [nm(f, 'Listing', f.m.listingId)], href: () => '/admin/reviews' },

  // ── 2.3 Terminal, tarif, slot ──
  'terminal.claim': {
    cat: 'action',
    emoji: '🏷',
    label: "Terminalga egalik da'vosini yubordi",
    facts: (f) => [nm(f, 'Terminal', E(f)), nm(f, 'Organization', f.m.orgId), n0(f.m.files) > 0 && `${n0(f.m.files)} ta dalil fayl`],
    href: modHref('claims'),
  },
  'terminal.claim.auto': {
    cat: 'action',
    emoji: '✅',
    label: "Da'vo o'zi tasdiqlandi (raqam reestrga mos)",
    facts: (f) => [nm(f, 'Terminal', E(f))],
    href: adm('/admin/terminals'),
  },
  'terminal.create': { cat: 'action', emoji: '🏗', label: "Terminal qo'shdi", facts: (f) => [nm(f, 'Terminal', E(f))], href: adm('/admin/terminals') },
  'terminal.firstPublish': { cat: 'action', emoji: '🌐', label: 'Terminal birinchi marta saytga chiqdi', facts: (f) => [nm(f, 'Terminal', E(f))], href: adm('/admin/terminals') },
  'terminal.update': { cat: 'action', emoji: '✏️', label: 'Terminalni tahrirladi', facts: (f) => [nm(f, 'Terminal', E(f)), fields(f.m.fields)], href: adm('/admin/terminals') },
  'terminal.services': {
    cat: 'action',
    emoji: '🧰',
    label: 'Terminal xizmatlarini yangiladi',
    facts: (f) => [nm(f, 'Terminal', E(f)), Array.isArray(f.m.services) && f.m.services.length > 0 && `${f.m.services.length} ta xizmat`],
    href: adm('/admin/terminals'),
  },
  'tariff.publish': {
    cat: 'action',
    emoji: '💲',
    label: "Tarif e'lon qildi",
    facts: (f) => [nm(f, 'Terminal', f.m.terminalId), s(f.m.serviceCode, 40), som(f.m.priceTiyin)],
    href: (f) => (typeof f.m.terminalId === 'string' ? `/admin/terminals/${enc(f.m.terminalId)}` : undefined),
  },
  'slots.capacity': { cat: 'action', emoji: '📅', label: "Slot sig'imini o'zgartirdi", facts: (f) => [nm(f, 'Terminal', E(f))], href: adm('/admin/terminals') },
  'slots.close': {
    cat: 'action',
    emoji: '🚫',
    label: 'Slotni yopdi',
    facts: (f) => [nm(f, 'Terminal', f.m.terminalId), s(f.m.date, 20)],
    href: (f) => (typeof f.m.terminalId === 'string' ? `/admin/terminals/${enc(f.m.terminalId)}` : undefined),
  },

  // ── 2.4 Buyurtma, hisob, baho ──
  ...family(
    'action',
    {
      'order.confirm': ['✅', 'Buyurtmani tasdiqladi'],
      'order.complete': ['🏁', 'Buyurtmani yakunladi'],
      'order.cancel': ['↩️', 'Buyurtmani bekor qildi'],
      'order.clientClose': ['🔒', "Buyurtmani o'zi yopdi"],
    },
    { facts: (f) => [no(orderNo(f))], href: ordHref },
  ),
  'order.create': {
    cat: 'action',
    emoji: '🧾',
    label: 'Buyurtma berdi',
    facts: (f) => [no(orderNo(f)), nm(f, 'Terminal', f.m.terminalId), som(f.m.totalTiyin)],
    href: ordHref,
  },
  'order.reject': { cat: 'action', emoji: '❌', label: 'Buyurtmani rad etdi', facts: (f) => [no(orderNo(f)), why(f.m.reason)], href: ordHref },
  'order.terminalCancel': { cat: 'action', emoji: '❌', label: 'Buyurtmani terminal nomidan bekor qildi', facts: (f) => [no(orderNo(f)), why(f.m.reason)], href: ordHref },
  'order.event': { cat: 'action', emoji: '📍', label: "Buyurtmaga hodisa qo'shdi", facts: (f) => [no(orderNo(f)), s(f.m.code, 30)], href: ordHref },
  'invoice.paid': {
    cat: 'action',
    emoji: '💰',
    label: "Hisobni to'langan deb belgiladi",
    facts: (f) => [s(f.m.no, 30) && `hisob ${s(f.m.no, 30)}`, no(f.m.orderNo) && `buyurtma ${no(f.m.orderNo)}`],
    href: (f) => (s(f.m.orderNo, 30) ? `/admin/orders?open=${enc(String(f.m.orderNo))}` : '/admin/orders'),
  },
  'review.create': {
    cat: 'action',
    emoji: '⭐',
    label: "Terminalga baho qo'ydi",
    facts: (f) => [nm(f, 'Terminal', f.m.terminalId), n0(f.m.rating) > 0 && `${n0(f.m.rating)}/5`, no(f.m.orderNo)],
    href: () => '/admin/reviews',
  },
  'review.reply': { cat: 'action', emoji: '💬', label: 'Sharhga javob yozdi', facts: (f) => [nm(f, 'Terminal', f.m.terminalId)], href: () => '/admin/reviews' },

  // ── 2.5 Bozor, shoshilinch, xizmat profili ──
  'market.request.create': {
    cat: 'action',
    emoji: '🚚',
    label: "Yuk so'rovi joyladi",
    facts: (f) => [no(f.m.no), f.m.board === 'CARGO' ? 'yuk' : f.m.board === 'SERVICE' ? 'xizmat' : undefined],
    href: (f) => (s(f.m.no, 30) ? `/admin/market?q=${enc(String(f.m.no))}` : '/admin/market'),
  },
  'market.offer': {
    cat: 'action',
    emoji: '💵',
    label: "So'rovga taklif berdi",
    facts: (f) => [no(f.ref('MarketRequest', f.m.requestId)), som(f.m.priceTiyin)],
    href: (f) => {
      const n = f.ref('MarketRequest', f.m.requestId);
      return n ? `/admin/market?q=${enc(n)}` : '/admin/market';
    },
  },
  'market.award': { cat: 'action', emoji: '🤝', label: 'Taklifni tanladi', facts: (f) => [no(f.ref('MarketRequest', E(f))), on(f.m.phoneShared) && 'telefon ulashildi'], href: mktHref },
  'market.relist': { cat: 'action', emoji: '🔁', label: "So'rovni qayta joyladi", facts: (f) => [no(f.ref('MarketRequest', E(f))), s(f.m.loadDate, 20) && `yuklash ${s(f.m.loadDate, 20)}`], href: mktHref },
  ...family('action', { 'market.closed': ['🔒', "So'rovni yopdi"], 'market.done': ['🏁', "So'rovni bajarildi deb belgiladi"], 'market.cancelled': ['↩️', "So'rovni bekor qildi"] }, {
    facts: (f) => [no(f.ref('MarketRequest', E(f)))],
    href: mktHref,
  }),
  'urgent.create': {
    cat: 'action',
    emoji: '🚨',
    label: "Shoshilinch so'rov joyladi",
    facts: (f) => [no(f.m.no), s(f.m.kind, 30), typeof f.m.regionCode === 'string' && esc(REGION_LABELS[f.m.regionCode as RegionCode] ?? clip(f.m.regionCode, 20))],
    href: urgHref,
  },
  'urgent.offer': { cat: 'action', emoji: '💵', label: "Shoshilinch so'rovga taklif berdi", facts: (f) => [no(f.ref('UrgentRequest', f.m.requestId)), som(f.m.priceTiyin)], href: urgHref },
  'urgent.award': { cat: 'action', emoji: '🤝', label: "Shoshilinch so'rovda ijrochini tanladi", facts: (f) => [no(f.ref('UrgentRequest', E(f)))], href: urgHref },
  'urgent.close': { cat: 'action', emoji: '🔒', label: "Shoshilinch so'rovni yopdi", facts: (f) => [no(f.ref('UrgentRequest', E(f)))], href: urgHref },
  'service.profile.create': { cat: 'action', emoji: '🧰', label: 'Xizmat profilini ochdi', facts: (f) => [s(f.m.serviceType, 40)] },
  'service.profile.update': { cat: 'action', emoji: '✏️', label: 'Xizmat profilini tahrirladi', facts: (f) => [s(f.m.status, 30)] },
  'service.profile.hide': { cat: 'action', emoji: '🙈', label: 'Xizmat profilini yashirdi' },

  // ── 2.6 Vagon, aloqa, yordam ──
  'wagon.search': {
    cat: 'action',
    emoji: '🔎',
    label: 'Vagon qidirdi',
    facts: (f) => [
      s(E(f), 20) && `№${s(E(f), 20)}`,
      f.m.error ? 'xizmat javob bermadi' : f.m.found ? 'topildi' : 'topilmadi',
      on(f.m.fromCache) && 'keshdan',
    ],
  },
  ...Object.fromEntries(
    (
      [
        ['contact.reveal', '📞', 'Raqamni ochdi'],
        ['contact.deal', '📞', "Bitim bo'yicha raqamni ochdi (bepul)"],
        ['contact.paywall', '🧱', 'Raqamni ochmoqchi edi, obuna devori chiqdi'],
      ] as const
    ).map(([k, emoji, label]): [string, CatalogEntry] => [
      k,
      {
        cat: 'action',
        emoji,
        label,
        facts: (f) => {
          const kind = (f.e.entity ?? '').toLowerCase();
          const t = REVEAL_REF[kind];
          return [REVEAL_WORD[kind] && `${REVEAL_WORD[kind]}${t ? ` ${nm(f, t, E(f)) ?? ''}`.trimEnd() : ''}`];
        },
        href: (f) => {
          const base = REVEAL_HREF[(f.e.entity ?? '').toLowerCase()];
          return base && E(f) ? `${base}/${enc(E(f)!)}` : undefined;
        },
      },
    ]),
  ),
  'help.ask': {
    cat: 'action',
    emoji: '❓',
    label: 'Yordamchiga savol berdi',
    facts: (f) => [s(f.m.q, 120) && `"${s(f.m.q, 120)}"`, on(f.m.faq) && 'tayyor javob'],
  },

  // ── 2.7 Obuna, tashkilot, murojaat, kuzatuv ──
  'subscription.create': {
    cat: 'action',
    emoji: '💳',
    label: 'Obuna buyurtma qildi',
    facts: (f) => [no(f.m.no), s(f.m.planCode, 30), n0(f.m.months) > 0 && `${n0(f.m.months)} oy`, som(f.m.amountTiyin)],
    href: subHref,
  },
  'subscription.cancel.self': { cat: 'action', emoji: '↩️', label: 'Obuna buyurtmasini bekor qildi', href: subHref },
  'org.create': {
    cat: 'action',
    emoji: '🏢',
    label: 'Tashkilot ochdi',
    facts: (f) => [nm(f, 'Organization', E(f)), Array.isArray(f.m.kinds) && f.m.kinds.length > 0 && f.m.kinds.map((k) => (typeof k === 'string' ? (KIND[k] ?? esc(clip(k, 20))) : '')).filter(Boolean).join(', ')],
    href: adm('/admin/orgs'),
  },
  'org.update': { cat: 'action', emoji: '✏️', label: 'Tashkilotni tahrirladi', facts: (f) => [nm(f, 'Organization', E(f)), fields(f.m.fields)], href: adm('/admin/orgs') },
  'org.storefront.update': { cat: 'action', emoji: '🪟', label: 'Tashkilot sahifasini yangiladi', facts: (f) => [nm(f, 'Organization', E(f)), fields(f.m.fields)], href: adm('/admin/orgs') },
  'org.member.add': {
    cat: 'action',
    emoji: '👥',
    label: "Tashkilotga a'zo qo'shdi",
    facts: (f) => [nm(f, 'Organization', E(f)), s(f.m.phone, 20), list(f.m.roles)],
    href: adm('/admin/orgs'),
  },
  'org.kyc.request': { cat: 'action', emoji: '🪪', label: 'Tashkilotni tasdiqlashga yubordi', facts: (f) => [nm(f, 'Organization', E(f))], href: () => '/admin/moderation?tab=kyc' },
  // Murojaat matni alohida xabarda ham yo'q: u faqat admin sahifasida
  'contact.create': { cat: 'action', emoji: '✉️', label: 'Murojaat yubordi', facts: (f) => [s(f.m.topic, 40), "to'liq matn admin sahifasida"], href: modHref('contact') },
  'report.create': { cat: 'action', emoji: '🚩', label: 'Shikoyat yubordi', facts: (f) => [s(f.m.kind, 30), why(f.m.reason)], href: modHref('reports') },
  'watch.create': { cat: 'action', emoji: '🔭', label: "Kuzatuv qo'shdi", facts: (f) => [s(f.m.kind, 30), s(f.m.label, 60)] },
  'watch.delete': { cat: 'action', emoji: '🔭', label: "Kuzatuvni o'chirdi", facts: (f) => [s(f.m.kind, 30)] },

  // ── 2.8 Bot ──
  'bot.start': {
    cat: 'action',
    emoji: '🤖',
    label: 'Botni ishga tushirdi',
    facts: (f) => [f.m.start === 'login' ? 'saytdan kirish uchun keldi' : s(f.m.start, 32) && `boshlash: ${s(f.m.start, 32)}`],
    channel: 'bot',
  },
  'bot.help': { cat: 'action', emoji: '❔', label: "Botda yordam so'radi", channel: 'bot' },
  'bot.app': { cat: 'action', emoji: '📱', label: "Botdan ilova havolasini so'radi", channel: 'bot' },
  'bot.search': { cat: 'action', emoji: '🔎', label: 'Botda qidirdi', facts: (f) => [s(f.m.text, 80) && `"${s(f.m.text, 80)}"`], channel: 'bot' },

  // ── 2.9 Admin panel ──
  'listing.decide': {
    cat: 'admin',
    emoji: (f) => (on(f.m.approve) ? '✅' : '❌'),
    label: (f) => ok2(f, "E'lonni tasdiqladi", "E'lonni rad etdi"),
    facts: (f) => [nm(f, 'Listing', E(f)), why(f.m.reason), on(f.m.bulk) && 'guruh bilan'],
    href: adm('/admin/listings'),
  },
  'terminal.claim.decide': {
    cat: 'admin',
    emoji: (f) => (on(f.m.approve) && !on(f.m.revoked) ? '✅' : '❌'),
    label: (f) => (on(f.m.revoked) ? 'Egalikni qaytarib oldi' : ok2(f, "Da'voni tasdiqladi", "Da'voni rad etdi")),
    facts: (f) => [nm(f, 'Terminal', E(f)), why(f.m.reason)],
    href: adm('/admin/terminals'),
  },
  'org.kyc.decide': {
    cat: 'admin',
    emoji: (f) => (on(f.m.approve) ? '✅' : '❌'),
    label: (f) => ok2(f, 'Tashkilotni tasdiqladi', 'Tashkilotni rad etdi'),
    facts: (f) => [nm(f, 'Organization', E(f)), s(f.m.note, 80) && `izoh: ${s(f.m.note, 80)}`],
    href: adm('/admin/orgs'),
  },
  // payRef va to'lov rekvizitlari ko'rsatilmaydi
  'subscription.confirm': {
    cat: 'admin',
    emoji: '💰',
    label: "Obuna to'lovini tasdiqladi",
    facts: (f) => [nm(f, 'User', f.m.userId), n0(f.m.months) > 0 && `${n0(f.m.months)} oy`, som(f.m.expectedTiyin) && `kutilgan ${som(f.m.expectedTiyin)}`, som(f.m.receivedTiyin) && `olingan ${som(f.m.receivedTiyin)}`],
    href: subHref,
  },
  'subscription.cancel': { cat: 'admin', emoji: '↩️', label: 'Obunani bekor qildi', facts: (f) => [nm(f, 'User', f.m.userId), why(f.m.reason)], href: subHref },
  'subscription.revoke': {
    cat: 'admin',
    emoji: '⛔',
    label: 'Obunani qaytarib oldi',
    facts: (f) => [nm(f, 'User', f.m.userId), why(f.m.reason), on(f.m.moneyReceived) && 'pul olingan edi'],
    href: subHref,
  },
  'admin.subscription.remind': { cat: 'admin', emoji: '⏰', label: 'Obuna eslatmasini yubordi', facts: (f) => [nm(f, 'User', f.m.userId), no(f.m.no)], href: subHref },
  'premium.confirm': { cat: 'admin', emoji: '💰', label: "Premium to'lovini tasdiqladi", facts: (f) => [nm(f, 'Listing', f.m.listingId), n0(f.m.months) > 0 && `${n0(f.m.months)} oy`], href: modHref('premium') },
  'premium.cancel': { cat: 'admin', emoji: '↩️', label: 'Premiumni bekor qildi', facts: (f) => [nm(f, 'Listing', f.m.listingId), why(f.m.reason)], href: modHref('premium') },
  ...family(
    'admin',
    { 'admin.plan.create': ['🏷', "Tarif rejasini qo'shdi"], 'admin.plan.update': ['🏷', "Tarif rejasini o'zgartirdi"], 'admin.plan.delete': ['🏷', "Tarif rejasini o'chirdi"] },
    {
      facts: (f) => [
        s(f.m.code, 30),
        somRaw(f.m.priceMonthSom),
        typeof f.m.wasPrice === 'number' && typeof f.m.nowPrice === 'number' && `narx ${somRaw(f.m.wasPrice)} -> ${somRaw(f.m.nowPrice)}`,
        fields(f.m.fields),
      ],
      href: () => '/admin/plans',
    },
  ),
  ...family(
    'admin',
    {
      'admin.ad.create': ['📣', "Reklama qo'shdi"],
      'admin.ad.update': ['📣', 'Reklamani tahrirladi'],
      'admin.ad.media': ['📣', 'Reklama rasmini yukladi'],
      'admin.ad.delete': ['📣', "Reklamani o'chirdi"],
    },
    { facts: (f) => [s(f.m.buyer, 40), s(f.m.placement, 30), somRaw(f.m.pricePaidSom), fields(f.m.fields)], href: () => '/admin/ads' },
  ),
  ...family(
    'admin',
    { 'admin.terminal.create': ['🏗', "Terminal qo'shdi"], 'admin.terminal.update': ['🏗', 'Terminalni tahrirladi'] },
    { facts: (f) => [nm(f, 'Terminal', E(f)) ?? q(f.m.name), fields(f.m.fields)], href: adm('/admin/terminals') },
  ),
  'admin.terminal.delete': { cat: 'admin', emoji: '🗑', label: "Terminalni o'chirdi", facts: (f) => [nm(f, 'Terminal', E(f)) ?? q(f.m.name)] },
  ...family(
    'admin',
    { 'admin.terminal.bulkHide': ['🙈', 'Terminallarni yashirdi'], 'admin.terminal.bulkActivate': ['✅', 'Terminallarni faollashtirdi'], 'admin.terminal.bulkDelete': ['🗑', "Terminallarni o'chirdi"] },
    { href: () => '/admin/terminals' },
  ),
  ...family(
    'admin',
    { 'admin.station.create': ['🚉', "Stansiya qo'shdi"], 'admin.station.update': ['🚉', 'Stansiyani tahrirladi'], 'admin.station.delete': ['🚉', "Stansiyani o'chirdi"] },
    { facts: (f) => [q(f.m.nameUz), fields(f.m.fields)], href: () => '/admin/stations' },
  ),
  'admin.order.status': {
    cat: 'admin',
    emoji: '🔧',
    label: "Buyurtma holatini o'zgartirdi",
    facts: (f) => [no(f.ref('Order', E(f))), s(f.m.from, 30) && s(f.m.to, 30) && `${s(f.m.from, 30)} -> ${s(f.m.to, 30)}`, why(f.m.reason)],
    href: (f) => {
      const n = f.ref('Order', E(f));
      return n ? `/admin/orders?open=${enc(n)}` : '/admin/orders';
    },
  },
  ...family(
    'admin',
    { 'admin.review.delete': ['🗑', "Sharhni o'chirdi"], 'admin.listingReview.delete': ['🗑', "E'lon sharhini o'chirdi"] },
    { facts: (f) => [n0(f.m.rating) > 0 && `${n0(f.m.rating)}/5`], href: () => '/admin/reviews' },
  ),
  'admin.contact.handled': { cat: 'admin', emoji: '✉️', label: "Murojaatni ko'rildi deb belgiladi", href: modHref('contact') },
  // Meta da xabar matni bor: umuman ko'rsatilmaydi
  'admin.contact.delete': { cat: 'admin', emoji: '🗑', label: "Murojaatni o'chirdi" },
  'admin.report.decide': { cat: 'admin', emoji: '🚩', label: 'Shikoyat bo\'yicha qaror chiqardi', facts: (f) => [on(f.m.approve) ? 'qabul qilindi' : 'rad etildi'], href: modHref('reports') },
  'admin.urgent.close': { cat: 'admin', emoji: '🔒', label: "Shoshilinch so'rovni yopdi", facts: (f) => [no(f.m.no), why(f.m.reason)], href: urgHref },
  'admin.market.hide': { cat: 'admin', emoji: '🙈', label: "Yuk so'rovini yashirdi", facts: (f) => [no(f.ref('MarketRequest', E(f)))], href: () => '/admin/market' },
  'admin.service.profile.hide': { cat: 'admin', emoji: '🙈', label: 'Xizmat profilini yashirdi' },
  'admin.org.update': { cat: 'admin', emoji: '🏢', label: 'Tashkilotni tahrirladi', facts: (f) => [nm(f, 'Organization', E(f)), fields(f.m.fields)], href: adm('/admin/orgs') },
  'admin.org.delete': { cat: 'admin', emoji: '🏢', label: "Tashkilotni o'chirdi", facts: (f) => [nm(f, 'Organization', E(f)) ?? q(f.m.name)] },
  ...family(
    'admin',
    { 'admin.org.member.add': ['👥', "Tashkilotga a'zo qo'shdi"], 'admin.org.member.update': ['👥', "A'zoni o'zgartirdi"], 'admin.org.member.remove': ['👥', "A'zoni chiqardi"] },
    { facts: (f) => [nm(f, 'Organization', E(f)), nm(f, 'User', f.m.userId), fields(f.m.fields)], href: adm('/admin/orgs') },
  ),
  ...family(
    'admin',
    { 'admin.user.block': ['🚫', 'Foydalanuvchini blokladi'], 'admin.user.unblock': ['✅', 'Blokdan chiqardi'], 'admin.user.delete': ['🗑', "Foydalanuvchini o'chirdi"] },
    { facts: (f) => [nm(f, 'User', E(f)) ?? q(f.m.name), why(f.m.reason), on(f.m.bulk) && 'guruh bilan'], href: adm('/admin/users') },
  ),
  ...family(
    'admin',
    { 'admin.team.setLevel': ['🛡', "Jamoa darajasini o'zgartirdi"], 'admin.team.remove': ['🛡', 'Jamoadan chiqardi'] },
    {
      facts: (f) => [
        nm(f, 'User', E(f)),
        typeof f.m.from === 'string' && typeof f.m.to === 'string' && `${LEVEL[f.m.from] ?? s(f.m.from, 20)} -> ${LEVEL[f.m.to] ?? s(f.m.to, 20)}`,
      ],
      href: () => '/admin/team',
    },
  ),
  'admin.task.assign': { cat: 'admin', emoji: '📌', label: 'Vazifa biriktirdi', facts: (f) => [nm(f, 'User', f.m.assigneeId), s(f.m.note, 60)], href: () => '/admin' },
  'admin.task.done': { cat: 'admin', emoji: '📌', label: 'Vazifani bajardi', href: () => '/admin' },
  // Izoh matni ko'rsatilmaydi, faqat nimaga yozilgani
  ...family('admin', { 'admin.note.create': ['📝', 'Izoh yozdi'], 'admin.note.delete': ['📝', "Izohni o'chirdi"] }, { facts: (f) => [s(f.e.entity, 30)] }),
  // Matnli qiymat (payDetails kartani saqlashi mumkin) ko'rsatilmaydi: faqat kalit; sonlar eski -> yangi
  'admin.settings.update': {
    cat: 'admin',
    emoji: '⚙️',
    label: "Sozlamani o'zgartirdi",
    facts: (f) => {
      const ch = f.m.changed && typeof f.m.changed === 'object' ? Object.entries(f.m.changed as Record<string, { from?: unknown; to?: unknown }>) : [];
      return ch.slice(0, 6).map(([k, v]) => {
        const key = esc(clip(k, 30));
        return typeof v?.from === 'number' && typeof v?.to === 'number' ? `${key}: ${v.from} -> ${v.to}` : key;
      });
    },
    href: () => '/admin/settings',
  },
  'admin.export': { cat: 'admin', emoji: '📤', label: "Ma'lumotni CSV qilib yuklab oldi", facts: (f) => [s(f.m.resource, 30), n0(f.m.rows) > 0 && `${n0(f.m.rows)} qator`] },
  ...family('admin', { 'admin.demo.seed': ['🧪', "Namuna ma'lumot qo'shdi"], 'admin.demo.remove': ['🧪', "Namuna ma'lumotni olib tashladi"] }, {}),

  // ── 2.10 Tashrif ──
  visit: {
    cat: 'visit',
    emoji: '👁',
    label: 'Sahifani ochdi',
    facts: (f) => [s(f.m.path, 80), s(f.m.referrer, 80) && `qayerdan: ${s(f.m.referrer, 80)}`],
  },
};
