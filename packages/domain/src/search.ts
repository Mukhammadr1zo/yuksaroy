// Yordamchi qidiruv: lug'at asosidagi tabiiy til tahlili (LLM yo'q). Framework'siz.
import type { RegionCode, ServiceCode, TerminalKind } from './index';

export const SEARCH_CATEGORIES = ['terminal', 'equipment', 'truck'] as const;
export type SearchCategory = (typeof SEARCH_CATEGORIES)[number];
export const EQUIPMENT_KINDS = ['SHUNTING_LOCO', 'WAGON'] as const;
export type EquipmentKind = (typeof EQUIPMENT_KINDS)[number];
export const DEAL_KINDS = ['RENT', 'SALE'] as const;
export type DealKind = (typeof DEAL_KINDS)[number];
export type SearchLang = 'uz' | 'ru' | 'en';

/** Viloyatlarning quruqlikdagi qo'shnilari (simmetrik). Koridor shu graf bo'yicha topiladi. */
export const REGION_ADJACENCY: Record<RegionCode, RegionCode[]> = {
  'UZ-SU': ['UZ-QA'],
  'UZ-QA': ['UZ-SU', 'UZ-SA', 'UZ-BU'],
  'UZ-SA': ['UZ-QA', 'UZ-JI', 'UZ-NW', 'UZ-BU'],
  'UZ-JI': ['UZ-SA', 'UZ-SI', 'UZ-NW'],
  'UZ-SI': ['UZ-JI', 'UZ-TO'],
  'UZ-TO': ['UZ-SI', 'UZ-TK', 'UZ-NG'],
  'UZ-TK': ['UZ-TO'],
  'UZ-NG': ['UZ-TO', 'UZ-FA', 'UZ-AN'],
  'UZ-AN': ['UZ-NG', 'UZ-FA'],
  'UZ-FA': ['UZ-NG', 'UZ-AN'],
  'UZ-BU': ['UZ-QA', 'UZ-SA', 'UZ-NW', 'UZ-XO'],
  'UZ-NW': ['UZ-BU', 'UZ-SA', 'UZ-JI', 'UZ-QR'],
  'UZ-XO': ['UZ-BU', 'UZ-QR'],
  'UZ-QR': ['UZ-XO', 'UZ-NW'],
};

/** Viloyat markazlari (koridor tasmasi va masofa uchun). */
export const REGION_CENTERS: Record<RegionCode, { lat: number; lng: number }> = {
  'UZ-TK': { lat: 41.311, lng: 69.28 },
  'UZ-TO': { lat: 41.04, lng: 69.359 },
  'UZ-SI': { lat: 40.489, lng: 68.784 },
  'UZ-JI': { lat: 40.116, lng: 67.842 },
  'UZ-SA': { lat: 39.655, lng: 66.96 },
  'UZ-BU': { lat: 39.775, lng: 64.429 },
  'UZ-NW': { lat: 40.084, lng: 65.379 },
  'UZ-QA': { lat: 38.861, lng: 65.789 },
  'UZ-SU': { lat: 37.224, lng: 67.278 },
  'UZ-XO': { lat: 41.55, lng: 60.631 },
  'UZ-QR': { lat: 42.453, lng: 59.61 },
  'UZ-AN': { lat: 40.783, lng: 72.344 },
  'UZ-NG': { lat: 40.998, lng: 71.673 },
  'UZ-FA': { lat: 40.386, lng: 71.786 },
};

/** from dan to gacha eng qisqa yo'l (BFS), ikkalasi ham kiradi, from birinchi. */
export function corridorRegions(from: RegionCode, to: RegionCode): RegionCode[] {
  const prev = new Map<RegionCode, RegionCode | null>([[from, null]]);
  const queue: RegionCode[] = [from];
  while (queue.length && !prev.has(to)) {
    const cur = queue.shift()!;
    for (const n of REGION_ADJACENCY[cur]) if (!prev.has(n)) { prev.set(n, cur); queue.push(n); }
  }
  if (!prev.has(to)) return [from, to];
  const path: RegionCode[] = [];
  for (let c: RegionCode | null = to; c; c = prev.get(c) ?? null) path.unshift(c);
  return path;
}

// ───────────────────────── Normalizatsiya ─────────────────────────

/** Kirill (o'zbek + rus) -> lotin. Bitta jadval, ikkala tilga. */
const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 's', ч: 'ch', ш: 'sh', щ: 'sh',
  ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ҳ: 'h', қ: 'q', ғ: "g'", ў: "o'",
};

