import type { SearchLang } from '@yuksaroy/domain';
import type { PrismaService } from './prisma.service';

/**
 * Admin navbatlari bitta joyda: soni, eng eskisining yoshi va xabar matni uchun nomi.
 *
 * Kalitlar panel kutayotgan nomlar bilan aynan bir xil, shuning uchun bosh sahifadagi
 * kartochkalar buzilmaydi.
 *
 * DIQQAT, ataylab qilingan ikkilik: ekrandagi nomlar admin.json da qoladi (ular
 * foydalanuvchi tilini next-intl orqali oladi), bu yerdagilar esa faqat Telegram
 * xabari uchun, chunki xabar serverdan va oluvchining tilida ketadi.
 */
export const QUEUE_KEYS = [
  'listingsPendingReview', 'orgsPendingKyc', 'terminalClaimsPending',
  'premiumPending', 'subscriptionPending', 'ordersPending', 'urgentOpen', 'contactNew',
  'reportsNew',
] as const;
export type QueueKey = (typeof QUEUE_KEYS)[number];

export const QUEUE_LABEL: Record<SearchLang, Record<QueueKey, string>> = {
  uz: {
    listingsPendingReview: "Tekshiruvdagi e'lon", orgsPendingKyc: 'Tashkilot tasdig\'i', terminalClaimsPending: 'Obyekt da\'vosi',
    premiumPending: 'Premium to\'lovi', subscriptionPending: 'Obuna to\'lovi', ordersPending: 'Kutayotgan buyurtma', urgentOpen: 'Shoshilinch so\'rov',
    contactNew: 'Javobsiz murojaat', reportsNew: 'Yangi shikoyat',
  },
  ru: {
    listingsPendingReview: 'Объявление на проверке', orgsPendingKyc: 'Подтверждение организации', terminalClaimsPending: 'Заявка на объект',
    premiumPending: 'Оплата Premium', subscriptionPending: 'Оплата подписки', ordersPending: 'Заказ в ожидании', urgentOpen: 'Срочная заявка',
    contactNew: 'Обращение без ответа', reportsNew: 'Новая жалоба',
  },
  en: {
    listingsPendingReview: 'Listing under review', orgsPendingKyc: 'Organisation check', terminalClaimsPending: 'Ownership claim',
    premiumPending: 'Premium payment', subscriptionPending: 'Subscription payment', ordersPending: 'Pending order', urgentOpen: 'Urgent request',
    contactNew: 'Unanswered message', reportsNew: 'New report',
  },
};

/** Panelning qaysi ekrani ochiladi. Xabardagi havola shundan tuziladi. */
export const QUEUE_HREF: Record<QueueKey, string> = {
  listingsPendingReview: '/admin/moderation?tab=listings',
  orgsPendingKyc: '/admin/moderation?tab=kyc',
  terminalClaimsPending: '/admin/moderation?tab=claims',
  premiumPending: '/admin/moderation?tab=premium',
  subscriptionPending: '/admin/moderation?tab=subscription',
  ordersPending: '/admin/orders?status=PENDING',
  urgentOpen: '/admin/urgent?status=OPEN',
  contactNew: '/admin/moderation?tab=contact',
  reportsNew: '/admin/moderation?tab=reports',
};

export type QueueStat = { count: number; oldest: Date | null };

/**
 * Har navbatning soni va eng eskisining sanasi.
 *
 * "Kutish boshlangan" maydon har jadvalda boshqacha:
 * tashkilot uchun tasdiq so'ralgan vaqt, qolganlari uchun yaratilgan vaqt.
 * Terminal da'vosida alohida maydon yo'q, shuning uchun oxirgi o'zgarish vaqti
 * olinadi: admin qatorni tahrir qilsa yosh nolga qaytadi, bu ma'lum kamchilik.
 */
