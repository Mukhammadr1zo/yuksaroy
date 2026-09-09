import type { SearchLang } from '@yuksaroy/domain';
import { env } from './env';
import { IpBucket } from './ip-bucket';
import type { PrismaService } from './prisma.service';

/** Telegram matn chegarasi 4096; sarlavha va havola uchun zaxira qoldiramiz. */
export const TG_MAX = 3500;
// Bitta chatga soatiga 5 xabar: spam va Telegram 429 dan himoya
const chatBucket = new IpBucket(5, 3_600_000);

/** HTML parse_mode uchun: foydalanuvchi matnidagi belgilar. */
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 3500 belgidan uzun matn qisqartiriladi. ponytail: tegdan o'rtada kesilmasin deb shablonlar tegsiz, faqat <b> sarlavhada. */
export const clip = (text: string, max = TG_MAX) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

/** Chatlarga xabar. Xato yutiladi, chegaradan oshgan chat tashlab ketiladi. Yuborilganlar soni qaytadi. */
export async function sendTelegram(chatIds: readonly (bigint | string)[], text: string, replyMarkup?: unknown): Promise<number> {
  const body = clip(text);
  const allowed = chatIds.map(String).filter((id) => chatBucket.take(id));
  await Promise.all(
    allowed.map((chat_id) =>
      fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id, text: body, parse_mode: 'HTML', reply_markup: replyMarkup }),
      }).catch(() => {}),
    ),
  );
  return allowed.length;
}

const LANGS: readonly string[] = ['uz', 'ru', 'en'];
const lang = (v: string | null | undefined): SearchLang => (LANGS.includes(v ?? '') ? (v as SearchLang) : 'uz');

type Vars = Record<string, string | number>;
/** {kalit} o'rniga qiymat; har bir qiymat HTML uchun tozalanadi. */
const fill = (t: string, v: Vars) => t.replace(/\{(\w+)\}/g, (_, k: string) => esc(String(v[k] ?? '')));

/** Bildirishnoma shablonlari. Oxirgi qator - sayt havolasi. */
const TEXTS = {
  inquiry: {
    uz: "📨 <b>E'loningizga so'rov</b>\n{title}\n{from}\n\n{message}\n\nJavob berish: {url}",
    ru: '📨 <b>Запрос по вашему объявлению</b>\n{title}\n{from}\n\n{message}\n\nОтветить: {url}',
    en: '📨 <b>New inquiry on your listing</b>\n{title}\n{from}\n\n{message}\n\nReply: {url}',
  },
  orderNew: {
    uz: '📦 <b>Yangi buyurtma {no}</b>\n{terminal}\nMijoz: {shipper}\nTasdiqlash muddati: {minutes} daqiqa\n\n{url}',
    ru: '📦 <b>Новый заказ {no}</b>\n{terminal}\nКлиент: {shipper}\nСрок подтверждения: {minutes} мин\n\n{url}',
    en: '📦 <b>New order {no}</b>\n{terminal}\nClient: {shipper}\nConfirm within: {minutes} min\n\n{url}',
  },
  orderConfirmed: {
    uz: '✅ <b>Buyurtma {no} tasdiqlandi</b>\n{terminal}\n\n{url}',
    ru: '✅ <b>Заказ {no} подтверждён</b>\n{terminal}\n\n{url}',
    en: '✅ <b>Order {no} confirmed</b>\n{terminal}\n\n{url}',
  },
  orderRejected: {
    uz: '❌ <b>Buyurtma {no} rad etildi</b>\n{terminal}\nSabab: {reason}\n\n{url}',
    ru: '❌ <b>Заказ {no} отклонён</b>\n{terminal}\nПричина: {reason}\n\n{url}',
    en: '❌ <b>Order {no} rejected</b>\n{terminal}\nReason: {reason}\n\n{url}',
  },
  orderExpired: {
    uz: "⌛ <b>Buyurtma {no} muddati o'tdi</b>\nTerminal belgilangan vaqtda javob bermadi.\n\n{url}",
    ru: '⌛ <b>Срок заказа {no} истёк</b>\nТерминал не ответил вовремя.\n\n{url}',
    en: '⌛ <b>Order {no} expired</b>\nThe terminal did not respond in time.\n\n{url}',
  },
  claimApproved: {
    uz: "✅ <b>Da'vo tasdiqlandi</b>\n{object}\n\n{url}",
    ru: '✅ <b>Заявка на объект одобрена</b>\n{object}\n\n{url}',
    en: '✅ <b>Ownership claim approved</b>\n{object}\n\n{url}',
  },
  claimRejected: {
    uz: "❌ <b>Da'vo rad etildi</b>\n{object}\n\n{url}",
    ru: '❌ <b>Заявка на объект отклонена</b>\n{object}\n\n{url}',
    en: '❌ <b>Ownership claim rejected</b>\n{object}\n\n{url}',
  },
} as const;

