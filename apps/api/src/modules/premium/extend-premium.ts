/**
 * Premium muddati: max(hozir, joriy muddat) + oylar (kalendar oyi, kun oy oxiriga qisqartiriladi: 31 yanv + 1 oy = 28 fev).
 * Faol premium uzaytiriladi, tugagani hozirdan boshlanadi.
 */
export function extendPremium(current: Date | null, months: number, now: Date): Date {
  const base = current && current > now ? current : now;
  const d = new Date(base);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}
