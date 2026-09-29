/**
 * Jarayon xotirasi: tizim sahifasi uchun "yaqinda nima buzildi". Nest emas, modul obyekti.
 *
 * Nega jadval emas: xatoning ko'pi baza yiqilganda bo'ladi, o'sha paytda jadvalga yozib
 * bo'lmaydi; sendTelegram va PrismaExceptionFilter DI siz (main.ts da new); savol "yaqinda
 * nima buzildi", tarix emas. Nega AuditLog emas: audit odam amali, texnik xato shovqin.
 * Restartda tozalanadi va sahifa "ishga tushgandan beri" deb aytadi.
 * ponytail: bitta nusxa; ko'p nusxa bo'lsa Redis yoki jadval.
 */
export type RuntimeError = { at: Date; status: number; code: string; method: string; path: string; msg: string };
export type DailyResult = { keys: number; sessions: number; codes: number; notes: number; reminded: number; expired: number; stale: number };
export type DailyRun = { at: Date; ms: number; ok: boolean; error?: string; result: DailyResult | null };

const RING = 50;
const MSG_MAX = 200;
const errors: RuntimeError[] = [];

export const runtime = {
  startedAt: new Date(),
  /** Kunlik sikl oxirgi yugurishi (sla-sweeper daily yozadi). null = jarayon boshlanganidan beri yugurmagan */
  daily: null as DailyRun | null,
  telegram: { lastOkAt: null as Date | null, lastFailAt: null as Date | null, lastFailStatus: null as number | null, okSinceStart: 0, failSinceStart: 0 },
};
export const startedAt = runtime.startedAt;

/** Halqa 50: eng eskisi tushib ketadi. Yo'l '?' dan kesiladi: token yoki telefon xotirada qolmasin. */
export function pushError(e: { status: number; code: string; method: string; path: string; msg: string; at?: Date }): void {
  errors.push({ at: e.at ?? new Date(), status: e.status, code: e.code, method: e.method, path: e.path.split('?')[0].slice(0, MSG_MAX), msg: e.msg.slice(0, MSG_MAX) });
  if (errors.length > RING) errors.splice(0, errors.length - RING);
}

/** Yangisi birinchi. */
export const recentErrors = (): RuntimeError[] => [...errors].reverse();

/** sendTelegram natijasi: ok yoki HTTP status (tarmoq xatosi 0). */
export function recordTelegram(ok: boolean, status?: number, at = new Date()): void {
  const t = runtime.telegram;
  if (ok) {
    t.lastOkAt = at;
    t.okSinceStart++;
  } else {
    t.lastFailAt = at;
    t.lastFailStatus = status ?? null;
    t.failSinceStart++;
  }
}
