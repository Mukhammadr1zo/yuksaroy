/**
 * Cookie roziligi: 'ys-consent' kalitidagi uchta holat. useSyncExternalStore uchun do'kon,
 * naqshi lib/compare.ts bilan bir xil.
 *
 * Rozilikning O'ZI ruxsat so'ramaydi va shu ataylab: odamning "kerak emas" degani eslab
 * qolinmasa, chiziq har sahifada qaytib chiqardi va biz uning javobini e'tiborsiz
 * qoldirgan bo'lardik. Ya'ni bu yozuv tanlovni BAJARISH uchun shart, boshqa ishga emas.
 * Ichida faqat tanlov va sana turadi.
 */
export type Consent = 'ask' | 'yes' | 'no';

/**
 * Chiziq ham, mayoq ham chizilmaydigan yo'llar: kabinet, admin paneli va Telegram ilovasi.
 * Bitta joyda: ikkita faylda ikkita ro'yxat bo'lsa, biri yangilanib ikkinchisi qolib ketardi.
 * Bu yo'llarda rozilik talab qiladigan yozuvning o'zi yo'q, ya'ni so'rashga ham hojat yo'q.
 */
export const PRIVATE_PATH = /^\/(dashboard|admin|tg)(\/|$)/;

const KEY = 'ys-consent';
let cache: Consent | null = null;
const listeners = new Set<() => void>();

function read(): Consent {
  // try/catch: maxfiy oynada localStorage o'qishning o'zi xato berishi mumkin
  try {
    const v = (JSON.parse(localStorage.getItem(KEY) || 'null') as { choice?: string } | null)?.choice;
    return v === 'yes' || v === 'no' ? v : 'ask';
  } catch { return 'ask'; }
}

// Boshqa varaqda javob berilsa shu varaq ham biladi: ikkita varaqda ikkita chiziq qolmasin
const onStorage = (e: StorageEvent) => { if (e.key === KEY) { cache = null; listeners.forEach((l) => l()); } };

/** Serverda brauzer xotirasi yo'q: hali so'ralmagan holat, haqiqiysi mijozda aniqlanadi. */
export const getConsentServer = (): Consent => 'ask';
export const getConsent = (): Consent => (cache ??= read());

export function subscribeConsent(cb: () => void) {
  listeners.add(cb);
  if (listeners.size === 1) window.addEventListener('storage', onStorage);
  return () => { listeners.delete(cb); if (!listeners.size) window.removeEventListener('storage', onStorage); };
}

/**
 * Javobni yozadi. Yoza olmasak (maxfiy oyna) xotiradagi nusxa qoladi: shu varaqda chiziq
 * qaytib chiqmaydi va tanlov ishlaydi, varaq yopilsa esa keyingi safar yana so'raladi.
 */
export function setConsent(choice: 'yes' | 'no') {
  cache = choice;
  try { localStorage.setItem(KEY, JSON.stringify({ choice, at: new Date().toISOString() })); } catch { /* maxfiy oyna */ }
  listeners.forEach((l) => l());
}