export async function queueStats(prisma: PrismaService, oldest: boolean): Promise<Record<QueueKey, QueueStat>> {
  const first = async <T extends { [k: string]: unknown }>(p: Promise<T | null>, field: string): Promise<Date | null> =>
    oldest ? (((await p) as Record<string, unknown> | null)?.[field] as Date | undefined) ?? null : null;

  const [lc, lo, oc, oo, tc, to, pc, po, sc, so, rc, ro, uc, uo, cc, co, rpc, rpo] = await Promise.all([
    prisma.listing.count({ where: { status: 'PENDING_REVIEW' } }),
    first(oldest ? prisma.listing.findFirst({ where: { status: 'PENDING_REVIEW' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }) : Promise.resolve(null), 'createdAt'),
    prisma.organization.count({ where: { kycStatus: 'PENDING' } }),
    first(oldest ? prisma.organization.findFirst({ where: { kycStatus: 'PENDING' }, orderBy: { kycRequestedAt: 'asc' }, select: { kycRequestedAt: true } }) : Promise.resolve(null), 'kycRequestedAt'),
    prisma.terminal.count({ where: { claimStatus: 'PENDING' } }),
    first(oldest ? prisma.terminal.findFirst({ where: { claimStatus: 'PENDING' }, orderBy: { updatedAt: 'asc' }, select: { updatedAt: true } }) : Promise.resolve(null), 'updatedAt'),
    prisma.premiumOrder.count({ where: { status: 'PENDING' } }),
    first(oldest ? prisma.premiumOrder.findFirst({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }) : Promise.resolve(null), 'createdAt'),
    prisma.subscription.count({ where: { status: 'PENDING' } }),
    first(oldest ? prisma.subscription.findFirst({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }) : Promise.resolve(null), 'createdAt'),
    prisma.order.count({ where: { status: 'PENDING' } }),
    first(oldest ? prisma.order.findFirst({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }) : Promise.resolve(null), 'createdAt'),
    prisma.urgentRequest.count({ where: { status: 'OPEN' } }),
    first(oldest ? prisma.urgentRequest.findFirst({ where: { status: 'OPEN' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }) : Promise.resolve(null), 'createdAt'),
    prisma.contactMessage.count({ where: { handledAt: null } }),
    first(oldest ? prisma.contactMessage.findFirst({ where: { handledAt: null }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }) : Promise.resolve(null), 'createdAt'),
    prisma.report.count({ where: { status: 'NEW' } }),
    first(oldest ? prisma.report.findFirst({ where: { status: 'NEW' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }) : Promise.resolve(null), 'createdAt'),
  ]);

  return {
    listingsPendingReview: { count: lc, oldest: lo },
    orgsPendingKyc: { count: oc, oldest: oo },
    terminalClaimsPending: { count: tc, oldest: to },
    premiumPending: { count: pc, oldest: po },
    subscriptionPending: { count: sc, oldest: so },
    ordersPending: { count: rc, oldest: ro },
    urgentOpen: { count: uc, oldest: uo },
    contactNew: { count: cc, oldest: co },
    reportsNew: { count: rpc, oldest: rpo },
  };
}

/**
 * Faqat admin javob berishi kerak bo'lgan navbatlar kunlik ogohlantirishga kiradi.
 *
 * Premium ataylab chiqarilgan: u eski, to'lanmagan qatorlarni yopish uchun qolgan va
 * ta'rifiga ko'ra hamisha eski, ya'ni har kuni yolg'on ogohlantirish berardi.
 * Buyurtma va shoshilinch so'rov ham chiqarilgan: ular terminal va ijrochini kutadi.
 */
const WATCHED: readonly QueueKey[] = ['listingsPendingReview', 'orgsPendingKyc', 'terminalClaimsPending'];

/** `days` kundan uzoq kutayotgan navbatlar, eng eskisidan boshlab. */
export function staleQueues(stats: Record<QueueKey, QueueStat>, now: Date, days: number): { key: QueueKey; days: number }[] {
  return WATCHED.flatMap((key) => {
    const at = stats[key].oldest;
    if (!at || !stats[key].count) return [];
    const waited = Math.floor((now.getTime() - at.getTime()) / 86_400_000);
    return waited >= days ? [{ key, days: waited }] : [];
  }).sort((a, b) => b.days - a.days);
}
