import type { SearchLang } from '@yuksaroy/domain';
import { env } from './env';
import { IpBucket } from './ip-bucket';
import type { PrismaService } from './prisma.service';
// Faqat tur: qurilishda yo'qoladi, shuning uchun modul aylanishi paydo bo'lmaydi
import type { NotificationKind, NotificationsService } from '../modules/notifications/notifications.service';

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
export const lang = (v: string | null | undefined): SearchLang => (LANGS.includes(v ?? '') ? (v as SearchLang) : 'uz');

type Vars = Record<string, string | number>;
/** {kalit} o'rniga qiymat. Telegram HTML o'qiydi, sayt qo'ng'irog'i esa oddiy matn: tozalash tashqaridan beriladi. */
const fill = (t: string, v: Vars, clean: (s: string) => string) => t.replace(/\{(\w+)\}/g, (_, k: string) => clean(String(v[k] ?? '')));

/** Bildirishnoma shablonlari. Oxirgi qator - sayt havolasi. */
const TEXTS = {
  inquiryMessage: {
    uz: "💬 <b>Yangi xabar</b>\n{title}\n\n{message}\n\nJavob berish: {url}",
    ru: '💬 <b>Новое сообщение</b>\n{title}\n\n{message}\n\nОтветить: {url}',
    en: '💬 <b>New message</b>\n{title}\n\n{message}\n\nReply: {url}',
  },
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
    uz: "❌ <b>Da'vo rad etildi</b>\n{object}\nSabab: {reason}\n\n{url}",
    ru: '❌ <b>Заявка на объект отклонена</b>\n{object}\nПричина: {reason}\n\n{url}',
    en: '❌ <b>Ownership claim rejected</b>\n{object}\nReason: {reason}\n\n{url}',
  },
  // Yuk bozori va xizmatlar markazi: {where} = yo'nalish yoki viloyat, {what} = yuk yoki xizmat turi
  marketCargoNew: {
    uz: "🚚 <b>Yangi yuk {no}</b>\n{where}\n{what}\n\nTaklif berish: {url}",
    ru: '🚚 <b>Новый груз {no}</b>\n{where}\n{what}\n\nПредложить: {url}',
    en: '🚚 <b>New cargo {no}</b>\n{where}\n{what}\n\nMake an offer: {url}',
  },
  marketServiceNew: {
    uz: "🧾 <b>Yangi xizmat so'rovi {no}</b>\n{what} · {where}\n\n{title}\n\nTaklif berish: {url}",
    ru: '🧾 <b>Новый запрос на услугу {no}</b>\n{what} · {where}\n\n{title}\n\nПредложить: {url}',
    en: '🧾 <b>New service request {no}</b>\n{what} · {where}\n\n{title}\n\nMake an offer: {url}',
  },
  marketOffer: {
    uz: "💬 <b>So'rovingizga taklif keldi</b>\n{no} · {title}\n{from}\n\nKo'rish: {url}",
    ru: '💬 <b>По вашему запросу есть предложение</b>\n{no} · {title}\n{from}\n\nПосмотреть: {url}',
    en: '💬 <b>You have a new offer</b>\n{no} · {title}\n{from}\n\nView: {url}',
  },
  marketAward: {
    uz: '✅ <b>Taklifingiz tanlandi</b>\n{no} · {title}\nRaqamlaringiz bir-biringizga ochildi.\n\n{url}',
    ru: '✅ <b>Ваше предложение выбрано</b>\n{no} · {title}\nНомера открыты друг для друга.\n\n{url}',
    en: '✅ <b>Your offer was chosen</b>\n{no} · {title}\nYou can now see each other\'s numbers.\n\n{url}',
  },
  reviewNew: {
    uz: "⭐ <b>Yangi baho</b>\n{title}\n{rating}\n\n{text}\n\nKo'rish: {url}",
    ru: '⭐ <b>Новый отзыв</b>\n{title}\n{rating}\n\n{text}\n\nПосмотреть: {url}',
    en: '⭐ <b>New review</b>\n{title}\n{rating}\n\n{text}\n\nView: {url}',
  },
  // Qaror xabarlari: ilgari bu hodisalar faqat auditda qolardi va egasi hech narsa ko'rmasdi
  listingApproved: {
    uz: "✅ <b>E'loningiz tasdiqlandi</b>\n{title}\nEndi katalogda ko'rinadi.\n\n{url}",
    ru: '✅ <b>Ваше объявление одобрено</b>\n{title}\nТеперь оно видно в каталоге.\n\n{url}',
    en: '✅ <b>Your listing is approved</b>\n{title}\nIt is now visible in the catalogue.\n\n{url}',
  },
  listingRejected: {
    uz: "❌ <b>E'loningiz qaytarildi</b>\n{title}\nSabab: {reason}\n\n{url}",
    ru: '❌ <b>Ваше объявление отклонено</b>\n{title}\nПричина: {reason}\n\n{url}',
    en: '❌ <b>Your listing was rejected</b>\n{title}\nReason: {reason}\n\n{url}',
  },
  listingExpired: {
    uz: "⌛ <b>E'lon muddati tugadi</b>\n{title}{more}\nKatalogdan tushdi. Qayta yuborsangiz yana {days} kun turadi.\n\nQayta yuborish: {url}",
    ru: '⌛ <b>Срок объявления истёк</b>\n{title}{more}\nОно ушло из каталога. Отправьте снова, и оно провисит ещё {days} дней.\n\nОтправить снова: {url}',
    en: '⌛ <b>Listing has expired</b>\n{title}{more}\nIt is out of the catalogue. Resubmit it and it stays for another {days} days.\n\nResubmit: {url}',
  },
  orgVerified: {
    uz: "✅ <b>Tashkilot tasdiqlandi</b>\n{name}\nEndi e'lonlaringiz tekshiruvsiz chiqadi.\n\n{url}",
    ru: '✅ <b>Организация подтверждена</b>\n{name}\nТеперь ваши объявления выходят без проверки.\n\n{url}',
    en: '✅ <b>Organisation confirmed</b>\n{name}\nYour listings now go live without review.\n\n{url}',
  },
  orgRejected: {
    uz: "❌ <b>Tashkilot tasdiqlanmadi</b>\n{name}\nSabab: {reason}\n\n{url}",
    ru: '❌ <b>Организация не подтверждена</b>\n{name}\nПричина: {reason}\n\n{url}',
    en: '❌ <b>Organisation was not confirmed</b>\n{name}\nReason: {reason}\n\n{url}',
  },
  subscriptionActive: {
    uz: '✅ <b>Obuna yoqildi</b>\n{until} gacha amal qiladi.\n\n{url}',
    ru: '✅ <b>Подписка включена</b>\nДействует до {until}.\n\n{url}',
    en: '✅ <b>Subscription is active</b>\nValid until {until}.\n\n{url}',
  },
  subscriptionCancelled: {
    uz: '❌ <b>Obuna buyurtmasi bekor qilindi</b>\nSabab: {reason}\n\n{url}',
    ru: '❌ <b>Заказ на подписку отменён</b>\nПричина: {reason}\n\n{url}',
    en: '❌ <b>Subscription order cancelled</b>\nReason: {reason}\n\n{url}',
  },
  premiumActive: {
    uz: "⬆️ <b>E'lon yuqoriga chiqdi</b>\n{title}\n{until} gacha.\n\n{url}",
    ru: '⬆️ <b>Объявление поднято</b>\n{title}\nДо {until}.\n\n{url}',
    en: '⬆️ <b>Listing moved to the top</b>\n{title}\nUntil {until}.\n\n{url}',
  },
  premiumCancelled: {
    uz: "❌ <b>To'lov buyurtmasi bekor qilindi</b>\n{title}\nSabab: {reason}\n\n{url}",
    ru: '❌ <b>Заказ на оплату отменён</b>\n{title}\nПричина: {reason}\n\n{url}',
    en: '❌ <b>Payment order cancelled</b>\n{title}\nReason: {reason}\n\n{url}',
  },
  // Obunachiga: muddat tugashiga uch kun qoldi
  subscriptionExpiring: {
    uz: '⏳ <b>Obuna tugayapti</b>\n{date} gacha amal qiladi.\n\nUzaytirish: {url}',
    ru: '⏳ <b>Подписка заканчивается</b>\nДействует до {date}.\n\nПродлить: {url}',
    en: '⏳ <b>Subscription is ending</b>\nValid until {date}.\n\nRenew: {url}',
  },
  // Adminlarga: navbatga yangi ish tushdi
  adminQueue: {
    uz: '🔔 <b>{queue}</b>\n{what}\n\n{url}',
    ru: '🔔 <b>{queue}</b>\n{what}\n\n{url}',
    en: '🔔 <b>{queue}</b>\n{what}\n\n{url}',
  },
  // Adminlarga: navbat kutib qolgan (kuniga bir marta, kunlarda)
  adminStale: {
    uz: "⏳ <b>Navbat kutib qolgan</b>\n{list}\n\n{url}",
    ru: '⏳ <b>Очередь ждёт</b>\n{list}\n\n{url}',
    en: '⏳ <b>Queue is waiting</b>\n{list}\n\n{url}',
  },
} as const;

