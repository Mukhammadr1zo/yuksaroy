/** Vagon qidiruvi: sof qoidalar (kvota, hodisalarni bizning shaklga o'girish, "hozir qayerda"). */

/** Mijozga ko'rsatiladigan hodisa: upstream `extra` va ichki kalitlar bu yerga kirmaydi. */
export interface WagonEvent {
  date: string;
  station: string | null;
  state: 'loaded' | 'empty' | 'unknown';
}

/** d-railway.uz javobidagi bitta hodisa (bizga kerakli maydonlar). */
export interface UpstreamEvent {
  event_date?: string | null;
  snapshot_date?: string | null;
  station?: string | null;
  state?: string | null;
  dest_station?: string | null;
  operation?: string | null;
  cargo?: string | null;
  weight?: number | null;
  /** Spravka qatori (va_sprd): yuklangan vagonda { from, load_date } */
  extra?: Record<string, unknown> | null;
}

/**
 * Yuklangan vagonning yo'li: qayerda va qachon yuklandi, qayerga ketyapti, nima ortilgan.
 * Faqat obunachiga beriladi (egasi qarori 2026-11-28). Ijarachi va kompaniya yo'q.
 */
export interface WagonTrip { from: string | null; loadDate: string | null; dest: string | null; cargo: string | null; weightT: number | null }
/** Vaqt chizig'idagi bitta qadam: sana, stansiya, operatsiya, holat. */
export interface WagonStep { date: string; station: string | null; op: string | null; state: WagonEvent['state'] }

/** Vaqt chizig'i shuncha qadamdan oshmaydi: telefon ekrani va bot xabari uchun yetarli. */
export const TIMELINE_MAX = 20;

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
      station: unshout(str(r.station)), state: stateOf(r.state),
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, EVENTS_MAX);
}

/**
 * "Hozir qayerda": eng so'nggi hisobot (snapshot_date) dagi hodisa. Bir hisobotda bir nechta
 * hodisa bo'lsa eng keyingi event_date olinadi. snapshot_date yo'q bo'lsa event_date bo'yicha.
 */
export function deriveCurrent(rows: readonly UpstreamEvent[]): WagonEvent | null {
  const best = latest(rows);
  return best ? mapEvents([best])[0] : null;
}

/** Eng so'nggi hisobotdagi hodisa (deriveCurrent bilan bir xil tanlov). */
function latest(rows: readonly UpstreamEvent[]): UpstreamEvent | null {
  let best: UpstreamEvent | null = null;
  for (const r of rows) {
    if (!str(r.event_date)) continue;
    if (!best) { best = r; continue; }
    const a = `${str(r.snapshot_date) ?? r.event_date}|${r.event_date}`;
    const b = `${str(best.snapshot_date) ?? best.event_date}|${best.event_date}`;
    if (a > b) best = r;
  }
  return best;
}

/** Yuklash operatsiyasi (ruscha hisobot nomlari: "Погрузка", "ПОГР"). */
const isLoading = (op: string | null) => !!op && /погр/i.test(op);

/**
 * Yo'l: so'nggi hodisadan manzil va yuk; yuklangan joy va sana spravka qatoridagi `extra` dan,
 * u bo'lmasa tarixdagi oxirgi yuklash operatsiyasidan. Bo'sh vagonda manzil bo'lsa ham yuk yo'q.
 * Hech narsa topilmasa null.
 */
export function deriveTrip(rows: readonly UpstreamEvent[]): WagonTrip | null {
  const best = latest(rows);
  if (!best) return null;
  const loaded = stateOf(best.state) === 'loaded';
  let from = unshout(str(best.extra?.from));
  let loadDate = str(best.extra?.load_date)?.slice(0, 10) ?? null;
  if (loaded && !from) {
    const load = [...rows].filter((r) => str(r.event_date) && isLoading(str(r.operation)))
      .sort((a, b) => ((a.event_date as string) < (b.event_date as string) ? 1 : -1))[0];
    if (load) { from = unshout(str(load.station)); loadDate = loadDate ?? (load.event_date as string).slice(0, 10); }
  }
  const trip: WagonTrip = {
    from: loaded ? from : null, loadDate: loaded ? loadDate : null,
    dest: unshout(str(best.dest_station)), cargo: loaded ? unshout(str(best.cargo)) : null,
    weightT: loaded && typeof best.weight === 'number' && best.weight > 0 ? best.weight : null,
  };
  return trip.from || trip.dest || trip.cargo ? trip : null;
}

/**
 * Vaqt chizig'i: hodisalar sana bo'yicha, ketma-ket bir stansiyadagi takrorlar bitta qadam
 * (vagon stansiyada turganda har hisobot yangi qator beradi). Yangisi birinchi, eng ko'pi TIMELINE_MAX.
 */
export function deriveTimeline(rows: readonly UpstreamEvent[]): WagonStep[] {
  const asc = rows.filter((r) => !!str(r.event_date))
    .map((r) => ({ date: r.event_date as string, station: unshout(str(r.station)), op: unshout(str(r.operation)), state: stateOf(r.state) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const steps: WagonStep[] = [];
  for (const s of asc) {
    const prev = steps.at(-1);
    // O'sha stansiya va o'sha holat: yangi qadam emas, faqat oxirgi operatsiya yangilanadi
    if (prev && prev.station === s.station && prev.state === s.state) { if (s.op) prev.op = s.op; continue; }
    steps.push({ ...s });
  }
  return steps.reverse().slice(0, TIMELINE_MAX);
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
