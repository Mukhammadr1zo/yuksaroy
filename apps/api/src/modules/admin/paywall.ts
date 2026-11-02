import { uzLocalToUtc, type SubscriptionGrant } from '@yuksaroy/domain';

export const WALL_KINDS = ['phone', 'wagon', 'metrics'] as const;
export type WallKind = (typeof WALL_KINDS)[number];

/** Kind bo'yicha ODAM soni: kirish qatorlari (kind, userId) juftlari bo'yicha guruhlangan, ya'ni bir juft = bir odam. */
export function wallPeople(pairs: readonly { kind: string }[]): Record<WallKind, number> {
  const out: Record<WallKind, number> = { phone: 0, wagon: 0, metrics: 0 };
  for (const p of pairs) if ((WALL_KINDS as readonly string[]).includes(p.kind)) out[p.kind as WallKind]++;
  return out;
}

/** Devorga birinchi urilgan kun ('YYYY-MM-DD', Toshkent) odam va devor bo'yicha. */
export type FirstHit = { userId: string; kind: string; firstDay: string };
export type FunnelSub = { userId: string; grants: string[]; createdAt: Date; status: string; paidAt: Date | null };
export type WallFunnelRow = { kind: WallKind; people: number; ordered: number; paid: number };

/** Devor qaysi obunani ochadi: telefon va vagon o'z ruxsatini, ko'rsatkichlar har qanday obunani. */
const GRANT_OF: Record<WallKind, SubscriptionGrant | null> = { phone: 'PHONE', wagon: 'WAGON', metrics: null };

/**
 * Devor -> obuna: davrda devorga urilgan odamlar, ulardan nechtasi shundan KEYIN o'sha devorni
 * ochadigan obuna buyurtmasini yaratgan (Subscription.createdAt) va nechtasi to'lagan.
 *
 * "Shundan keyin": odamning birinchi urilgan kuni (Toshkent 00:00) dan boshlab. Devorga urilishdan
 * oldin yaratilgan buyurtma devor natijasi emas. To'langan = to'lov sanasi bor (paidAt) va
 * buyurtma bekor qilinmagan (CANCELLED: tasdiq bekor qilingan yoki to'lanmay yopilgan), ya'ni
 * pul chindan qolgan. Muddati tugagan, lekin to'langan obuna ham to'langan hisoblanadi.
 *
 * Birlik hamma ustunda ODAM: bir odamning ikki buyurtmasi bitta sanaladi.
 */
export function paywallFunnel(hits: readonly FirstHit[], subs: readonly FunnelSub[]): WallFunnelRow[] {
  const byUser = new Map<string, FunnelSub[]>();
  for (const s of subs) (byUser.get(s.userId) ?? byUser.set(s.userId, []).get(s.userId)!).push(s);
  return WALL_KINDS.map((kind) => {
    const grant = GRANT_OF[kind];
    let people = 0, ordered = 0, paid = 0;
    for (const h of hits) {
      if (h.kind !== kind) continue;
      people++;
      const since = uzLocalToUtc(h.firstDay, '00:00').getTime();
      const mine = (byUser.get(h.userId) ?? []).filter((s) => s.createdAt.getTime() >= since && (!grant || s.grants.includes(grant)));
      if (mine.length) ordered++;
      if (mine.some((s) => s.paidAt && s.status !== 'CANCELLED')) paid++;
    }
    return { kind, people, ordered, paid };
  });
}