/** Kichik harf, apostrof variantlari -> ', kirill -> lotin, bo'shliqlar bitta. */
export function normalizeQuery(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ʻʼ‘’`]/g, "'")
    .replace(/[а-яёҳқғў]/g, (c) => CYR[c] ?? c)
    .replace(/\s+/g, ' ')
    .trim();
}

// ───────────────────────── Lug'at ─────────────────────────

export interface SearchChip {
  key: string;
  type: 'category' | 'region' | 'corridor' | 'near' | 'service' | 'kind' | 'qty' | 'equipment' | 'deal' | 'bookable';
  value: string;
}

interface Entry { k: SearchChip['type'] | 'near' | 'bookable' | 'stop'; code?: string; lat?: number; lng?: number }

const DICT = new Map<string, Entry[]>();
const KEY_LANGS = new Map<string, string>(); // kalit -> 'uz' | 'ru' | 'en' birikmasi (til aniqlash uchun)

function add(lang: string, keys: string, ...entries: Entry[]): void {
  for (const raw of keys.split('|')) {
    const key = normalizeQuery(raw);
    if (!key) continue;
    const list = DICT.get(key) ?? [];
    for (const e of entries) if (!list.some((x) => x.k === e.k && x.code === e.code)) list.push(e);
    DICT.set(key, list);
    KEY_LANGS.set(key, (KEY_LANGS.get(key) ?? '') + lang);
  }
}

// [kod, lat, lng, uz, ru, en]. Kirill-o'zbek shakllari normalizeQuery orqali lotin bilan bir xil kalitga tushadi.
// lat = 0 bo'lsa bu viloyat nomi, yaqinlik nuqtasi yo'q.
const PLACES: [RegionCode, number, number, string, string, string][] = [
  ['UZ-TK', 41.311, 69.28, 'toshkent|toshkent shahri|toshkent sh', 'ташкент|город ташкент', 'tashkent|tashkent city'],
  ['UZ-TO', 0, 0, 'toshkent viloyati|toshkent vil', 'ташкентская область|ташкентск|ташобласть', 'tashkent region|tashkent oblast|tashkent province'],
  ['UZ-TO', 41.469, 69.582, 'chirchiq', 'чирчик', 'chirchik'],
  ['UZ-TO', 41.017, 70.143, 'angren', 'ангрен', 'angren'],
  ['UZ-TO', 40.844, 69.598, 'olmaliq', 'алмалык', 'almalyk'],
  ['UZ-TO', 40.907, 69.641, 'ohangaron', 'ахангаран', 'ahangaran'],
  ['UZ-TO', 40.221, 69.27, 'bekobod', 'бекабад', 'bekabad'],
  ['UZ-TO', 41.112, 69.047, "yangiyo'l|yangiyol", 'янгиюль', 'yangiyul'],
  ['UZ-TO', 41.04, 69.359, 'nurafshon', 'нурафшан', 'nurafshon'],
  ['UZ-SI', 0, 0, 'sirdaryo|sirdaryo viloyati', 'сырдарья|сырдарьинская', 'syrdarya|sirdaryo region'],
  ['UZ-SI', 40.489, 68.784, 'guliston', 'гулистан', 'gulistan'],
  ['UZ-SI', 40.276, 68.825, 'yangiyer', 'янгиер', 'yangiyer'],
  ['UZ-JI', 40.116, 67.842, 'jizzax|jizzax viloyati', 'джизак|джизакская', 'jizzakh|jizzakh region'],
  ['UZ-SA', 39.655, 66.96, 'samarqand|samarqand viloyati', 'самарканд|самаркандская', 'samarkand|samarkand region'],
  ['UZ-SA', 39.899, 66.256, "kattaqo'rg'on|kattaqorgon", 'каттакурган', 'kattakurgan'],
  ['UZ-BU', 39.775, 64.429, 'buxoro|buxoro viloyati', 'бухара|бухарская', 'bukhara|bukhara region'],
  ['UZ-BU', 39.722, 64.551, 'kogon', 'каган', 'kagan'],
  ['UZ-NW', 40.084, 65.379, 'navoiy|navoiy viloyati', 'навои|навоийская', 'navoi|navoi region'],
  ['UZ-NW', 41.582, 64.208, 'zarafshon', 'зарафшан', 'zarafshan'],
  ['UZ-NW', 42.157, 63.556, 'uchquduq', 'учкудук', 'uchkuduk'],
  ['UZ-QA', 0, 0, 'qashqadaryo|qashqadaryo viloyati', 'кашкадарья|кашкадарьинская', 'kashkadarya|qashqadaryo region'],
  ['UZ-QA', 38.861, 65.789, 'qarshi', 'карши', 'karshi'],
  ['UZ-QA', 38.454, 65.977, "sho'rtan|shortan", 'шуртан', 'shurtan'],
  ['UZ-QA', 39.256, 65.152, 'muborak', 'мубарек', 'mubarek'],
  ['UZ-SU', 0, 0, 'surxondaryo|surxondaryo viloyati', 'сурхандарья|сурхандарьинская', 'surkhandarya|surxondaryo region'],
  ['UZ-SU', 37.224, 67.278, 'termiz', 'термез', 'termez'],
  ['UZ-SU', 38.277, 67.895, 'denov', 'денау', 'denau'],
  ['UZ-SU', 37.664, 67.014, 'sherobod', 'шерабад', 'sherabad'],
  ['UZ-XO', 0, 0, 'xorazm|xorazm viloyati', 'хорезм|хорезмская', 'khorezm|khorezm region'],
  ['UZ-XO', 41.55, 60.631, 'urganch', 'ургенч', 'urgench'],
  ['UZ-XO', 41.378, 60.364, 'xiva', 'хива', 'khiva'],
  ['UZ-XO', 41.319, 61.074, 'hazorasp', 'хазарасп', 'hazorasp'],
  ['UZ-QR', 0, 0, "qoraqalpog'iston|qoraqalpogiston|qoraqalpoq", 'каракалпакстан|каракалпакия', 'karakalpakstan'],
  ['UZ-QR', 42.453, 59.61, 'nukus', 'нукус', 'nukus'],
  ['UZ-QR', 43.052, 58.85, "qo'ng'irot|qongirot", 'кунград', 'kungrad'],
  ['UZ-QR', 41.691, 60.755, 'beruniy', 'беруни', 'beruni'],
  ['UZ-QR', 42.405, 59.45, 'xojayli', 'ходжейли', 'khojayli'],
  ['UZ-AN', 40.783, 72.344, 'andijon|andijon viloyati', 'андижан|андижанская', 'andijan|andijan region'],
  ['UZ-AN', 40.641, 72.238, 'asaka', 'асака', 'asaka'],
  ['UZ-AN', 40.712, 72.055, 'shahrixon', 'шахрихан', 'shahrikhan'],
  ['UZ-NG', 40.998, 71.673, 'namangan|namangan viloyati', 'наманган|наманганская', 'namangan|namangan region'],
  ['UZ-NG', 40.873, 71.109, 'pop', 'пап', 'pop'],
  ['UZ-NG', 40.999, 71.238, 'chust', 'чуст', 'chust'],
  ['UZ-FA', 0, 0, "farg'ona viloyati|fargona viloyati", 'ферганская', 'fergana region'],
  ['UZ-FA', 40.529, 70.943, "qo'qon|qoqon", 'коканд', 'kokand'],
  ['UZ-FA', 40.386, 71.786, "farg'ona|fargona", 'фергана', 'fergana'],
  ['UZ-FA', 40.472, 71.725, "marg'ilon|margilon", 'маргилан', 'margilan'],
  ['UZ-FA', 40.298, 71.977, 'quvasoy', 'кувасай', 'kuvasay'],
  ['UZ-FA', 40.357, 71.285, 'rishton', 'риштан', 'rishtan'],
];
for (const [code, lat, lng, uz, ru, en] of PLACES) {
  const e: Entry = lat ? { k: 'region', code, lat, lng } : { k: 'region', code };
  add('uz', uz, e); add('ru', ru, e); add('en', en, e);
}

// Tushuncha jadvallari: [kod, uz, ru, en]; ru shakllari ko'pincha o'zak (prefiks bilan topiladi).
const SERVICES: [ServiceCode, string, string, string][] = [
  ['LOAD', 'yuklash|yukla', 'погрузк', 'loading|load'],
  ['UNLOAD', 'tushirish|tushir', 'выгрузк|разгрузк', 'unloading|unload'],
  ['WEIGH', 'tarozi', 'взвеш|весы', 'weigh|scale'],
  ['STORAGE', 'ombor|saqlash', 'склад|хранен', 'storage|warehouse'],
  ['SVX', 'svx|bojxona', 'свх|таможен', 'bonded|customs'],
  ['CONTAINER', 'konteyner', 'контейнер', 'container|teu'],
  ['LAST_MILE', 'avtovyvoz|avto|oxirgi milya|yetkazib berish|avtoda yetkazish', 'автовывоз|доставка до склада|последняя миля', 'last mile|truck delivery|delivery to warehouse'],
  ['SHUNTING', 'manevr', 'маневр', 'shunting'],
];
for (const [code, uz, ru, en] of SERVICES) {
  const e: Entry = { k: 'service', code };
  add('uz', uz, e); add('ru', ru, e); add('en', en, e);
}

// Terminal turi transport bo'yicha: temir yo'l, avto, ikkisi ham.
const KINDS: [TerminalKind, string, string, string][] = [
  ['RAIL', "temir yo'l terminali|temir yo'l yuk terminali|temir yo'l yuk saroyi", 'железнодорожный терминал|жд терминал|ж/д терминал', 'rail terminal|railway terminal'],
  ['ROAD', 'avto terminal|avtoterminal|avto yuk terminali', 'автотерминал|авто терминал|автомобильный терминал', 'road terminal|truck terminal'],
  ['MULTI', 'multimodal terminal|aralash terminal', 'мультимодальный терминал|смешанный терминал', 'multimodal terminal|intermodal terminal'],
];
for (const [code, uz, ru, en] of KINDS) {
  const es: Entry[] = [{ k: 'kind', code }, { k: 'category', code: 'terminal' }];
  add('uz', uz, ...es); add('ru', ru, ...es); add('en', en, ...es);
}

// Eski inshoot turlari (yuk saroyi, konteyner, SVX) endi tur emas, lekin odamlar shu so'zlar
// bilan qidiradi: ularni xizmat va kategoriyaga yo'naltiramiz, shunda qidiruv bo'sh qolmaydi.
add('uz', 'konteyner terminali', { k: 'service', code: 'CONTAINER' }, { k: 'category', code: 'terminal' });
add('ru', 'контейнерный терминал', { k: 'service', code: 'CONTAINER' }, { k: 'category', code: 'terminal' });
add('en', 'container terminal', { k: 'service', code: 'CONTAINER' }, { k: 'category', code: 'terminal' });
add('uz', 'svx ombori', { k: 'service', code: 'SVX' }, { k: 'category', code: 'terminal' });
add('ru', 'склад временного хранения', { k: 'service', code: 'SVX' }, { k: 'category', code: 'terminal' });
add('en', 'bonded warehouse', { k: 'service', code: 'SVX' }, { k: 'category', code: 'terminal' });
add('uz', 'yuk saroyi|logistika markazi', { k: 'category', code: 'terminal' });
add('ru', 'грузовой двор|логистический центр', { k: 'category', code: 'terminal' });
add('en', 'freight yard|logistics center|logistics centre', { k: 'category', code: 'terminal' });

// Shahobcha alohida kategoriya emas: u temir yo'l turidagi terminal. So'z terminal katalogiga
// RAIL filtri bilan olib boradi, shunda "shahobcha" deb qidirgan odam bo'sh sahifa ko'rmaydi.
add('uz', "shahobcha|shaxobcha|shahobcha yo'l|shaxobcha yo'l", { k: 'kind', code: 'RAIL' }, { k: 'category', code: 'terminal' });
add('ru', 'подъездн|ветка', { k: 'kind', code: 'RAIL' }, { k: 'category', code: 'terminal' });
add('en', 'siding', { k: 'kind', code: 'RAIL' }, { k: 'category', code: 'terminal' });

const CATEGORIES: [SearchCategory, string, string, string][] = [
  ['terminal', 'terminal', 'терминал', 'terminal'],
  ['truck', 'fura|yuk mashinasi|avtotashuvchi|tashuvchi', 'грузовик|фура|перевозчик', 'truck|carrier'],
  ['equipment', 'lokomotiv', 'локомотив', 'locomotive'],
];
for (const [code, uz, ru, en] of CATEGORIES) {
  const e: Entry = { k: 'category', code };
  add('uz', uz, e); add('ru', ru, e); add('en', en, e);
}

// Texnika so'zi yakka kelsa: kategoriya equipment + tur. "manevr teplovozi" esa terminal xizmati (SHUNTING).
const EQUIPMENT: [EquipmentKind, string, string, string][] = [
  ['SHUNTING_LOCO', 'teplovoz', 'тепловоз', 'shunting locomotive'],
  ['WAGON', 'vagon|vagonlar', 'вагон', 'wagon'],
];
for (const [code, uz, ru, en] of EQUIPMENT) {
  const es: Entry[] = [{ k: 'equipment', code }, { k: 'category', code: 'equipment' }];
  add('uz', uz, ...es); add('ru', ru, ...es); add('en', en, ...es);
}
add('uz', 'manevr teplovozi', { k: 'service', code: 'SHUNTING' }, { k: 'equipment', code: 'SHUNTING_LOCO' });
add('ru', 'маневровый тепловоз', { k: 'service', code: 'SHUNTING' }, { k: 'equipment', code: 'SHUNTING_LOCO' });

const DEALS: [DealKind, string, string, string][] = [
  ['RENT', 'ijara|ijaraga|arenda', 'аренда', 'rent|lease'],
  ['SALE', 'sotuv|sotiladi|sotib', 'продажа|продаётся|продается', 'sale|buy'],
];
for (const [code, uz, ru, en] of DEALS) {
  const e: Entry = { k: 'deal', code };
  add('uz', uz, e); add('ru', ru, e); add('en', en, e);
}

add('uz', 'yaqin|atrofida|ichida|yonida|yonimda', { k: 'near' });
add('ru', 'рядом|около|в радиусе|ближайш', { k: 'near' });
add('en', 'near|within', { k: 'near' });
add('uz', "bugun|bo'sh|bron", { k: 'bookable' });
add('ru', 'сегодня|свободн|бронь', { k: 'bookable' });
add('en', 'bookable|today|free', { k: 'bookable' });

// Stop so'zlar: ma'noli hisoblanmaydi. Koridor belgilari (dan, gacha, ot, do, to, -) ham shu yerda.
add('uz', "va|bilan|uchun|yo'lda|kerak|bor|bormi|ta|dan|gacha|orasida|yuk|menga|viloyat|shahar", { k: 'stop' });
add('ru', 'и|для|на|с|в|от|до|между|по|груз|област|город', { k: 'stop' });
add('en', 'the|for|with|a|an|to|from|and|in|at|of|cargo|region|city', { k: 'stop' });
add('', '-', { k: 'stop' });

// So'z soni bo'yicha kalitlar: prefiks izlash faqat bir xil uzunlikdagi kalitlar bilan.
const KEYS_BY_LEN: string[][] = [];
for (const k of DICT.keys()) (KEYS_BY_LEN[k.split(' ').length] ??= []).push(k);

// ───────────────────────── Tahlil ─────────────────────────

export interface SearchFilters {
  category: SearchCategory | null;
  regions: RegionCode[];
  corridor: { from: RegionCode; to: RegionCode } | null;
  near: { lat: number; lng: number; radiusKm: number } | null;
  services: ServiceCode[];
  kind: TerminalKind | null;
  qty: { wagons?: number; tonnes?: number; containers?: number } | null;
  equipment: EquipmentKind | null;
  deal: DealKind | null;
  bookable: boolean | null;
  lang: SearchLang;
  confidence: number;
  unresolved: string[];
  chips: SearchChip[];
}

const SUFFIXES = ['dagi', 'gacha', 'ning', 'dan', 'lar', 'da', 'ga', 'ni'];

/** O'zbek qo'shimchalarini olib tashlash (ko'pi bilan ikkita: vagonlardan -> vagon). suffix = tashqi qo'shimcha. */
function strip(t: string): { stem: string; suffix: string } {
  let stem = t, suffix = '';
  for (let pass = 0; pass < 2; pass++) {
    const s = SUFFIXES.find((x) => stem.endsWith(x) && stem.length - x.length >= 3);
    if (!s) break;
    stem = stem.slice(0, -s.length);
    suffix ||= s;
  }
  return { stem, suffix };
}

interface Tok { raw: string; norm: string; stem: string; suffix: string }

function tokenize(q: string): Tok[] {
  return q
    .replace(/[\u2013\u2014-]/g, ' - ')
    .replace(/[,;:!?()"«»[\]{}./]/g, ' ')
    .trim()
    .split(/\s+/)
    .map((raw) => ({ raw, norm: normalizeQuery(raw) }))
    .filter((t) => t.norm)
    .map((t) => ({ ...t, ...strip(t.norm) }));
}

function unitOf(s: string): 'wagons' | 'tonnes' | 'containers' | 'km' | null {
  if (/^(vagon|wagon)/.test(s)) return 'wagons';
  if (/^(t|ton|tonn[a-z']*)$/.test(s)) return 'tonnes';
  if (/^(konteyner|container|teu)/.test(s)) return 'containers';
  return s === 'km' ? 'km' : null;
}

/** 1) aniq moslik, 2) kalit tokenning boshi (4+ harf, eng uzuni), 3) rus kelishigi: 5 harfli prefiks, faqat joy nomlari. */
function lookup(cands: string[], len: number): { key: string; entries: Entry[] } | null {
  for (const c of cands) { const e = DICT.get(c); if (e) return { key: c, entries: e }; }
  let best = '';
  for (const key of KEYS_BY_LEN[len] ?? []) {
    if (key.length >= 4 && key.length > best.length && cands.some((c) => c.startsWith(key))) best = key;
  }
  if (best) return { key: best, entries: DICT.get(best)! };
  if (len === 1 && cands[0].length >= 5) {
    const p = cands[0].slice(0, 5);
    const key = (KEYS_BY_LEN[1] ?? []).find((k) => k.startsWith(p) && DICT.get(k)!.some((e) => e.k === 'region'));
    if (key) return { key, entries: DICT.get(key)! };
  }
  return null;
}

interface RegionHit { code: RegionCode; lat?: number; lng?: number; from: boolean; to: boolean }

export function parseQuery(q: string, opts: { lang?: SearchLang; near?: { lat: number; lng: number } } = {}): SearchFilters {
  const toks = tokenize(q);
  const n = toks.length;
  const state: ('none' | 'stop' | 'hit')[] = new Array(n).fill('none');
  const hits: { i: number; len: number; suffix: string; entries: Entry[] }[] = [];
  const qty: NonNullable<SearchFilters['qty']> = {};
  let km: number | null = null;
  let en = 0, uz = 0;

  for (let i = 0; i < n; i++) {
    // Miqdor: "20 vagon", "20 ta vagon", "50km". Yalang'och son tushunilmagan bo'lib qoladi.
    const num = /^(\d+)([a-z']*)$/.exec(toks[i].norm);
    if (num) {
      let j = i;
      let unit = unitOf(num[2]);
      if (!num[2]) { j = toks[i + 1]?.norm === 'ta' ? i + 2 : i + 1; unit = j < n ? unitOf(toks[j].norm) : null; }
      if (!unit) continue;
      const v = Number(num[1]);
      if (unit === 'km') km = v; else qty[unit] = v;
      for (let k = i; k <= j; k++) state[k] = 'hit';
      i = j;
      continue;
    }
    // Ibora (3 -> 1 so'z), oxirgi so'z qo'shimchasiz ham sinaladi.
    for (let len = Math.min(3, n - i); len >= 1; len--) {
      const last = toks[i + len - 1];
      const head = toks.slice(i, i + len - 1).map((t) => t.norm).join(' ');
      const cands = [...new Set([last.norm, last.stem])].map((s) => (head ? `${head} ${s}` : s));
      const found = lookup(cands, len);
      if (!found) continue;
      const l = KEY_LANGS.get(found.key) ?? '';
      if (l.includes('en') && !l.includes('uz')) en++;
      if (l.includes('uz') && !l.includes('en')) uz++;
      const stop = found.entries.every((e) => e.k === 'stop');
      for (let k = i; k < i + len; k++) state[k] = stop ? 'stop' : 'hit';
      if (!stop) hits.push({ i, len, suffix: last.suffix, entries: found.entries });
      i += len - 1;
      break;
    }
  }

  // Topilmalarni maydonlarga yig'ish
  const norms = toks.map((t) => t.norm);
  const regionHits: RegionHit[] = [];
  const services: ServiceCode[] = [];
  const cats: SearchCategory[] = [];
  let kind: TerminalKind | null = null, equipment: EquipmentKind | null = null, deal: DealKind | null = null;
  let nearWord = false, bookable = false;
  for (const h of hits) {
    const prev = norms[h.i - 1], next = norms[h.i + h.len];
    for (const e of h.entries) {
      switch (e.k) {
        case 'region':
          regionHits.push({
            code: e.code as RegionCode, lat: e.lat, lng: e.lng,
            from: h.suffix === 'dan' || next === 'dan' || prev === 'ot' || prev === 'from' || prev === 'mejdu',
            to: h.suffix === 'gacha' || next === 'gacha' || prev === 'do' || prev === 'to' || prev === '-'
              || (prev === 'i' && norms.slice(0, h.i).includes('mejdu'))
              || (prev === 'va' && norms.slice(h.i + h.len).includes('orasida')),
          });
          break;
        case 'service': if (!services.includes(e.code as ServiceCode)) services.push(e.code as ServiceCode); break;
        case 'kind': kind ??= e.code as TerminalKind; break;
        case 'category': cats.push(e.code as SearchCategory); break;
        case 'equipment': equipment ??= e.code as EquipmentKind; break;
        case 'deal': deal ??= e.code as DealKind; break;
        case 'near': nearWord = true; break;
        case 'bookable': bookable = true; break;
      }
    }
  }

  // Koridor: "Xdan Ygacha", "от X до Y", "X - Y", "X to Y", "X va Y orasida", "между X и Y"
  let corridor: SearchFilters['corridor'] = null;
  const b = regionHits.findIndex((h, idx) => idx > 0 && h.to);
  const a = regionHits.findIndex((h, idx) => h.from && (b < 0 || idx < b));
  if (b > 0) corridor = { from: regionHits[a >= 0 ? a : b - 1].code, to: regionHits[b].code };
  else if (a >= 0 && a + 1 < regionHits.length) corridor = { from: regionHits[a].code, to: regionHits[a + 1].code };
  if (corridor && corridor.from === corridor.to) corridor = null;

  // Yaqinlik: shahar koordinatasi (yoki opts.near), radius "N km" yoki 50. Nuqta bo'lgan shahar viloyat filtridan chiqadi.
  const point = corridor ? undefined : regionHits.find((h) => h.lat !== undefined);
  let near: SearchFilters['near'] = null;
  if (point && (nearWord || km !== null)) near = { lat: point.lat!, lng: point.lng!, radiusKm: km ?? 50 };
  else if (nearWord && opts.near) near = { ...opts.near, radiusKm: km ?? 50 };

  const regions: RegionCode[] = corridor
    ? corridorRegions(corridor.from, corridor.to)
    : [...new Set(regionHits.filter((h) => !(near && h === point)).map((h) => h.code))];

  // Kategoriya: aniq so'z (truck/terminal) yutadi; texnika + terminal xizmati birga kelsa null.
  const explicit = cats.find((c) => c !== 'equipment');
  const category: SearchCategory | null = explicit ?? (cats.includes('equipment') ? (services.length ? null : 'equipment') : null);

  const lang: SearchLang = opts.lang
    ?? (/[\u0400-\u04FF]/.test(q) ? (/[ўқғҳ]/i.test(q) ? 'uz' : 'ru') : en > uz ? 'en' : 'uz');

  const meaningful = state.filter((s) => s !== 'stop').length;
  const matched = state.filter((s) => s === 'hit').length;
  const confidence = meaningful ? Math.round((matched / meaningful) * 100) / 100 : 0;
  const unresolved = toks.filter((_, i) => state[i] === 'none').map((t) => t.raw);

  const filters: SearchFilters = {
    category, regions, corridor, near, services, kind,
    qty: Object.keys(qty).length ? qty : null,
    equipment, deal, bookable: bookable ? true : null, lang, confidence, unresolved, chips: [],
  };
  filters.chips = buildChips(filters);
  return filters;
}

function buildChips(f: SearchFilters): SearchChip[] {
  const chips: SearchChip[] = [];
  const chip = (type: SearchChip['type'], value: string) => chips.push({ key: `${type}:${value}`, type, value });
  if (f.category) chip('category', f.category);
  if (f.corridor) chip('corridor', `${f.corridor.from}>${f.corridor.to}`);
  else for (const r of f.regions) chip('region', r);
  if (f.near) chip('near', String(f.near.radiusKm));
  for (const s of f.services) chip('service', s);
  if (f.kind) chip('kind', f.kind);
  if (f.qty) for (const [k, v] of Object.entries(f.qty)) chip('qty', `${k}=${v}`);
  if (f.equipment) chip('equipment', f.equipment);
  if (f.deal) chip('deal', f.deal);
  if (f.bookable) chip('bookable', '1');
  return chips;
}

// ───────────────────────── Yorliqlar ─────────────────────────

export const SEARCH_LABELS: Record<SearchLang, {
  region: Record<RegionCode, string>; service: Record<ServiceCode, string>; kind: Record<TerminalKind, string>;
  category: Record<SearchCategory, string>; equipment: Record<EquipmentKind, string>; deal: Record<DealKind, string>;
}> = {
  uz: {
    region: {
      'UZ-TK': 'Toshkent', 'UZ-TO': 'Toshkent vil.', 'UZ-SI': 'Sirdaryo', 'UZ-JI': 'Jizzax', 'UZ-SA': 'Samarqand',
      'UZ-BU': 'Buxoro', 'UZ-NW': 'Navoiy', 'UZ-QA': 'Qashqadaryo', 'UZ-SU': 'Surxondaryo', 'UZ-XO': 'Xorazm',
      'UZ-QR': "Qoraqalpog'iston", 'UZ-AN': 'Andijon', 'UZ-NG': 'Namangan', 'UZ-FA': "Farg'ona",
    },
    service: { LOAD: 'Yuklash', UNLOAD: 'Tushirish', WEIGH: 'Tarozi', STORAGE: 'Saqlash', SVX: 'Bojxona ombori', CONTAINER: 'Konteyner', LAST_MILE: 'Avtoda yetkazish', SHUNTING: 'Manevr' },
    kind: { RAIL: "Temir yo'l yuk terminali", ROAD: 'Avto yuk terminali', MULTI: "Avto va temir yo'l" },
    category: { terminal: 'Terminal', equipment: "Temir yo'l texnikasi", truck: 'Avtotransport' },
    equipment: { SHUNTING_LOCO: 'Manevr teplovozi', WAGON: 'Vagon' },
    deal: { RENT: 'Ijara', SALE: 'Sotuv' },
  },
  ru: {
    region: {
      'UZ-TK': 'Ташкент', 'UZ-TO': 'Ташкентская обл.', 'UZ-SI': 'Сырдарья', 'UZ-JI': 'Джизак', 'UZ-SA': 'Самарканд',
      'UZ-BU': 'Бухара', 'UZ-NW': 'Навои', 'UZ-QA': 'Кашкадарья', 'UZ-SU': 'Сурхандарья', 'UZ-XO': 'Хорезм',
      'UZ-QR': 'Каракалпакстан', 'UZ-AN': 'Андижан', 'UZ-NG': 'Наманган', 'UZ-FA': 'Фергана',
    },
    service: { LOAD: 'Погрузка', UNLOAD: 'Выгрузка', WEIGH: 'Весы', STORAGE: 'Хранение', SVX: 'Таможенный склад', CONTAINER: 'Контейнер', LAST_MILE: 'Автодоставка', SHUNTING: 'Маневры' },
    kind: { RAIL: 'Железнодорожный терминал', ROAD: 'Автомобильный терминал', MULTI: 'Авто и ж/д' },
    category: { terminal: 'Терминал', equipment: 'Ж/д техника', truck: 'Автотранспорт' },
    equipment: { SHUNTING_LOCO: 'Маневровый тепловоз', WAGON: 'Вагон' },
    deal: { RENT: 'Аренда', SALE: 'Продажа' },
  },
  en: {
    region: {
      'UZ-TK': 'Tashkent', 'UZ-TO': 'Tashkent region', 'UZ-SI': 'Syrdarya', 'UZ-JI': 'Jizzakh', 'UZ-SA': 'Samarkand',
      'UZ-BU': 'Bukhara', 'UZ-NW': 'Navoi', 'UZ-QA': 'Kashkadarya', 'UZ-SU': 'Surkhandarya', 'UZ-XO': 'Khorezm',
      'UZ-QR': 'Karakalpakstan', 'UZ-AN': 'Andijan', 'UZ-NG': 'Namangan', 'UZ-FA': 'Fergana',
    },
    service: { LOAD: 'Loading', UNLOAD: 'Unloading', WEIGH: 'Weighing', STORAGE: 'Storage', SVX: 'Bonded warehouse', CONTAINER: 'Container', LAST_MILE: 'Truck delivery', SHUNTING: 'Shunting' },
    kind: { RAIL: 'Rail freight terminal', ROAD: 'Road freight terminal', MULTI: 'Road and rail' },
    category: { terminal: 'Terminal', equipment: 'Rail equipment', truck: 'Road transport' },
    equipment: { SHUNTING_LOCO: 'Shunting locomotive', WAGON: 'Wagon' },
    deal: { RENT: 'Rent', SALE: 'Sale' },
  },
};

// Miqdor so'zlari: uz o'zgarmas, en [birlik, ko'plik], ru [1, 2-4, 5+]
const QTY_WORDS: Record<SearchLang, Record<string, string[]>> = {
  uz: { wagons: ['vagon'], tonnes: ['tonna'], containers: ['konteyner'] },
  ru: { wagons: ['вагон', 'вагона', 'вагонов'], tonnes: ['тонна', 'тонны', 'тонн'], containers: ['контейнер', 'контейнера', 'контейнеров'] },
  en: { wagons: ['wagon', 'wagons'], tonnes: ['tonne', 'tonnes'], containers: ['container', 'containers'] },
};
function qtyWord(lang: SearchLang, unit: string, n: number): string {
  const w = QTY_WORDS[lang][unit] ?? [unit];
  if (w.length < 3) return w[n === 1 ? 0 : w.length - 1];
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return w[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return w[1];
  return w[2];
}

/** Chip uchun qisqa yorliq: "Andijon", "Termiz → Toshkent", "50 km ichida", "20 vagon", "Bugun bo'sh". */
export function chipLabel(chip: SearchChip, lang: SearchLang): string {
  const L = SEARCH_LABELS[lang];
  const v = chip.value;
  switch (chip.type) {
    case 'category': return L.category[v as SearchCategory] ?? v;
    case 'region': return L.region[v as RegionCode] ?? v;
    case 'corridor': { const [a, b] = v.split('>') as RegionCode[]; return `${L.region[a] ?? a} → ${L.region[b] ?? b}`; }
    case 'near': return lang === 'ru' ? `в радиусе ${v} км` : lang === 'en' ? `within ${v} km` : `${v} km ichida`;
    case 'service': return L.service[v as ServiceCode] ?? v;
    case 'kind': return L.kind[v as TerminalKind] ?? v;
    case 'qty': { const [unit, num] = v.split('='); return `${num} ${qtyWord(lang, unit, Number(num))}`; }
    case 'equipment': return L.equipment[v as EquipmentKind] ?? v;
    case 'deal': return L.deal[v as DealKind] ?? v;
    case 'bookable': return lang === 'ru' ? 'Свободно сегодня' : lang === 'en' ? 'Free today' : "Bugun bo'sh";
  }
}
