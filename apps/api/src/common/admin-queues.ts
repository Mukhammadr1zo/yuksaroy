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

/** Vazifa biriktiriladigan obyekt turlari: har navbatga bittadan, QUEUE_DEF bilan birga-bir. */
export const TASK_ENTITIES = ['Listing', 'Organization', 'Terminal', 'PremiumOrder', 'Subscription', 'Order', 'UrgentRequest', 'ContactMessage', 'Report'] as const;
export type TaskEntity = (typeof TASK_ENTITIES)[number];
export type QueueModel = 'listing' | 'organization' | 'terminal' | 'premiumOrder' | 'subscription' | 'order' | 'urgentRequest' | 'contactMessage' | 'report';

/**
 * Navbat sharti BITTA joyda. queueStats (menyu badge, bosh sahifa, kunlik eslatma) va
 * vazifa yopilishi (admin-tasks.ts inQueue) shu jadvaldan yuradi: ish navbatdan chiqdimi
 * degan savolga ikki joyda ikki xil javob bo'lmasin.
 *
 * "Kutish boshlangan" maydon har jadvalda boshqacha: tashkilot uchun tasdiq so'ralgan
 * vaqt, qolganlari uchun yaratilgan vaqt. Terminal da'vosida alohida maydon yo'q, shuning
 * uchun oxirgi o'zgarish vaqti olinadi: admin qatorni tahrir qilsa yosh nolga qaytadi,
 * bu ma'lum kamchilik.
 */
export const QUEUE_DEF: Record<QueueKey, { entity: TaskEntity; model: QueueModel; where: Record<string, unknown>; oldest: 'createdAt' | 'kycRequestedAt' | 'updatedAt' }> = {
  listingsPendingReview: { entity: 'Listing', model: 'listing', where: { status: 'PENDING_REVIEW' }, oldest: 'createdAt' },
  orgsPendingKyc: { entity: 'Organization', model: 'organization', where: { kycStatus: 'PENDING' }, oldest: 'kycRequestedAt' },
  terminalClaimsPending: { entity: 'Terminal', model: 'terminal', where: { claimStatus: 'PENDING' }, oldest: 'updatedAt' },
  premiumPending: { entity: 'PremiumOrder', model: 'premiumOrder', where: { status: 'PENDING' }, oldest: 'createdAt' },
  subscriptionPending: { entity: 'Subscription', model: 'subscription', where: { status: 'PENDING' }, oldest: 'createdAt' },
  ordersPending: { entity: 'Order', model: 'order', where: { status: 'PENDING' }, oldest: 'createdAt' },
  urgentOpen: { entity: 'UrgentRequest', model: 'urgentRequest', where: { status: 'OPEN' }, oldest: 'createdAt' },
  contactNew: { entity: 'ContactMessage', model: 'contactMessage', where: { handledAt: null }, oldest: 'createdAt' },
  reportsNew: { entity: 'Report', model: 'report', where: { status: 'NEW' }, oldest: 'createdAt' },
};

/** Obyekt turidan navbat kaliti (TASK_ENTITIES bilan birga-bir, spec tekshiradi). */
export const queueOf = (entity: TaskEntity): QueueKey => QUEUE_KEYS.find((k) => QUEUE_DEF[k].entity === entity)!;

type Tbl = {
  count(a: { where: Record<string, unknown> }): Promise<number>;
  findFirst(a: { where: Record<string, unknown>; orderBy: Record<string, 'asc' | 'desc'>; select: Record<string, boolean> }): Promise<Record<string, unknown> | null>;
  findMany(a: { where: Record<string, unknown>; select: Record<string, boolean>; take?: number }): Promise<Record<string, unknown>[]>;
};
/**
 * Bitta cast: to'qqiz jadval bir xil uch usul bilan so'raladi, Prisma ning har biriga alohida
 * turi bu yerda ortiqcha. where QUEUE_DEF dan (kodda qat'iy), tashqaridan kelmaydi.
 */
export const tbl = (prisma: PrismaService, model: QueueModel): Tbl => (prisma as unknown as Record<QueueModel, Tbl>)[model];

export type QueueStat = { count: number; oldest: Date | null };

/** Har navbatning soni va (oldest bo'lsa) eng eskisining sanasi. So'rovlar: count + findFirst orderBy oldest asc. */
export async function queueStats(prisma: PrismaService, oldest: boolean): Promise<Record<QueueKey, QueueStat>> {
  const rows = await Promise.all(QUEUE_KEYS.map(async (k) => {
    const d = QUEUE_DEF[k];
    const t = tbl(prisma, d.model);
    const [count, first] = await Promise.all([
      t.count({ where: d.where }),
      oldest ? t.findFirst({ where: d.where, orderBy: { [d.oldest]: 'asc' }, select: { [d.oldest]: true } }) : null,
    ]);
    return [k, { count, oldest: (first?.[d.oldest] as Date | undefined) ?? null }] as const;
  }));
  return Object.fromEntries(rows) as Record<QueueKey, QueueStat>;
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
