import { uzLocalDate, uzLocalToUtc, type SearchLang } from '@yuksaroy/domain';
import { QUEUE_HREF, QUEUE_LABEL, queueStats, staleQueues } from '../../../common/admin-queues';
import { noProviderWhere } from '../../../common/fanout';
import type { PrismaService } from '../../../common/prisma.service';
import { stuckOrderIds } from '../../../common/stuck-orders';
import { notifyBoth, webUrl } from '../../../common/telegram';
import type { NotificationsService } from '../../notifications/notifications.service';
import { alertsOf } from '../../admin/admin-home';
import { PlatformAdmin } from '../../organizations/application/platform-admin';

/** Navbatdagi ish shuncha kundan oshsa kunlik xulosaga kiradi. */
export const STALE_DAYS = 2;
/** Kunlik xulosa Toshkent vaqti bilan shundan keyin ketadi: tunda uxlayotgan adminga emas. */
export const DIGEST_FROM = '09:00';
export const DIGEST_ACTION = 'admin.digest';
const DAY = 86_400_000;
const NL = String.fromCharCode(10);
const LANGS = ['uz', 'ru', 'en'] as const;

const AGE: Record<SearchLang, (d: number) => string> = {
  uz: (d) => `eng eskisi ${d} kun`, ru: (d) => `самой старой ${d} дн.`, en: (d) => `oldest ${d} days`,
};

export type DigestLine = { href: string; text: Record<SearchLang, string> };

const ALERT: Record<string, { href: string; text: (n: number) => Record<SearchLang, string> }> = {
  NO_PROVIDER: { href: '/admin/audit?action=request.fanout', text: (n) => ({ uz: `Ijrochiga yetmagan so'rov: ${n}`, ru: `Заявок без исполнителя: ${n}`, en: `Requests with no provider: ${n}` }) },
  STUCK_ORDERS: { href: '/admin/orders?status=STUCK', text: (n) => ({ uz: `Qotib qolgan buyurtma: ${n}`, ru: `Зависших заказов: ${n}`, en: `Stuck orders: ${n}` }) },
  AD_ENDING: { href: '/admin/ads', text: (n) => ({ uz: `Reklama tugayapti: ${n}`, ru: `Реклама заканчивается: ${n}`, en: `Ads ending: ${n}` }) },
  WAGON_UPSTREAM: { href: '/admin/audit?action=wagon.search', text: (n) => ({ uz: `Vagon manbasi xatosi: ${n}`, ru: `Ошибки источника вагонов: ${n}`, en: `Wagon source errors: ${n}` }) },
  NO_ACTIVE_PLAN: { href: '/admin/plans?new=1', text: () => ({ uz: "Faol tarif yo'q: obuna sotib bo'lmaydi", ru: 'Нет активного тарифа: подписку не купить', en: 'No active plan: nobody can subscribe' }) },
};

/**
 * Kunlik xulosa qatorlari: faqat bo'sh bo'lmaganlari, har biri havola bilan. Bo'sh ro'yxat = hech narsa yuborilmaydi.
 * Tarkib (egasi qarori, 2026-11-02): va'da qilingan muddatdan o'tgan navbatlar (admin-queues WATCHED), bosh sahifa
 * ogohlantirishlari (alertsOf), muddati o'tgan admin vazifalari va yuk taxtasida bitta ham ochiq so'rov yo'qligi.
 * Har bo'lak o'zi yiqilsa qolganlari ketadi: bitta so'rov xulosani butunlay o'chirmasin.
 */
