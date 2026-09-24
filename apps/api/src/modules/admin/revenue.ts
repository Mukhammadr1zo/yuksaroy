/**
 * Oylik tushum: ikki jadvaldagi tasdiqlangan to'lovlar bitta varaqqa yig'iladi.
 *
 * Oy TOSHKENT bo'yicha kesiladi. 30-sentabr 23:00 da kelgan pul UTC da oktabrga
 * tushardi va oy yakuni bankdagi ko'chirma bilan to'g'ri kelmay qolardi: farq besh soat.
 *
 * ponytail: guruhlash xotirada; oyiga minglab to'lov bo'lsa SQL date_trunc ga o'tkaziladi.
 */
const P = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit' });

/** "2026-09" */
export const monthKey = (d: Date) => {
  const p = P.formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g('year')}-${g('month')}`;
};

/** `back` oy orqadagi kalit: "2026-09" dan 11 orqada "2025-10". */
export function monthBack(key: string, back: number) {
  const [y, m] = key.split('-').map(Number);
  const t = y! * 12 + (m! - 1) - back;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

type Sub = { paidAt: Date | null; startsAt: Date | null; amountTiyin: bigint };
type Prem = { paidAt: Date | null; amountTiyin: bigint };
export type RevenueMonth = { month: string; totalTiyin: number; subsTiyin: number; premiumTiyin: number; payments: number; renewals: number };

export function monthlyRevenue(subs: Sub[], prems: Prem[], now = new Date()): RevenueMonth[] {
  const first = monthBack(monthKey(now), 11); // to'liq bo'lmagan 13-oy varaqqa tushmasin
  const by = new Map<string, RevenueMonth>();
  const row = (k: string) => {
    let r = by.get(k);
    if (!r) { r = { month: k, totalTiyin: 0, subsTiyin: 0, premiumTiyin: 0, payments: 0, renewals: 0 }; by.set(k, r); }
    return r;
  };
  for (const s of subs) {
    if (!s.paidAt) continue;
    const k = monthKey(s.paidAt);
    if (k < first) continue;
    const r = row(k);
    const v = Number(s.amountTiyin); // BigInt JSON ga chiqmaydi
    r.subsTiyin += v; r.totalTiyin += v; r.payments += 1;
    // Tasdiqda startsAt faol obunaning tugash sanasidan boshlanadi: demak odam uzaytirgan
    if (s.startsAt && s.startsAt > s.paidAt) r.renewals += 1;
  }
  for (const o of prems) {
    if (!o.paidAt) continue;
    const k = monthKey(o.paidAt);
    if (k < first) continue;
    const r = row(k);
    const v = Number(o.amountTiyin);
    r.premiumTiyin += v; r.totalTiyin += v; r.payments += 1;
  }
  return [...by.values()].sort((a, b) => (a.month < b.month ? 1 : -1)); // yangisi yuqorida
}
