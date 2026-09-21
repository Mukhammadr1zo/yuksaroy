/** Vagon qidiruvi: sof qoidalar (kvota, hodisalarni bizning shaklga o'girish, "hozir qayerda"). */

/** Mijozga ko'rsatiladigan hodisa: upstream `extra` va ichki kalitlar bu yerga kirmaydi. */
export interface WagonEvent {
  date: string;
  station: string | null;
  destination: string | null;
  state: 'loaded' | 'empty' | 'unknown';
  operation: string | null;
  cargo: string | null;
  weightT: number | null;
  idleDays: number | null;
}

/** d-railway.uz javobidagi bitta hodisa (bizga kerakli maydonlar). */
export interface UpstreamEvent {
  event_date?: string | null;
  snapshot_date?: string | null;
  station?: string | null;
  dest_station?: string | null;
  state?: string | null;
  operation?: string | null;
  cargo?: string | null;
  weight?: number | string | null;
  idle_days?: number | string | null;
}

export const EVENTS_MAX = 50;
/** Bir xil vagon 6 soat ichida qayta so'ralsa upstream chaqirilmaydi: hisobotlar kuniga bir-ikki marta yangilanadi. */
export const CACHE_MS = 6 * 3_600_000;

/**
 * Bepul qidiruv qoidasi: obunachi cheksiz, qolganlarga umrbod `freeTotal` ta.
 * freeTotal 0 bo'lsa darhol obuna so'raladi.
 */
export const canSearch = (subscriber: boolean, freeUsed: number, freeTotal: number): boolean =>
  subscriber || freeUsed < freeTotal;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const stateOf = (v: unknown): WagonEvent['state'] => (v === 'loaded' || v === 'empty' ? v : 'unknown');
/**
 * Stansiya, amal va yuk nomlari hisobotlardan BOSH HARFLAR bilan keladi ("ТАШКЕНТ-ТОВАРНЫЙ").
 * Butun satr bosh harfli bo'lsagina har so'zning birinchi harfi qoldirilib qolgani kichiklashtiriladi;
 * aralash yozuv (masalan qisqartma) tegilmaydi, chunki uni to'g'ri o'girib bo'lmaydi.
 */
const unshout = (v: string | null): string | null =>
  v === null || /\p{Ll}/u.test(v) ? v : v.replace(/\p{L}[\p{L}\p{Nd}]*/gu, (w) => w[0] + w.slice(1).toLowerCase());

/** Upstream raqami: boshidagi nollarsiz ("00123456" -> "123456"); hammasi nol bo'lsa "0". */
export const upstreamNo = (digits: string): string => digits.replace(/^0+(?=\d)/, '');

/** Sanasi bo'lmagan hodisa tashlanadi: vaqt chizig'ida joyi yo'q. Natija yangisi birinchi, eng ko'pi EVENTS_MAX. */
export function mapEvents(rows: readonly UpstreamEvent[]): WagonEvent[] {
  return rows
    .filter((r) => !!str(r.event_date))
    .map((r) => ({
      date: r.event_date as string,
      station: unshout(str(r.station)), destination: unshout(str(r.dest_station)), state: stateOf(r.state), operation: unshout(str(r.operation)),
      cargo: unshout(str(r.cargo)), weightT: numOrNull(r.weight), idleDays: numOrNull(r.idle_days),
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, EVENTS_MAX);
}

/**
 * "Hozir qayerda": eng so'nggi hisobot (snapshot_date) dagi hodisa. Bir hisobotda bir nechta
 * hodisa bo'lsa eng keyingi event_date olinadi. snapshot_date yo'q bo'lsa event_date bo'yicha.
 */
export function deriveCurrent(rows: readonly UpstreamEvent[]): WagonEvent | null {
  let best: UpstreamEvent | null = null;
  for (const r of rows) {
    if (!str(r.event_date)) continue;
    if (!best) { best = r; continue; }
    const a = `${str(r.snapshot_date) ?? r.event_date}|${r.event_date}`;
    const b = `${str(best.snapshot_date) ?? best.event_date}|${best.event_date}`;
    if (a > b) best = r;
  }
  return best ? mapEvents([best])[0] : null;
}

/**
 * Bitta kalit (foydalanuvchi) uchun ishlar navbat bilan: kvota tekshiruvi va qator yozuvi
 * orasiga o'sha odamning ikkinchi so'rovi kirmasin (ikki oynadan bir vaqtda bosilsa ikkita bepul qidiruv bo'lardi).
 * ponytail: bitta jarayon xotirasida (IpBucket kabi); ko'p nusxa bo'lsa bazada qulf (pg_advisory_xact_lock).
 */
const chains = new Map<string, Promise<unknown>>();
export function serialize<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn); // oldingisi xato bilan tugasa ham navbat davom etadi
  chains.set(key, run);
  const done = () => { if (chains.get(key) === run) chains.delete(key); };
  run.then(done, done);
  return run;
}
