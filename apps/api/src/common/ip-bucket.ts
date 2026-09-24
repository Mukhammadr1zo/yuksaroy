/**
 * Oddiy xotiradagi IP chelagi: bitta oynada (ms) eng ko'pi `limit` ta so'rov.
 * ponytail: bitta jarayon uchun; ko'p nusxa (replica) bo'lsa Redis INCR + EXPIRE ga o'tadi.
 */
export class IpBucket {
  private readonly hits = new Map<string, { n: number; resetAt: number }>();

  constructor(private readonly limit: number, private readonly windowMs = 60_000) {}

  /** true = ruxsat, false = limit oshdi. */
  take(ip: string, now = Date.now()): boolean {
    const h = this.hits.get(ip);
    if (!h || h.resetAt <= now) {
      this.sweep(now);
      this.hits.set(ip, { n: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (h.n >= this.limit) return false;
    h.n++;
    return true;
  }

  /** Joriy oynada qolgan so'rovlar soni (x-ratelimit-remaining uchun). */
  remaining(ip: string, now = Date.now()): number {
    const h = this.hits.get(ip);
    return !h || h.resetAt <= now ? this.limit : Math.max(0, this.limit - h.n);
  }

  /** Eski oynalar o'chiriladi (xotira o'smasin); faqat xarita kattalashganda. */
  private sweep(now: number) {
    if (this.hits.size < 10_000) return;
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
  }
}

/** Toshkent (UTC+5, DST yo'q) bo'yicha kun raqami: yarim tunda yangi chelak. */
export function tashkentDay(now = Date.now()): number {
  return Math.floor((now + 5 * 3_600_000) / 86_400_000);
}

/**
 * Kunlik chelak: kalit (userId yoki ip) bo'yicha kuniga `limit` ta, Toshkent yarim tunida nolga qaytadi.
 * ponytail: bitta jarayon xotirasida; ko'p nusxa bo'lsa Redis INCR + EXPIREAT.
 */
export class DailyBucket {
  private readonly hits = new Map<string, { n: number; day: number }>();

  /** Bugun bu kalit sanalganmi (chelakni yemasdan). */
  has(key: string, now = Date.now()): boolean {
    const h = this.hits.get(key);
    return !!h && h.day === tashkentDay(now);
  }

  /** Sanaydi: { ok, used, limit }. Rad etilsa used o'zgarmaydi. */
  take(key: string, limit: number, now = Date.now()): { ok: boolean; used: number; limit: number } {
    const day = tashkentDay(now);
    const h = this.hits.get(key);
    if (!h || h.day !== day) {
      if (this.hits.size >= 10_000) for (const [k, v] of this.hits) if (v.day !== day) this.hits.delete(k);
      if (limit < 1) return { ok: false, used: 0, limit };
      this.hits.set(key, { n: 1, day });
      return { ok: true, used: 1, limit };
    }
    if (h.n >= limit) return { ok: false, used: h.n, limit };
    h.n++;
    return { ok: true, used: h.n, limit };
  }
}
