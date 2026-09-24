import { RJU_LABELS, SERVICE_LABELS, TARIFF_UNIT_LABELS, TERMINAL_KIND_LABELS, UZ_MONTHS, type Rju, type ServiceCode, type TariffUnit, type TerminalKind } from '@yuksaroy/domain';
import type { WeekDay, WeekHours } from './types';

export { RJU_LABELS, SERVICE_LABELS, TARIFF_UNIT_LABELS, TERMINAL_KIND_LABELS };

// Bu modul oddiy funksiyalar to'plami (server va client), shuning uchun messages'dan o'qiy olmaydi:
// uch tilli qisqa yorliqlar shu yerda turadi, chaqiruvchi locale ni uzatadi (default 'uz').
type Lang = 'uz' | 'ru' | 'en';
const lang = (l: string): Lang => (l === 'ru' || l === 'en' ? l : 'uz');
const CURRENCY: Record<Lang, string> = { uz: "so'm", ru: 'сум', en: 'UZS' };
const UNIT_SHORT: Record<Lang, Record<TariffUnit, string>> = {
  uz: { PER_TON: 't', PER_WAGON: 'vagon', PER_DAY: 'kun', PER_OPERATION: 'operatsiya' },
  ru: { PER_TON: 'т', PER_WAGON: 'вагон', PER_DAY: 'сутки', PER_OPERATION: 'операция' },
  en: { PER_TON: 't', PER_WAGON: 'wagon', PER_DAY: 'day', PER_OPERATION: 'operation' },
};

export const kindLabel = (k: TerminalKind) => TERMINAL_KIND_LABELS[k] ?? k;
export const serviceLabel = (s: ServiceCode) => SERVICE_LABELS[s] ?? s;
export const rjuLabel = (r: Rju) => RJU_LABELS[r] ?? r;

/**
 * Terminal stansiyasining ko'rsatiladigan nomi. Reestrdan kelgan shahobchada stansiya
 * bog'lanmagan bo'lishi mumkin: shunda reestrdagi xom nom ishlatiladi.
 */
export const stationName = (t: { station: { nameUz: string } | null; stationNameRaw?: string | null }) =>
  t.station?.nameUz ?? t.stationNameRaw ?? '';
export const unitLabel = (u: TariffUnit) => TARIFF_UNIT_LABELS[u] ?? u;
const GROUP: Record<Lang, string> = { uz: " ", ru: " ", en: "," };
/**
 * "1 382" (uz, ru) yoki "1,382" (en). Intl.NumberFormat ishlatilmaydi: Node va brauzerdagi ICU
 * malumoti uz uchun har xil ajratgich berardi (server "1 382", brauzer "1,382"), shuning uchun
 * tort xonali sondan boshlab React gidratsiya nomuvofiqligi (#418) chiqardi. Guruhlash qolda.
 */
export const num = (n: number, locale = "uz") => {
  const [i, f] = String(n).split(".");
  const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP[lang(locale)]);
  return f ? `${g}.${f}` : g;
};
/** "12 670 so'm" */
export const som = (tiyin: number, locale = 'uz') => `${num(Math.round(tiyin / 100), locale)} ${CURRENCY[lang(locale)]}`;
/** "18 500 so'm / t" */
export const pricePer = (tiyin: number, unit: TariffUnit, locale = 'uz') => `${som(tiyin, locale)} / ${UNIT_SHORT[lang(locale)][unit]}`;
// "km" ru da "км": masofa har uch tilda ko'rinadi, shuning uchun bitta joyda
const KM: Record<Lang, string> = { uz: 'km', ru: 'км', en: 'km' };
/** "312 km" */
export const km = (n: number, locale = 'uz') => `${num(Math.round(n), locale)} ${KM[lang(locale)]}`;
/**
 * "13 158 so'm / km": taklif narxi yo'l uzunligiga bo'linadi.
 * Nega kerak: bitta reysning jami narxi boshqa reys bilan solishtirilmaydi, km narxi solishtiriladi.
 */
export const somPerKm = (tiyin: number, dist: number, locale = 'uz') => `${som(tiyin / dist, locale)} / ${KM[lang(locale)]}`;