export type NotifyKind = keyof typeof TEXTS;
/** Jadvaldagi barcha turlar: test har biriga shakl shartini qo'yadi (birinchi qator sarlavha, oxirgisi havola). */
export const NOTIFY_KINDS = Object.keys(TEXTS) as NotifyKind[];

/** Foydalanuvchi tili bo'yicha matn (noma'lum til = uz), qiymatlar tozalanadi va 3500 belgigacha qisqaradi. */
export function notifyText(kind: NotifyKind, locale: string | null | undefined, vars: Vars): string {
  return clip(fill(TEXTS[kind][lang(locale)], vars, esc));
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

/**
 * Shu shablondan sayt qo'ng'irog'i uchun sarlavha va tana.
 *
 * Jadvaldagi har bir yozuvning birinchi qatori sarlavha, oxirgisi havola. Havola href
 * ustunida turadi, shuning uchun tanaga ikkinchi marta tushmaydi. Oraliq qatorlar nuqta
 * bilan birlashadi: qo'ng'iroq ro'yxati tanani ikki qatorga qisqartiradi va u yerda
 * qator ko'chirish baribir ko'rinmaydi.
 */
export function notifyParts(kind: NotifyKind, locale: string | null | undefined, vars: Vars): { title: string; body: string | null } {
  const lines = fill(TEXTS[kind][lang(locale)], vars, (s) => s).split(String.fromCharCode(10));
  const body = lines.slice(1, -1).map((s) => s.trim()).filter(Boolean).join(' \u00b7 ');
  return { title: clip(lines[0].replace(/<\/?b>/g, '').trim(), 200), body: clip(body, 500) || null };
}

/**
 * Bitta hodisa, ikkita yo'l: saytdagi qo'ng'iroq va Telegram, ikkalasi ham bitta shablondan
 * va oluvchining tilida.
 *
 * Nega bitta joyda: bu juftlik har bir chaqiruv nuqtasida qo'lda yozilardi va yarmida faqat
 * bittasi qolgandi, ya'ni botni bog'lamagan odam hodisani umuman ko'rmasdi. Ikki yo'l alohida
 * yutiladi: biri yiqilsa ikkinchisi baribir ketishi kerak.
 *
 * `card` berilsa qo'ng'iroq sarlavhasi va tanasi shundan olinadi (obyekt nomi turgan joylarda
 * shablondagi umumiy sarlavhadan foydaliroq); berilmasa shablondan chiqariladi.
 */
export async function notifyBoth(
  prisma: PrismaService,
  notifications: NotificationsService,
  o: {
    target: NotifyTarget;
    kind: NotifyKind;
    inApp: NotificationKind;
    href: string;
    vars: Vars | ((l: SearchLang) => Vars);
    card?: { title: string; body?: string | null };
  },
): Promise<void> {
  const userIds = [...new Set(await notifications.recipients(o.target))].filter((id) => id !== o.target.exceptUserId);
  if (!userIds.length) return;
  const varsOf = (l: SearchLang) => ({ ...(typeof o.vars === 'function' ? o.vars(l) : o.vars), url: webUrl(o.href) });
  const bell = (async () => {
    if (o.card) return notifications.push(userIds, { kind: o.inApp, href: o.href, title: clip(o.card.title, 200), body: o.card.body ?? null });
    const rows = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, locale: true } });
    const byLocale = new Map<SearchLang, string[]>();
    for (const r of rows) { const l = lang(r.locale); byLocale.set(l, [...(byLocale.get(l) ?? []), r.id]); }
    // Har til uchun bitta yozuv: tillar ko'pi bilan uchta
    for (const [l, ids] of byLocale) await notifications.push(ids, { kind: o.inApp, href: o.href, ...notifyParts(o.kind, l, varsOf(l)) });
  })().catch(() => {});
  // Oluvchilar yuqorida aniqlangan: bu yerda ulardan Telegram bog'laganlari qoladi
  const tg = notifyTelegram(prisma, { userIds }, o.kind, (l) => varsOf(lang(l))).catch(() => 0);
  await Promise.all([bell, tg]);
}
