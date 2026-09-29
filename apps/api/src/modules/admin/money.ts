import { uzLocalToUtc } from '@yuksaroy/domain';
import { monthBack, monthKey, type RevenueMonth } from './revenue';

/**
 * Takroriy pul (MRR), faol odam, yangi va ketgan: hammasi BITTA qoidadan, covers().
 *
 * Nega status emas: revoke pul kelmagan bo'lsa paidAt=null bo'ladi (hech qachon sanalmaydi,
 * daromad varag'i bilan bir xil), pul kelgan bo'lsa endsAt=bekor vaqti (o'sha oyda ketgan).
 * PENDING va CANCELLED buyurtmada startsAt yo'q. Uzaytirish zanjirida eski endsAt = yangi
 * startsAt, ya'ni bir vaqtda faqat bittasi qamraydi va odam ikki marta sanalmaydi.
 *
 * Sof: Prisma yo'q, hammasi money.spec.ts bilan qoplanadi.
 */
export type SubRow = { userId: string; paidAt: Date | null; startsAt: Date | null; endsAt: Date | null; amountTiyin: bigint; months: number };

/** t paytida qator faolmi: startsAt qamraydi, endsAt qamramaydi. */
export const covers = (s: SubRow, t: Date) => !!s.paidAt && !!s.startsAt && !!s.endsAt && s.startsAt <= t && s.endsAt > t;

/** Oylik ekvivalent: 12 oylik 990 000 so'm = 82 500 so'm/oy. */
export const monthlyOf = (s: SubRow) => Math.round(Number(s.amountTiyin) / s.months);

/** Oyning oxiri = keyingi oyning Toshkent boshi (monthBack manfiy bilan oldinga yuradi). */
export const monthEnd = (key: string) => uzLocalToUtc(`${monthBack(key, -1)}-01`, '00:00');

/** t paytidagi faol odamlar va ularning oylik pul yig'indisi. Bir odamda ikki faol qator = bitta odam. */
export function activeAt(subs: readonly SubRow[], t: Date): { users: Set<string>; mrrTiyin: number } {
  const users = new Set<string>();
  let mrrTiyin = 0;
  for (const s of subs) {
    if (!covers(s, t)) continue;
    users.add(s.userId);
    mrrTiyin += monthlyOf(s);
  }
  return { users, mrrTiyin };
}

export type SubMonth = { month: string; mrrTiyin: number; activeUsers: number; newUsers: number; churnedUsers: number };

/**
 * 12 oy, yangisi birinchi. Har oy oy OXIRIDA o'lchanadi, joriy oy ham: bu prognoz
 * (oy o'rtasida tugagan odam bu yerda yo'q, snapshot da bor). 13 nuqta hisoblanadi,
 * chunki birinchi oyning "yangi/ketgan" ustuni undan oldingi oyga qaraydi.
 */
export function subscriptionMonths(subs: readonly SubRow[], now = new Date()): SubMonth[] {
  const cur = monthKey(now);
  let prev = activeAt(subs, monthEnd(monthBack(cur, 12))).users;
  const out: SubMonth[] = [];
  for (let back = 11; back >= 0; back--) {
    const month = monthBack(cur, back);
    const a = activeAt(subs, monthEnd(month));
    let newUsers = 0;
    for (const u of a.users) if (!prev.has(u)) newUsers++;
    let churnedUsers = 0;
    for (const u of prev) if (!a.users.has(u)) churnedUsers++;
    out.push({ month, mrrTiyin: a.mrrTiyin, activeUsers: a.users.size, newUsers, churnedUsers });
    prev = a.users;
  }
  return out.reverse();
}

export type Snapshot = { mrrTiyin: number; activeUsers: number; mrrEndTiyin: number; activeEndUsers: number; atRiskUsers: number; atRiskTiyin: number };

/** Hozir va oy oxirida; farqi xavf ostidagilar (uzaytirmasa ketadigan pul). */
export function snapshot(subs: readonly SubRow[], now = new Date()): Snapshot {
  const a = activeAt(subs, now);
  const e = activeAt(subs, monthEnd(monthKey(now)));
  let atRiskUsers = 0;
  for (const u of a.users) if (!e.users.has(u)) atRiskUsers++;
  let atRiskTiyin = 0;
  for (const s of subs) if (covers(s, now) && !e.users.has(s.userId)) atRiskTiyin += monthlyOf(s);
  return { mrrTiyin: a.mrrTiyin, activeUsers: a.users.size, mrrEndTiyin: e.mrrTiyin, activeEndUsers: e.users.size, atRiskUsers, atRiskTiyin };
}

export type RevenueRow = RevenueMonth & SubMonth & { forecast: boolean };

/**
 * Oylar jadvali: skelet subs dan (12 oy hamisha bor), tushum ustunlari monthlyRevenue dan.
 * Ilgari to'lovsiz oy varaqdan tushib qolardi; endi nol bilan ko'rinadi. Birinchi qator
 * joriy oy va u prognoz.
 */
export function mergeMonths(revenue: readonly RevenueMonth[], subs: readonly SubMonth[]): RevenueRow[] {
  const by = new Map(revenue.map((r) => [r.month, r]));
  return subs.map((s, i) => {
    const r = by.get(s.month);
    return {
      ...s,
      totalTiyin: r?.totalTiyin ?? 0, subsTiyin: r?.subsTiyin ?? 0, premiumTiyin: r?.premiumTiyin ?? 0,
      payments: r?.payments ?? 0, renewals: r?.renewals ?? 0,
      forecast: i === 0,
    };
  });
}