export async function buildDigest(prisma: PrismaService, now: Date): Promise<DigestLine[]> {
  const lines: DigestLine[] = [];
  const safe = async <T>(fn: () => Promise<T>): Promise<T | null> => { try { return await fn(); } catch { return null; } };
  const in7 = new Date(now.getTime() + 7 * DAY);
  const since24h = new Date(now.getTime() - DAY);

  const st = await safe(() => queueStats(prisma, true));
  if (st) {
    for (const s of staleQueues(st, now, STALE_DAYS)) {
      lines.push({
        href: QUEUE_HREF[s.key],
        // Qavs ichidagi son nima ekani aytiladi: eng eskisi necha kundan beri kutmoqda
        text: Object.fromEntries(LANGS.map((l) => [l, `${QUEUE_LABEL[l][s.key]}: ${st[s.key].count}, ${AGE[l](s.days)}`])) as Record<SearchLang, string>,
      });
    }
  }

  const [phonePlans, wagon, endingAds, noProvider, stuck] = await Promise.all([
    safe(() => prisma.plan.count({ where: { active: true, grants: { has: 'PHONE' } } })),
    safe(async () => {
      const where = { action: 'wagon.search', createdAt: { gte: since24h } };
      const [total, errors] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.count({ where: { ...where, meta: { path: ['error'], equals: true } } }),
      ]);
      return { errors, total };
    }),
    safe(() => prisma.adPlacement.count({ where: { status: 'ACTIVE', endsAt: { gte: now, lte: in7 } } })),
    safe(() => prisma.auditLog.count({ where: noProviderWhere(since24h) })),
    safe(async () => (await stuckOrderIds(prisma, now)).length),
  ]);
  for (const a of alertsOf({ phonePlans, wagon, ads: endingAds == null ? null : { expired: 0, ending: endingAds }, db: { ok: true }, noProvider, stuckOrders: stuck })) {
    const d = ALERT[a.code];
    if (d) lines.push({ href: d.href, text: d.text((a as { n?: number }).n ?? 0) });
  }

  const overdue = await safe(() => prisma.adminTask.count({ where: { doneAt: null, dueAt: { lt: now } } }));
  if (overdue) lines.push({ href: '/admin/moderation', text: { uz: `Muddati o'tgan vazifa: ${overdue}`, ru: `Просроченных задач: ${overdue}`, en: `Overdue tasks: ${overdue}` } });

  // Namuna so'rovlar sanalmaydi: taxta haqiqatda bo'sh bo'lsa ijrochiga ko'rsatadigan narsa yo'q
  const openCargo = await safe(() => prisma.marketRequest.count({ where: { board: 'CARGO', status: 'OPEN', isDemo: false } }));
  if (openCargo === 0) lines.push({ href: '/admin/market', text: { uz: "Yuk taxtasida ochiq so'rov yo'q", ru: 'На доске грузов нет открытых заявок', en: 'No open requests on the cargo board' } });
  return lines;
}

/**
 * Bugun yuborilganmi: ish "admin.digest" audit qatori bilan belgilanadi, xotira bilan emas. Deploy
 * jarayonni qayta ishga tushiradi va xotiradagi belgi yo'qoladi: har deploy xulosani qayta yuborardi.
 * Belgi YUBORISHDAN OLDIN yoziladi: yuborish xato bersa o'sha kuni qayta urinilmaydi (ataylab). Ikki nusxa bir
 * vaqtda ishlasa ikkalasi ham qatorni ko'rmay yuborishi mumkin: prodda bitta api konteyner (sla-sweeper dagi
 * lastDaily kabi shunga tayanadi); ko'p nusxaga o'tilsa advisory lock kerak.
 * Xulosa bo'sh bo'lsa ham belgi yoziladi (kun uchun qaror bir marta), lekin hech narsa yuborilmaydi.
 */
export async function sendDailyDigest(prisma: PrismaService, notifications: NotificationsService, now: Date): Promise<'early' | 'done' | 'empty' | 'sent'> {
  const day = uzLocalDate(now);
  if (now < uzLocalToUtc(day, DIGEST_FROM)) return 'early';
  const sentToday = await prisma.auditLog.findFirst({ where: { action: DIGEST_ACTION, createdAt: { gte: uzLocalToUtc(day, '00:00') } }, select: { id: true } });
  if (sentToday) return 'done';
  await prisma.auditLog.create({ data: { action: DIGEST_ACTION, entity: 'Digest', entityId: day } });
  const lines = await buildDigest(prisma, now);
  if (!lines.length) return 'empty';
  const userIds = await new PlatformAdmin(prisma).adminUserIds();
  if (!userIds.length) return 'empty';
  await notifyBoth(prisma, notifications, {
    target: { userIds }, kind: 'adminDigest', inApp: 'claim', href: '/admin',
    vars: (l) => ({ list: lines.map((x) => `${x.text[l]}${NL}${webUrl(x.href)}`).join(NL + NL) }),
  });
  return 'sent';
}
