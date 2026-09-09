// Solishtirish savati: localStorage "ys-compare", har kategoriyada ko'pi bilan 3 ta. useSyncExternalStore uchun do'kon.
export type CompareCat = 'terminals' | 'equipment' | 'carriers';
export interface CompareItem { slug: string; name: string }
export type CompareState = Record<CompareCat, CompareItem[]>;

export const COMPARE_MAX = 3;
const KEY = 'ys-compare';
const EMPTY: CompareState = { terminals: [], equipment: [], carriers: [] };
let cache: CompareState | null = null;
const listeners = new Set<() => void>();

function read(): CompareState {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<CompareState> | null;
    return { terminals: p?.terminals ?? [], equipment: p?.equipment ?? [], carriers: p?.carriers ?? [] };
  } catch { return EMPTY; }
}
function write(next: CompareState) {
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
  listeners.forEach((l) => l());
}
const onStorage = (e: StorageEvent) => { if (e.key === KEY) { cache = null; listeners.forEach((l) => l()); } };

export const getCompare = (): CompareState => (cache ??= read());
export const getCompareServer = (): CompareState => EMPTY;
export function subscribeCompare(cb: () => void) {
  listeners.add(cb);
  if (listeners.size === 1) window.addEventListener('storage', onStorage);
  return () => { listeners.delete(cb); if (!listeners.size) window.removeEventListener('storage', onStorage); };
}

/** Qo'shadi yoki olib tashlaydi; savat to'la bo'lsa false. */
export function toggleCompare(cat: CompareCat, item: CompareItem): boolean {
  const s = getCompare();
  const has = s[cat].some((x) => x.slug === item.slug);
  if (!has && s[cat].length >= COMPARE_MAX) return false;
  write({ ...s, [cat]: has ? s[cat].filter((x) => x.slug !== item.slug) : [...s[cat], item] });
  return true;
}
export const removeCompare = (cat: CompareCat, slug: string) => write({ ...getCompare(), [cat]: getCompare()[cat].filter((x) => x.slug !== slug) });
export const clearCompare = (cat: CompareCat) => write({ ...getCompare(), [cat]: [] });
export const compareHref = (cat: CompareCat, slugs: string[]) => `/${cat}/compare?ids=${slugs.map(encodeURIComponent).join(',')}`;

/** ?ids=slug,slug -> noyob sluglar, ko'pi bilan 3 ta (ochiq identifikator slug; API tafsilotni slug bo'yicha beradi). */
export const parseIds = (v: string) => [...new Set(v.split(',').map((s) => s.trim()).filter(Boolean))].slice(0, COMPARE_MAX);
