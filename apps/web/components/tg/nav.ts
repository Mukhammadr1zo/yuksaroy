// Mini App tab paneli: besh ildiz va har bir yo'l qaysi tabga tegishli. Yo'llar til prefiksisiz (usePathname shunday beradi).
export type TabKey = 'home' | 'search' | 'map' | 'my' | 'profile';

export const TAB_ROOT: Record<TabKey, string> = { home: '/tg', search: '/tg/search', map: '/tg/map', my: '/tg/my', profile: '/tg/profile' };

// Tartib muhim: /tg/urgent/... (tafsilot va takliflar) Ishlarimga, /tg/urgent o'zi (forma) esa bosh sahifaga tegishli
const RULES: [RegExp, TabKey][] = [
  [/^\/tg\/(search|terminals|equipment|carriers|book|cargo)(\/|$)/, 'search'],
  [/^\/tg\/map(\/|$)/, 'map'],
  [/^\/tg\/urgent\/./, 'my'],
  [/^\/tg\/(my|orders|listings)(\/|$)/, 'my'],
  [/^\/tg\/(profile|subscription)(\/|$)/, 'profile'],
];

/** Yo'l -> tab. Tanilmagan yo'l (va /tg, /tg/wagon, /tg/urgent) bosh sahifa tabida. */
export function tabOf(pathname: string): TabKey {
  const p = pathname.replace(/\/+$/, '') || '/';
  for (const [re, k] of RULES) if (re.test(p)) return k;
  return 'home';
}

/** Ildiz sahifami (query hisobga olinmaydi). */
export const isTabRoot = (pathname: string) => Object.values(TAB_ROOT).includes(pathname.replace(/\/+$/, ''));

/**
 * Haqiqiy query bormi. So'rov hisoblanmaydi: xarita kamerasi (c, z, manzilga o'zi yoziladi), bo'sh qiymat (?q=) va
 * Telegram ochilishda qo'shadigan tgWebAppStartParam. Aks holda ildiz sahifada Orqaga tugmasi chiqib qolardi.
 */
export function hasRealQuery(pathname: string, search: string) {
  const q = new URLSearchParams(search);
  q.delete('tgWebAppStartParam');
  if (pathname.replace(/\/+$/, '') === TAB_ROOT.map) { q.delete('c'); q.delete('z'); }
  let real = false;
  q.forEach((v) => { if (v) real = true; });
  return real;
}
