/**
 * Savolni lug'atga moslash: sof funksiya, tarmoqsiz.
 * Ikkala tomon (savol va lug'at) bir xil normallanadi: kichik harf, kirill -> lotin,
 * apostrof olib tashlanadi (o' -> o), tinish belgilari ajratgich. Shuning uchun
 * "Терминални қандай топаман" ham "terminal" ga tushadi.
 */
import { FAQ, type Faq, type HelpLang } from './faq';

// O'zbek va rus kirillchasi -> lotin. Rus lug'ati ham shu yo'ldan o'tadi, shuning uchun mos keladi.
const CYR: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'j', 'з': 'z', 'и': 'i',
  'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
  'у': 'u', 'ф': 'f', 'х': 'x', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh', 'ъ': '', 'ы': 'i', 'ь': '',
  'э': 'e', 'ю': 'yu', 'я': 'ya', 'ў': 'o', 'қ': 'q', 'ғ': 'g', 'ҳ': 'h',
};
// Apostrof variantlari: to'g'ri ', tipografik (U+2019), o'zbekcha (U+02BB, U+02BC), backtick, akut
const APOS = /['\u2019ʻʼ`´]/g;

// So'roq va yordamchi so'zlar: hamma savolda uchraydi, farqlamaydi
const STOP = new Set([
  // uz
  'qanday', 'nima', 'nimani', 'nimadir', 'bormi', 'mumkin', 'boladimi', 'qilaman', 'qilay', 'qilish', 'uchun', 'bilan', 'kerak', 'men', 'mening', 'menga',
  'bu', 'shu', 'va', 'yoki', 'deb', 'chiqdi', 'ishlaydi', 'olaman', 'bildiradi', 'beradi', 'oladi', 'ham', 'sizda', 'siz',
  // ru (lotinlashtirilgan)
  'kak', 'chto', 'takoe', 'mojno', 'est', 'li', 'ya', 'moy', 'dlya', 'na', 'ili', 'eto', 'delat', 'nujno', 'rabotaet', 'znachit', 'daet', 'mne', 'vi',
  'posle', 'kto', 'kogda',
  // en
  'how', 'what', 'is', 'are', 'the', 'an', 'do', 'does', 'my', 'can', 'it', 'to', 'for', 'of', 'there', 'who', 'me', 'you', 'work', 'works', 'mean',
  'now', 'after', 'get', 'when', 'and', 'or', 'own',
]);

export function normalize(s: string): string {
  return s.toLowerCase().replace(APOS, '').replace(/[Ѐ-ӿ]/g, (c) => CYR[c] ?? c);
}

export function tokenize(s: string): string[] {
  return normalize(s).split(/[^a-z0-9]+/).filter((t) => t.length >= 2 && !STOP.has(t));
}

/** Bir xil yoki (kamida 4 harf) biri ikkinchisining boshi: "terminal" ~ "terminalni", "vagon" ~ "vagonlar". */
export const stemEq = (a: string, b: string): boolean => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));

interface Indexed { faq: Faq; q: string[]; kw: string[] }
const INDEX: Partial<Record<HelpLang, Indexed[]>> = {};
const indexOf = (lang: HelpLang): Indexed[] => (INDEX[lang] ??= FAQ[lang].map((faq) => ({ faq, q: tokenize(faq.q), kw: faq.keywords.flatMap(tokenize) })));

const KW_WEIGHT = 2;
const Q_WEIGHT = 1;
const MAX_QUERY_TOKENS = 30;

export interface Scored { faq: Faq; score: number; matched: string[] }

/** Har bir savol so'zi uchun eng yaxshi mosligi: kalit so'z 2, savol so'zi 1. Yig'indi va tushgan so'zlar. */
export function score(queryTokens: string[], entry: Indexed): { score: number; matched: string[] } {
  let s = 0;
  const matched: string[] = [];
  for (const t of queryTokens) {
    if (entry.kw.some((k) => stemEq(t, k))) s += KW_WEIGHT;
    else if (entry.q.some((k) => stemEq(t, k))) s += Q_WEIGHT;
    else continue;
    matched.push(t);
  }
  return { score: s, matched };
}

/**
 * Eng yaqin 3 ta. Ishonchli = birinchi o'rin ikkinchidan kamida bitta kalit so'zga (2 ball) ustun
 * VA savolni qoplaydi: kamida ikki so'z tushgan, tushganlar savol so'zlarining yarmidan kam emas.
 * "Vagon qancha turadi": "qancha" bepul va obuna savollariga teng tushadi, "vagon" esa boshqasiga,
 * farq 1 ball, tanlab bermaymiz: ro'yxat yoki AI. "Akkauntni o'chirish": bitta so'z ham yetmaydi.
 */
export function match(query: string, lang: HelpLang): { top: Scored[]; confident: boolean } {
  const tokens = tokenize(query).slice(0, MAX_QUERY_TOKENS);
  const top = indexOf(lang).map((e) => ({ faq: e.faq, ...score(tokens, e) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  const first = top[0];
  const confident = !!first && first.score - (top[1]?.score ?? 0) >= KW_WEIGHT
    && first.matched.length >= 2 && first.matched.length * 2 >= tokens.length;
  return { top, confident };
}
