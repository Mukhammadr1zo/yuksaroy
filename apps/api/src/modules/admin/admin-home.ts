// Boshqaruv bosh sahifasining sof hisoblari: baza yo'q, Nest yo'q, spec bilan qotirilgan.
import { QUEUE_HREF, QUEUE_KEYS, type QueueKey, type QueueStat } from '../../common/admin-queues';

/** Kunlar kaliti bo'yicha qator: bo'sh kun 0. Chiziqcha 30 nuqtadan kam bo'lmasin. */
export function fillSeries(map: ReadonlyMap<string, number>, keys: readonly string[]): number[] {
  return keys.map((k) => map.get(k) ?? 0);
}

/**
 * O'sish oynalari: oxirgi 7 kun va undan oldingi 7 kun, Prisma `createdAt` sharti shaklida.
 * Oyna soat aniqligida (hozirdan orqaga), kun kesimida emas: "shu hafta" savoli tanaffusdan
 * keyin ham bir xil uzunlikdagi ikki oynani solishtiradi.
 */
export function growthPair(now: Date) {
  const week = 7 * 86_400_000;
  const from7 = new Date(now.getTime() - week);
  const from14 = new Date(now.getTime() - 2 * week);
  return { last: { gte: from7 }, prev: { gte: from14, lt: from7 } };
}

export type WorkRow = { key: QueueKey; count: number; oldestAt: Date | null; href: string };

/**
 * Bugungi ish: faqat bo'sh bo'lmagan navbatlar, eng uzoq kutgani birinchi.
 * Sanasi noma'lum navbat oxirida: yoshi bilinmagan qator kutganini isbotlay olmaydi.
 */
export function sortWork(stats: Record<QueueKey, QueueStat>): WorkRow[] {
  return QUEUE_KEYS
    .filter((k) => stats[k].count > 0)
    .map((k) => ({ key: k, count: stats[k].count, oldestAt: stats[k].oldest, href: QUEUE_HREF[k] }))
    .sort((a, b) => (a.oldestAt && b.oldestAt ? a.oldestAt.getTime() - b.oldestAt.getTime() : a.oldestAt ? -1 : b.oldestAt ? 1 : 0));
}

export type Alert = {
  code: 'NO_ACTIVE_PLAN' | 'WAGON_UPSTREAM' | 'AD_EXPIRED' | 'AD_ENDING' | 'DB_SLOW' | 'DB_DOWN' | 'NO_PROVIDER' | 'STUCK_ORDERS';
  tone: 'warn' | 'bad';
  n?: number;
  of?: number;
  ms?: number;
};

/** Baza shundan sekin deb hisoblanadi: SELECT 1 odatda bir necha ms. */
export const DB_SLOW_MS = 300;

/**
 * Ogohlantirishlar: har biri bitta qaror uchun, sog' holat haqida hech narsa chizilmaydi.
 * Yiqilgan blok (null) ogohlantirish bermaydi: uni failed[] aytadi.
 *
 * phonePlans: PHONE ruxsatli faol tarif soni. Nol bo'lsa hech kim obuna sotib ololmaydi,
 * faol tarif umuman yo'qmi yoki faqat vagon tarifi bormi, farqi yo'q.
 * Vagon manbasi: yarmi yoki ko'pi javobsiz bo'lsa bad, aks holda warn.
 * noProvider: 24 soatda birorta ham haqiqiy ijrochiga yetmagan yangi so'rovlar soni (adminlar va
 * so'rov egasining hamkasblari sanalmaydi, oluvchilarni topish yiqilgani ham kiradi; common/fanout.ts).
 * Qaror aniq: o'sha viloyatda o'sha turdagi ijrochi topish yoki taklif qilish.
 * stuckOrders: 7 kun qimirlamagan buyurtmalar (common/stuck-orders.ts). Faqat son: eng
 * eskisining yoshi bitta count bilan chiqmaydi, buning uchun hamma qatorni o'qish kerak.
 */
export function alertsOf(i: {
  phonePlans: number | null;
  wagon: { errors: number; total: number } | null;
  ads: { expired: number; ending: number } | null;
  db: { ok: boolean; ms?: number };
  noProvider?: number | null;
  stuckOrders?: number | null;
}): Alert[] {
  const out: Alert[] = [];
  if (!i.db.ok) out.push({ code: 'DB_DOWN', tone: 'bad' });
  else if ((i.db.ms ?? 0) > DB_SLOW_MS) out.push({ code: 'DB_SLOW', tone: 'bad', ms: i.db.ms });
  if (i.phonePlans === 0) out.push({ code: 'NO_ACTIVE_PLAN', tone: 'bad' });
  if (i.wagon && i.wagon.errors > 0) out.push({ code: 'WAGON_UPSTREAM', tone: i.wagon.errors >= i.wagon.total / 2 ? 'bad' : 'warn', n: i.wagon.errors, of: i.wagon.total });
  if (i.ads && i.ads.expired > 0) out.push({ code: 'AD_EXPIRED', tone: 'warn', n: i.ads.expired });
  if (i.ads && i.ads.ending > 0) out.push({ code: 'AD_ENDING', tone: 'warn', n: i.ads.ending });
  if (i.noProvider) out.push({ code: 'NO_PROVIDER', tone: 'warn', n: i.noProvider });
  if (i.stuckOrders) out.push({ code: 'STUCK_ORDERS', tone: 'warn', n: i.stuckOrders });
  return out;
}

/**
 * Voronka: guruhlangan qatorlardan to'rtta son.
 *
 * "Obunachi" HOZIR faol obunasi borlar: ochilish paytidagi holat audit qatorida yo'q.
 * Bu 30 kunlik tendensiya uchun yetarli, hisob-kitob uchun emas.
 */
export function revealFunnel(by: readonly { actorId: string | null; _count: { _all: number } }[], paid: ReadonlySet<string>) {
  let reveals = 0;
  let freeReveals = 0;
  let subscribers = 0;
  for (const r of by) {
    reveals += r._count._all;
    if (r.actorId && paid.has(r.actorId)) subscribers += 1;
    else freeReveals += r._count._all;
  }
  return { people: by.length, reveals, subscribers, freeReveals };
}