export type NotifyKind = keyof typeof TEXTS;

/** Foydalanuvchi tili bo'yicha matn (noma'lum til = uz), qiymatlar tozalanadi va 3500 belgigacha qisqaradi. */
export function notifyText(kind: NotifyKind, locale: string | null | undefined, vars: Vars): string {
  return clip(fill(TEXTS[kind][lang(locale)], vars));
}

/** Sayt havolasi (WEB_ORIGIN + yo'l). */
export const webUrl = (path: string) => `${env.WEB_ORIGIN}${path}`;

export interface NotifyTarget {
  /** Aynan shu foydalanuvchilar. */
  userIds?: (string | null | undefined)[];
  /** Tashkilot a'zolari (ownersOnly = faqat egalari). */
  orgIds?: (string | null | undefined)[];
  ownersOnly?: boolean;
  /** Xabarni boshlagan odamga o'ziga yuborilmaydi. */
  exceptUserId?: string;
}

const ids = (v: (string | null | undefined)[] | undefined) => [...new Set((v ?? []).filter((x): x is string => !!x))];

/**
 * Telegram bog'langan qabul qiluvchilar. Bog'lanmagan foydalanuvchi umuman qatnashmaydi.
 * ponytail: 200 ta chat cheklovi; undan katta ro'yxat kerak bo'lsa navbat (queue) bilan.
 */
export async function telegramRecipients(prisma: PrismaService, t: NotifyTarget): Promise<{ chatId: bigint; locale: string }[]> {
  const userIds = ids(t.userIds);
  const orgIds = ids(t.orgIds);
  const or: Record<string, unknown>[] = [];
  if (userIds.length) or.push({ userId: { in: userIds } });
  if (orgIds.length) or.push({ user: { memberships: { some: { orgId: { in: orgIds }, ...(t.ownersOnly ? { isOwner: true } : {}) } } } });
  if (!or.length) return [];
  const rows = await prisma.telegramLink.findMany({
    where: { OR: or, ...(t.exceptUserId ? { userId: { not: t.exceptUserId } } : {}) },
    select: { chatId: true, user: { select: { locale: true } } },
    take: 200,
  });
  return rows.map((r) => ({ chatId: r.chatId, locale: r.user.locale }));
}

/** Qabul qiluvchilarni topadi va har birining tilida yuboradi. Hech kim topilmasa 0. */
export async function notifyTelegram(prisma: PrismaService, target: NotifyTarget, kind: NotifyKind, vars: Vars | ((locale: string) => Vars)): Promise<number> {
  const rows = await telegramRecipients(prisma, target);
  if (!rows.length) return 0;
  const byLocale = new Map<string, bigint[]>();
  for (const r of rows) byLocale.set(r.locale, [...(byLocale.get(r.locale) ?? []), r.chatId]);
  let sent = 0;
  for (const [locale, chats] of byLocale) {
    sent += await sendTelegram(chats, notifyText(kind, locale, typeof vars === 'function' ? vars(locale) : vars));
  }
  return sent;
}
