import type { SearchLang } from '@yuksaroy/domain';
import { PlatformAdmin } from '../modules/organizations/application/platform-admin';
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
  'reportsNew', 'platformInquiriesOpen',
] as const;
export type QueueKey = (typeof QUEUE_KEYS)[number];

export const QUEUE_LABEL: Record<SearchLang, Record<QueueKey, string>> = {
  uz: {
    listingsPendingReview: "Tekshiruvdagi e'lon", orgsPendingKyc: 'Tashkilot tasdig\'i', terminalClaimsPending: 'Obyekt da\'vosi',
    premiumPending: 'Premium to\'lovi', subscriptionPending: 'Obuna to\'lovi', ordersPending: 'Kutayotgan buyurtma', urgentOpen: 'Shoshilinch so\'rov',
    contactNew: 'Javobsiz murojaat', reportsNew: 'Yangi shikoyat', platformInquiriesOpen: 'Javobsiz suhbat',
  },
  ru: {
    listingsPendingReview: 'Объявление на проверке', orgsPendingKyc: 'Подтверждение организации', terminalClaimsPending: 'Заявка на объект',
    premiumPending: 'Оплата Premium', subscriptionPending: 'Оплата подписки', ordersPending: 'Заказ в ожидании', urgentOpen: 'Срочная заявка',
    contactNew: 'Обращение без ответа', reportsNew: 'Новая жалоба', platformInquiriesOpen: 'Чат без ответа',
  },
  en: {
    listingsPendingReview: 'Listing under review', orgsPendingKyc: 'Organisation check', terminalClaimsPending: 'Ownership claim',
    premiumPending: 'Premium payment', subscriptionPending: 'Subscription payment', ordersPending: 'Pending order', urgentOpen: 'Urgent request',
    contactNew: 'Unanswered message', reportsNew: 'New report', platformInquiriesOpen: 'Unanswered chat',
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
  // Panelda yozishma ekrani yo'q: platforma admini bu xabarni kabinetdagi "Kelgan" ro'yxatida
  // o'qiydi va javob beradi, yozishma haqidagi xabarnoma havolasi ham shu yerga olib boradi
  platformInquiriesOpen: '/dashboard/inquiries',
};

/** Vazifa biriktiriladigan obyekt turlari: har navbatga bittadan, QUEUE_DEF bilan birga-bir. */
export const TASK_ENTITIES = ['Listing', 'Organization', 'Terminal', 'PremiumOrder', 'Subscription', 'Order', 'UrgentRequest', 'ContactMessage', 'Report', 'Inquiry'] as const;
export type TaskEntity = (typeof TASK_ENTITIES)[number];
export type QueueModel = 'listing' | 'organization' | 'terminal' | 'premiumOrder' | 'subscription' | 'order' | 'urgentRequest' | 'contactMessage' | 'report' | 'inquiry';

/**
 * Navbat sharti BITTA joyda. queueStats (menyu badge, bosh sahifa, kunlik eslatma) va
 * vazifa yopilishi (admin-tasks.ts inQueue) shu jadvaldan yuradi: ish navbatdan chiqdimi
 * degan savolga ikki joyda ikki xil javob bo'lmasin.
 *
 * "Kutish boshlangan" maydon har jadvalda boshqacha: tashkilot uchun tasdiq so'ralgan
 * vaqt, suhbat uchun mijozning javobsiz birinchi xabari (ustun emas, waitingSince hisoblaydi),
 * qolganlari uchun yaratilgan vaqt.
 * Terminal da'vosida alohida maydon yo'q, shuning uchun oxirgi o'zgarish vaqti olinadi:
 * admin qatorni tahrir qilsa yosh nolga qaytadi, bu ma'lum kamchilik.
 */
export const QUEUE_DEF: Record<QueueKey, { entity: TaskEntity; model: QueueModel; where: Record<string, unknown>; oldest: 'createdAt' | 'kycRequestedAt' | 'updatedAt' | 'waitingSince' }> = {
  listingsPendingReview: { entity: 'Listing', model: 'listing', where: { status: 'PENDING_REVIEW' }, oldest: 'createdAt' },
  orgsPendingKyc: { entity: 'Organization', model: 'organization', where: { kycStatus: 'PENDING' }, oldest: 'kycRequestedAt' },
  terminalClaimsPending: { entity: 'Terminal', model: 'terminal', where: { claimStatus: 'PENDING' }, oldest: 'updatedAt' },
  premiumPending: { entity: 'PremiumOrder', model: 'premiumOrder', where: { status: 'PENDING' }, oldest: 'createdAt' },
  subscriptionPending: { entity: 'Subscription', model: 'subscription', where: { status: 'PENDING' }, oldest: 'createdAt' },
  ordersPending: { entity: 'Order', model: 'order', where: { status: 'PENDING' }, oldest: 'createdAt' },
  urgentOpen: { entity: 'UrgentRequest', model: 'urgentRequest', where: { status: 'OPEN' }, oldest: 'createdAt' },
  contactNew: { entity: 'ContactMessage', model: 'contactMessage', where: { handledAt: null }, oldest: 'createdAt' },
  reportsNew: { entity: 'Report', model: 'report', where: { status: 'NEW' }, oldest: 'createdAt' },
  // Egasiz obyektga yozilgan va platforma javobini kutayotgan yozishma (adminning o'zi boshlagani
  // queueWhere da chiqariladi). Egasi qarori (2026-10-07): javobdan keyin mijoz yana yozsa suhbat
  // OPEN ga qaytadi va shu navbatga qayta tushadi (chat.service send). Yoshi pastdagi waitingSince da.
  platformInquiriesOpen: { entity: 'Inquiry', model: 'inquiry', where: { toPlatform: true, status: 'OPEN' }, oldest: 'waitingSince' },
};

/** Obyekt turidan navbat kaliti (TASK_ENTITIES bilan birga-bir, spec tekshiradi). */
export const queueOf = (entity: TaskEntity): QueueKey => QUEUE_KEYS.find((k) => QUEUE_DEF[k].entity === entity)!;

type Tbl = {
  count(a: { where: Record<string, unknown> }): Promise<number>;
  findFirst(a: { where: Record<string, unknown>; orderBy: Record<string, 'asc' | 'desc'>; select: Record<string, boolean> }): Promise<Record<string, unknown> | null>;
  findMany(a: { where: Record<string, unknown>; select: Record<string, boolean>; take?: number }): Promise<Record<string, unknown>[]>;
};
/**
 * Bitta cast: o'n jadval bir xil uch usul bilan so'raladi, Prisma ning har biriga alohida
 * turi bu yerda ortiqcha. where QUEUE_DEF dan (kodda qat'iy), tashqaridan kelmaydi.
 */
export const tbl = (prisma: PrismaService, model: QueueModel): Tbl => (prisma as unknown as Record<QueueModel, Tbl>)[model];

export type QueueStat = { count: number; oldest: Date | null };

/**
 * So'rovdagi navbat sharti: QUEUE_DEF ustiga faqat bazadan bilinadigan qism. queueStats ham,
 * vazifa yopilishi (inQueue) ham shu yerdan o'tadi, ya'ni shart baribir bitta.
 *
 * Platforma suhbatidan adminning o'zi boshlagani chiqariladi: unda platforma javobini hech kim
 * kutmaydi. O'z tredida admin mijoz bo'lib qoladi (threadRole): har xabari suhbatni OPEN ga
 * qaytaradi, kabinetdagi "Kelgan" ro'yxati esa uni ko'rsatmaydi: navbatda qolsa, masalan sinab yozilgan
 * suhbat, kunlik eslatmada har kuni chiqardi va uni yopishning yo'li yo'q edi. Inquiry da User
 * bog'lanishi yo'q, shuning uchun admin id lari oldin olinadi (rol va telefon ro'yxati,
 * PlatformAdmin bilan bitta ta'rif). Bazadagi eski qatorlarga tegish shart emas.
 */
export async function queueWhere(prisma: PrismaService, k: QueueKey): Promise<Record<string, unknown>> {
  const { where } = QUEUE_DEF[k];
  if (k !== 'platformInquiriesOpen') return where;
  return { ...where, fromUserId: { notIn: await new PlatformAdmin(prisma).adminUserIds() } };
}

/**
 * Platforma suhbatlaridan eng uzoq kutganining kutish boshi: mijozning platforma oxirgi javobidan
 * keyingi birinchi xabari (javob umuman bo'lmasa, birinchi xabari).
 *
 * Egasi qarori (2026-10-07): javob olgan suhbatga mijoz yana yozsa u navbatga qaytadi. createdAt
 * bilan qayta ochilgan eski suhbat bir oy kutgandek ko'rinib, eslatma darhol chiqardi; lastMessageAt
 * bilan esa mijozning har "javob bormi?" xabari yoshni nolga qaytarardi va tez-tez yozgan mijozning
 * suhbati eslatmaga hech tushmasdi. Status tarixi saqlanmaydi, shuning uchun xabarlardan sanaladi:
 * mijozdan boshqa yozuvchi faqat platforma (threadRole).
 *
 * "Javob shart emas" (egasi qarori, 2026-10-07) ham javob o'rnida: xabar yozilmaydi, uning audit qatori
 * (chat/inquiry-status.ts NO_REPLY_ACTION) olinadi. Aks holda keyin yana yozgan mijozning suhbati
 * yopilgan "rahmat" dan beri kutgandek ko'rinib, eslatma darhol chiqardi.
 *
 * Shart queueWhere bilan bir xil (raw SQL Prisma where ni ololmaydi): biri o'zgarsa ikkinchisi ham.
 * Admin id lari shu yerda qayta so'raladi (ikki kichik so'rov): where ning ichki shakliga bog'lanmaydi.
 */
async function waitingSince(prisma: PrismaService): Promise<Date | null> {
  const admins = await new PlatformAdmin(prisma).adminUserIds();
  const [r] = await prisma.$queryRaw<{ at: Date | null }[]>`
    SELECT MIN(m."createdAt") AS "at"
    FROM "InquiryMessage" m JOIN "Inquiry" i ON i."id" = m."inquiryId"
    WHERE i."toPlatform" AND i."status" = 'OPEN' AND i."fromUserId" <> ALL(${admins}::text[])
      AND m."fromUserId" = i."fromUserId"
      AND NOT EXISTS (SELECT 1 FROM "InquiryMessage" o
        WHERE o."inquiryId" = i."id" AND o."fromUserId" <> i."fromUserId" AND o."createdAt" > m."createdAt")
      AND NOT EXISTS (SELECT 1 FROM "AuditLog" a
        WHERE a."entity" = 'Inquiry' AND a."entityId" = i."id" AND a."action" = 'inquiry.noReply' AND a."createdAt" > m."createdAt")`;
  return r?.at ?? null;
}

/** Har navbatning soni va (oldest bo'lsa) eng eskisining sanasi. So'rovlar: count + findFirst orderBy oldest asc (suhbatda waitingSince). */
export async function queueStats(prisma: PrismaService, oldest: boolean): Promise<Record<QueueKey, QueueStat>> {
  const rows = await Promise.all(QUEUE_KEYS.map(async (k) => {
    const d = QUEUE_DEF[k];
    const t = tbl(prisma, d.model);
    const where = await queueWhere(prisma, k);
    const col = d.oldest;
    const [count, at] = await Promise.all([
      t.count({ where }),
      !oldest ? null
        : col === 'waitingSince' ? waitingSince(prisma)
          : t.findFirst({ where, orderBy: { [col]: 'asc' }, select: { [col]: true } }).then((r) => (r?.[col] as Date | undefined) ?? null),
    ]);
    return [k, { count, oldest: at }] as const;
  }));
  return Object.fromEntries(rows) as Record<QueueKey, QueueStat>;
}

/**
 * Faqat admin javob berishi kerak bo'lgan navbatlar kunlik ogohlantirishga kiradi.
 *
 * Premium ataylab chiqarilgan: u eski, to'lanmagan qatorlarni yopish uchun qolgan va
 * ta'rifiga ko'ra hamisha eski, ya'ni har kuni yolg'on ogohlantirish berardi.
 * Buyurtma va shoshilinch so'rov ham chiqarilgan: ular terminal va ijrochini kutadi.
 * Egasiz obyektga yozilgan suhbat ataylab kiritilgan: unga platformadan boshqa hech kim javob
 * bermaydi, eslatmasiz esa navbat bosh sahifada turadi-yu, hech kimni turtmaydi.
 */
const WATCHED: readonly QueueKey[] = ['listingsPendingReview', 'orgsPendingKyc', 'terminalClaimsPending', 'platformInquiriesOpen'];

/** `days` kundan uzoq kutayotgan navbatlar, eng eskisidan boshlab. */
export function staleQueues(stats: Record<QueueKey, QueueStat>, now: Date, days: number): { key: QueueKey; days: number }[] {
  return WATCHED.flatMap((key) => {
    const at = stats[key].oldest;
    if (!at || !stats[key].count) return [];
    const waited = Math.floor((now.getTime() - at.getTime()) / 86_400_000);
    return waited >= days ? [{ key, days: waited }] : [];
  }).sort((a, b) => b.days - a.days);
}