export const DAYS: WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS: Record<Lang, Record<WeekDay, string>> = {
  uz: { mon: 'Du', tue: 'Se', wed: 'Cho', thu: 'Pa', fri: 'Ju', sat: 'Sha', sun: 'Ya' },
  ru: { mon: 'Пн', tue: 'Вт', wed: 'Ср', thu: 'Чт', fri: 'Пт', sat: 'Сб', sun: 'Вс' },
  en: { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' },
};
const HOURS_TEXT: Record<Lang, { unknown: string; dayOff: string }> = {
  uz: { unknown: "Ish vaqti ko'rsatilmagan", dayOff: 'Dam olish' },
  ru: { unknown: 'Режим работы не указан', dayOff: 'Выходной' },
  en: { unknown: 'Working hours not listed', dayOff: 'Closed' },
};

/** "24/7" | "Du-Ju 08:00-18:00 · Sha 09:00-14:00": bir xil kunlar guruhlanadi. */
export function hoursSummary(hours: WeekHours | null, is24h: boolean, locale = 'uz'): string {
  if (is24h) return '24/7';
  const L = lang(locale);
  if (!hours) return HOURS_TEXT[L].unknown;
  const day = DAY_LABELS[L];
  const parts: string[] = [];
  let i = 0;
  while (i < DAYS.length) {
    const sig = JSON.stringify(hours[DAYS[i]!] ?? []);
    let j = i;
    while (j + 1 < DAYS.length && JSON.stringify(hours[DAYS[j + 1]!] ?? []) === sig) j++;
    const w = hours[DAYS[i]!] ?? [];
    if (w.length) parts.push(`${day[DAYS[i]!]}${j > i ? `-${day[DAYS[j]!]}` : ''} ${w.map(([a, b]) => `${a}-${b}`).join(', ')}`);
    i = j + 1;
  }
  return parts.join(' · ') || HOURS_TEXT[L].dayOff;
}

/** Toshkent vaqti bo'yicha hozir ochiqmi. */
export function isOpenNow(hours: WeekHours | null, is24h: boolean, now = new Date()): boolean {
  if (is24h) return true;
  if (!hours) return false;
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const wd = f.find((p) => p.type === 'weekday')!.value.toLowerCase().slice(0, 3) as WeekDay;
  const hm = `${f.find((p) => p.type === 'hour')!.value}:${f.find((p) => p.type === 'minute')!.value}`;
  return (hours[wd] ?? []).some(([a, b]) => a <= hm && hm < b);
}

// ── Toshkent vaqti, sana ──
// Intl'da uz-UZ oy nomlari "M09" ko'rinishida chiqadi, shuning uchun o'zbekcha nomlar qo'lda; ru va en da Intl.
const TZ = 'Asia/Tashkent';
const UZ_MON = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
const UZ_WD: Record<string, string> = { Mon: 'Du', Tue: 'Se', Wed: 'Cho', Thu: 'Pa', Fri: 'Ju', Sat: 'Sha', Sun: 'Ya' };
const PARTS = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

const toDate = (d: Date | string) => (typeof d === 'string' ? new Date(d) : d);

function uzParts(d: Date | string) {
  const p = PARTS.formatToParts(toDate(d));
  const g = (t: Intl.DateTimeFormatPartTypes) => p.find((x) => x.type === t)!.value;
  return { wd: UZ_WD[g('weekday')] ?? g('weekday'), day: Number(g('day')), mon: Number(g('month')) - 1, year: Number(g('year')), hm: `${g('hour')}:${g('minute')}` };
}
// ponytail: ru/en uchun har chaqiruvda Intl obyekti yaratiladi; sana formatlash soni kam, kesh kerak bo'lsa keyin qo'shiladi
const intl = (locale: Lang, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { timeZone: TZ, ...o });

/** "10-sentabr" */
export const uzDate = (d: Date | string, locale = 'uz') => {
  const L = lang(locale);
  if (L !== 'uz') return intl(L, { day: 'numeric', month: 'long' }).format(toDate(d));
  const p = uzParts(d);
  return `${p.day}-${UZ_MONTHS[p.mon]}`;
};
/** "10-sen, Pa": jadval satri uchun qisqa */
export const uzDayShort = (d: Date | string, locale = 'uz') => {
  const L = lang(locale);
  if (L !== 'uz') return intl(L, { day: 'numeric', month: 'short', weekday: 'short' }).format(toDate(d));
  const p = uzParts(d);
  return `${p.day}-${UZ_MON[p.mon]}, ${p.wd}`;
};
/** "sentabr 2026": oylik hisobot satri uchun */
export const uzMonthYear = (d: Date | string, locale = 'uz') => {
  const L = lang(locale);
  if (L !== 'uz') return intl(L, { month: 'long', year: 'numeric' }).format(toDate(d));
  const p = uzParts(d);
  return `${UZ_MONTHS[p.mon]} ${p.year}`;
};
/** "08:00" */
export const uzTime = (d: Date | string) => uzParts(d).hm;
/** Bugungi sana Toshkent bo'yicha, "2026-09-08" */
export const uzToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
/** "10-sen 14:32" */
export const uzDateTime = (d: Date | string, locale = 'uz') => {
  const L = lang(locale);
  if (L !== 'uz') return intl(L, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(toDate(d));
  const p = uzParts(d);
  return `${p.day}-${UZ_MON[p.mon]} ${p.hm}`;
};
