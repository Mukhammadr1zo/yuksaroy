'use client';
// Telegram Mini App qobig'i: WebApp'ni o'qiydi (ready, expand, tema, viewport), initData bilan avtomatik kiradi (Bearer token sessionStorage'da),
// pastki tab panelini va BackButton'ni (ildizlardan tashqarida) boshqaradi, start_param bo'yicha yo'naltiradi, foydalanuvchi tili bo'yicha /ru yoki /en ga o'tkazadi.
// Telegram tashqarisida (WebApp yo'q yoki initData bo'sh) faqat "Telegram ichida oching" sahifasi.
import { Suspense, createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { TelegramLogoIcon } from '@phosphor-icons/react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { api, post, setTgTokens, tgTokens } from '@/lib/api';
import type { LoginResponse, Me } from '@/lib/types-auth';
import { TabBar } from './TabBar';
import { TAB_ROOT, hasRealQuery, isTabRoot, tabOf } from './nav';

export interface TgWebApp {
  initData: string;
  initDataUnsafe: { start_param?: string; user?: { id: number; first_name: string; last_name?: string; username?: string; language_code?: string; photo_url?: string } };
  version: string; platform: string; colorScheme: 'light' | 'dark';
  themeParams: Partial<Record<'bg_color' | 'secondary_bg_color' | 'text_color' | 'hint_color' | 'link_color' | 'button_color' | 'button_text_color' | 'header_bg_color', string>>;
  viewportStableHeight: number;
  ready(): void; expand(): void; close(): void;
  onEvent(e: string, cb: () => void): void; offEvent(e: string, cb: () => void): void;
  openLink(url: string, o?: { try_instant_view?: boolean }): void; openTelegramLink(url: string): void;
  requestContact?(cb?: (sent: boolean) => void): void;
  showConfirm?(message: string, cb?: (ok: boolean) => void): void;
  enableClosingConfirmation(): void; disableClosingConfirmation(): void;
  // Bot API 7.7+: eski mijozlarda yo'q, shuning uchun ixtiyoriy (xarita sahifasi suzishni o'chiradi)
  disableVerticalSwipes?(): void; enableVerticalSwipes?(): void;
  // Bot API 6.1+ (bottom bar 7.10+): sarlavha, fon va pastki panel rangi; eski mijozlarda yo'q yoki xato beradi
  setHeaderColor?(c: string): void; setBackgroundColor?(c: string): void; setBottomBarColor?(c: string): void;
  HapticFeedback?: { impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void; notificationOccurred(type: 'error' | 'success' | 'warning'): void };
  BackButton: { isVisible: boolean; show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
  MainButton: {
    text: string; isVisible: boolean; isActive: boolean;
    setParams(p: { text?: string; color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }): void;
    show(): void; hide(): void; enable(): void; disable(): void; showProgress(leaveActive?: boolean): void; hideProgress(): void;
    onClick(cb: () => void): void; offClick(cb: () => void): void;
  };
}
declare global { interface Window { Telegram?: { WebApp: TgWebApp } } }

export const BOT = process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'yuksaroy_bot';
type Status = 'boot' | 'in' | 'out' | 'error';
interface Ctx {
  tg: TgWebApp | null; status: Status; me: Me | null; needsPhone: boolean; startParam: string | null;
  setMe: (m: Me) => void; relogin: () => Promise<void>; logout: () => Promise<void>;
}
const TgCtx = createContext<Ctx>({ tg: null, status: 'boot', me: null, needsPhone: false, startParam: null, setMe: () => {}, relogin: async () => {}, logout: async () => {} });
export const useTg = () => useContext(TgCtx);

/** Yengil titrash: tanlov, qadam, yuborish. Telegram tashqarisida yo'q. */
export const haptic = (style: 'light' | 'medium' = 'light') => { try { window.Telegram?.WebApp.HapticFeedback?.impactOccurred(style); } catch { /* eski versiya */ } };
/** Tasdiq: Telegram oynasi, bo'lmasa brauzer confirm. */
export const confirmTg = (tg: TgWebApp | null, message: string) =>
  new Promise<boolean>((res) => { if (tg?.showConfirm) tg.showConfirm(message, res); else res(window.confirm(message)); });

// MainButton ko'rinadimi: tab paneli shu paytda yashirinadi (ikki pastki panel ustma-ust turmasin).
// Modul darajasidagi do'kon: useMainButton istalgan sahifada, panel esa qobiqda.
let mainShown = false;
const mainSubs = new Set<() => void>();
let mainTimer = 0;
const applyMain = (v: boolean) => { if (mainShown !== v) { mainShown = v; mainSubs.forEach((f) => f()); } };
// Ko'rsatish (panelni yashirish) darhol, qaytarish 200 ms kechikadi: MainButton'li ikki sahifa orasida panel bir lahzaga chiqib ketmasin
const setMainShown = (v: boolean) => { window.clearTimeout(mainTimer); if (v) applyMain(true); else mainTimer = window.setTimeout(() => applyMain(false), 200); };
const subMain = (f: () => void) => { mainSubs.add(f); return () => { mainSubs.delete(f); }; };
const getMain = () => mainShown;

/** MainButton: matn, bosish, ko'rinish, faollik, jarayon. Sahifadan chiqganda yashiriladi. */
export function useMainButton({ text, onClick, show = true, disabled = false, busy = false }: { text: string; onClick: () => void; show?: boolean; disabled?: boolean; busy?: boolean }) {
  const { tg } = useTg();
  const cb = useRef(onClick);
  cb.current = onClick;
  // Layout effekt: panel bo'yashdan oldin yashirinadi, MainButton'li sahifa ochilganda bir kadr ham ko'rinib qolmaydi
  useLayoutEffect(() => {
    if (!tg) return;
    setMainShown(show);
    return () => setMainShown(false);
  }, [tg, show]);
  useEffect(() => {
    if (!tg) return;
    const h = () => cb.current();
    tg.MainButton.onClick(h);
    return () => { tg.MainButton.offClick(h); tg.MainButton.hide(); };
  }, [tg]);
  useEffect(() => {
    if (!tg) return;
    tg.MainButton.setParams({ text, is_visible: show, is_active: !disabled && !busy });
    if (busy) tg.MainButton.showProgress(true); else tg.MainButton.hideProgress();
  }, [tg, text, show, disabled, busy]);
}

/** Saqlanmagan forma: yopishdan oldin Telegram tasdiq so'raydi. */
export function useClosingConfirmation(dirty: boolean) {
  const { tg } = useTg();
  useEffect(() => {
    if (!tg) return;
    if (dirty) tg.enableClosingConfirmation(); else tg.disableClosingConfirmation();
    return () => tg.disableClosingConfirmation();
  }, [tg, dirty]);
}

const THEME_KEYS = ['bg_color', 'secondary_bg_color', 'text_color', 'hint_color', 'link_color', 'button_color', 'button_text_color', 'header_bg_color'] as const;
function applyTheme(tg: TgWebApp) {
  // Telegram oynasi sahifa bilan birlashsin: sahifa foni Telegram bg_color (tg.css)
  for (const m of ['setHeaderColor', 'setBackgroundColor', 'setBottomBarColor'] as const) { try { tg[m]?.('bg_color'); } catch { /* eski mijoz */ } }
  const r = document.documentElement;
  for (const k of THEME_KEYS) { const v = tg.themeParams[k]; if (v) r.style.setProperty(`--tg-theme-${k.replace(/_/g, '-')}`, v); }
  r.dataset.tgScheme = tg.colorScheme;
}
const applyViewport = (tg: TgWebApp) => document.documentElement.style.setProperty('--tg-vh', `${tg.viewportStableHeight}px`);

/** start_param -> Mini App yo'li. Tanilmasa null. */
export function routeOfStartParam(sp: string): string | null {
  const [kind, ...rest] = sp.split('_');
  const v = rest.join('_');
  if (!v) return null;
  if (kind === 'terminal') return `/tg/terminals/${v}`;
  if (kind === 'listing') return `/tg/equipment/${v}`; // TRUCK bo'lsa sahifa /tg/carriers ga o'tkazadi
  if (kind === 'urgent') return `/tg/urgent/${v}`;
  // Yuk xabaridagi "Taklif yuborish" tugmasi sahifani o'zi ochadi; cargo_<raqam> ulashilgan havola uchun
  if (kind === 'cargo') return `/tg/cargo/${encodeURIComponent(v)}`;
  if (kind === 'order') return `/tg/orders/${v}`;
  if (kind === 'search') {
    try { return `/tg/search?q=${encodeURIComponent(new TextDecoder().decode(Uint8Array.from(atob(v.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))))}`; } catch { return null; }
  }
  return null;
}

export function TgProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const [tg, setTg] = useState<TgWebApp | null>(null);
  const [status, setStatus] = useState<Status>('boot');
  const [me, setMe] = useState<Me | null>(null);
  const [startParam, setStartParam] = useState<string | null>(null);
  const routed = useRef(false);
  // start_param bilan ochilganda yo'naltirish tugamaguncha Bosh sahifa chizilmasin (bir lahza miltillab qolardi)
  const [routedDone, setRoutedDone] = useState(false);

  const login = useCallback(async (w: TgWebApp) => {
    setStatus('boot');
    try {
      // Sessiya bor bo'lsa qayta kirilmaydi (audit va sessiya qatorlari ko'paymasin)
      if (tgTokens()) {
        const m = await api<Me>('/auth/me').catch(() => null);
        if (m) { setMe(m); setStartParam(w.initDataUnsafe.start_param ?? null); setStatus('in'); return; }
        setTgTokens(null);
      }
      const r = await post<LoginResponse & { startParam: string | null }>('/auth/telegram-webapp', { initData: w.initData, startParam: w.initDataUnsafe.start_param });
      setTgTokens({ access: r.accessToken, refresh: r.refreshToken });
      setMe(r.user); setStartParam(r.startParam); setStatus('in');
    } catch { setStatus('error'); }
  }, []);

  // 1) WebApp: tashqarida bo'lsa fallback; ichida bo'lsa tema, viewport va kirish
  useEffect(() => {
    const w = window.Telegram?.WebApp;
    if (!w || !w.initData) { setStatus('out'); return; }
    w.ready(); w.expand();
    applyTheme(w); applyViewport(w);
    const onTheme = () => applyTheme(w), onVp = () => applyViewport(w);
    w.onEvent('themeChanged', onTheme); w.onEvent('viewportChanged', onVp);
    setTg(w);
    void login(w);
    return () => { w.offEvent('themeChanged', onTheme); w.offEvent('viewportChanged', onVp); };
  }, [login]);

  // 2) BackButton BackSync ichida (query kerak); qobiq yopilsa tugma ishlovchisiz osilib qolmasin
  useEffect(() => () => tg?.BackButton.hide(), [tg]);

  // 3) Kirilgach bir marta: foydalanuvchi tili va start_param yo'nalishi
  useEffect(() => {
    if (status !== 'in' || !me || routed.current) return;
    routed.current = true;
    const to = startParam && pathname === '/tg' ? routeOfStartParam(startParam) : null;
    const lang = me.locale && (routing.locales as readonly string[]).includes(me.locale) && me.locale !== locale ? (me.locale as (typeof routing.locales)[number]) : null;
    if (to) router.replace(to, lang ? { locale: lang } : undefined);
    else { setRoutedDone(true); if (lang) router.replace(`${pathname}${window.location.search}`, { locale: lang }); }
  }, [status, me, startParam, pathname, locale, router]);
  // Yo'naltirish yetib kelguncha kutiladi (darhol tugatilsa Asosiy sahifa bir lahza ko'rinib qolardi).
  // Yetib kelgach yoki 4 soniyada kelmasa kutish tugaydi: keyin Asosiy tabiga qaytilganda u odatdagidek ochiladi.
  useEffect(() => {
    if (routedDone || !routed.current) return;
    if (pathname !== '/tg') { setRoutedDone(true); return; }
    const id = window.setTimeout(() => setRoutedDone(true), 4000);
    return () => window.clearTimeout(id);
  }, [pathname, routedDone, status, me]);

  const relogin = useCallback(async () => { if (tg) { setTgTokens(null); await login(tg); } }, [tg, login]);
  const logout = useCallback(async () => {
    await post('/auth/logout', { refreshToken: tgTokens()?.refresh }).catch(() => {}); // sessiya serverda ham yopiladi
    setTgTokens(null); setMe(null); setStatus('out');
  }, []);

  const mainVisible = useSyncExternalStore(subMain, getMain, () => false);
  const typing = useTyping(pathname);
  const waiting = status === 'in' && !routedDone && !!startParam && pathname === '/tg' && !!routeOfStartParam(startParam);
  const bar = status === 'in' && !waiting && !mainVisible && !typing;

  const ctx: Ctx = { tg, status, me, needsPhone: !!me && !me.phone, startParam, setMe, relogin, logout };
  return (
    <TgCtx.Provider value={ctx}>
      {/* data-tabbar: --tg-tabbar-space va pastki bo'shliq shundan (tg.css), kontent panel ostida qolmaydi */}
      <div className="tg-root" data-tabbar={bar ? '' : undefined}>
        {status === 'out' ? <Fallback loggedOut={!!tg} tg={tg} /> : status === 'error' ? <BootError onRetry={relogin} /> : status === 'boot' || waiting ? <Boot /> : children}
        {status === 'in' && !waiting ? <TabBar hidden={!bar} /> : null}
      </div>
      {/* useSearchParams statik render'ni buzmasin: alohida Suspense ichida */}
      <Suspense fallback={null}><BackSync tg={tg} off={status === 'out'} /></Suspense>
    </TgCtx.Provider>
  );
}

// Matn kiritiladigan maydonlar: klaviatura ochiladi, panel yashiriladi
const NON_TEXT = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit']);
// disabled/readOnly maydon klaviatura ochmaydi (fokusdagi maydon disabled bo'lsa focusout kelmasligi mumkin)
const editable = (el: Element | null) =>
  (el instanceof HTMLTextAreaElement && !el.disabled && !el.readOnly) || (el instanceof HTMLInputElement && !NON_TEXT.has(el.type) && !el.disabled && !el.readOnly) || (el instanceof HTMLElement && el.isContentEditable);

/**
 * Klaviatura ochiqmi (matn maydonida fokus). Yashirish darhol, qaytarish 100 ms kechikib:
 * bir maydondan ikkinchisiga o'tishda panel miltillamaydi. Sahifa almashganda qayta tekshiriladi,
 * chunki fokusdagi maydon o'chirilganda brauzer focusout bermasligi mumkin.
 */
function useTyping(pathname: string) {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    let timer = 0;
    // shut: maydon fokusda, lekin klaviatura yopilgan. Androidda tizim "Orqaga"si klaviaturani yopadi, fokus esa qoladi va
    // focusout kelmaydi; buni oyna balandligi to'liq holatiga qaytganidan bilamiz. Balandlik yana kamaysa klaviatura qayta ochilgan.
    let shut = false;
    // low: klaviatura balandligidagi oyna ko'rilgan va hali qaytmagan. Faqat shundan keyingi qaytish "klaviatura yopildi" deb olinadi:
    // aks holda klaviatura ochilayotgandagi kichik qadamlar yoki Telegram tugmasi (~56 px) panelni bir lahza ko'rsatib qo'yardi
    let low = false;
    const vv = window.visualViewport;
    let full = vv?.height ?? 0;
    const read = () => editable(document.activeElement) && !shut;
    const onIn = (e: FocusEvent) => { if (editable(e.target as Element)) { shut = false; window.clearTimeout(timer); setTyping(true); } };
    const onOut = () => { window.clearTimeout(timer); timer = window.setTimeout(() => setTyping(read()), 100); };
    const onVv = () => {
      if (!vv) return;
      full = Math.max(full, vv.height);
      if (vv.height < full - 120) { low = true; shut = false; } // klaviatura kamida 200 px
      else if (low) { low = false; shut = true; }
      else return;
      if (editable(document.activeElement)) setTyping(!shut);
    };
    // Zaxira: bosish bilan holat qayta tekshiriladi (maydon o'chirilsa yoki almashsa focusout kelmaganda panel yashirin qolmasin)
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    document.addEventListener('pointerdown', onOut);
    vv?.addEventListener('resize', onVv);
    return () => { window.clearTimeout(timer); document.removeEventListener('focusin', onIn); document.removeEventListener('focusout', onOut); document.removeEventListener('pointerdown', onOut); vv?.removeEventListener('resize', onVv); };
  }, []);
  useEffect(() => { setTyping(editable(document.activeElement)); }, [pathname]);
  return typing;
}

/**
 * Telegram BackButton: besh ildizda (querysiz) yashirin, qolgan hamma joyda ko'rinadi (/tg/search?q=... ham).
 * Orqaga qadam bo'lmasa (chuqur havola bilan ochilgan) shu tabning ildiziga o'tiladi, doim /tg ga emas.
 */
function BackSync({ tg, off }: { tg: TgWebApp | null; off: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString(); // .size eski WebView'larda yo'q
  const hasQuery = hasRealQuery(pathname, search); // xarita kamerasi (c, z) so'rov emas
  useEffect(() => {
    if (!tg) return;
    const back = () => {
      const root = TAB_ROOT[tabOf(pathname)];
      // navigation.canGoBack (Android WebView, yangi iOS) aniq javob beradi
      const can = (window as { navigation?: { canGoBack?: boolean } }).navigation?.canGoBack;
      if (can === false || (can === undefined && window.history.length <= 1)) { router.replace(root); return; }
      router.back();
      if (can) return;
      // Eski iOS: history.length oldinga yozuvlarni ham sanaydi, shuning uchun birinchi yozuvda back() jim qoladi.
      // Tarixda siljish bo'lmasa (popstate kelmasa) shu tabning ildiziga o'tiladi: tugma o'lik bo'lib qolmaydi.
      // 600 ms: sekin qurilmada kechikkan siljish ustidan yozib yubormaslik uchun; xarita kamerasi replaceState qilsa ham adashmaydi.
      const path = window.location.pathname;
      let moved = false;
      const onPop = () => { moved = true; };
      window.addEventListener('popstate', onPop, { once: true });
      window.setTimeout(() => {
        window.removeEventListener('popstate', onPop);
        if (!moved && window.location.pathname === path) router.replace(root);
      }, 600);
    };
    tg.BackButton.onClick(back);
    if (off || (isTabRoot(pathname) && !hasQuery)) tg.BackButton.hide(); else tg.BackButton.show(); // chiqilgach fallback'da orqaga tugma yo'q
    return () => tg.BackButton.offClick(back);
  }, [tg, pathname, hasQuery, router, off]);
  return null;
}

function Boot() {
  const t = useTranslations('tg.boot');
  return (
    <div className="mx-auto max-w-md px-4 py-6" aria-busy="true">
      <p className="text-sm text-muted">{t('loading')}</p>
      <div className="mt-4 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-card bg-line/60" />)}</div>
    </div>
  );
}

function BootError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('tg.boot');
  return (
    <div className="mx-auto max-w-md px-4 py-10 text-center">
      <p role="alert" className="text-sm">{t('failed')}</p>
      <button type="button" onClick={onRetry} className="mt-4 min-h-11 rounded-full bg-teal px-6 font-semibold text-white">{t('retry')}</button>
    </div>
  );
}

/** Telegram tashqarisida (yoki chiqilgach): botga havola va oddiy sayt. */
function Fallback({ loggedOut, tg }: { loggedOut: boolean; tg: TgWebApp | null }) {
  const t = useTranslations('tg.fallback');
  const tp = useTranslations('tg.profile');
  const locale = useLocale();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-12 text-center">
      <p className="font-display text-lg font-bold tracking-tight text-navy">YukSaroy</p>
      <TelegramLogoIcon size={56} weight="duotone" className="mt-6 text-teal" aria-hidden="true" />
      <h1 className="font-display mt-4 text-2xl font-bold">{t('title')}</h1>
      <p className="mt-3 max-w-[40ch] text-muted">{loggedOut ? tp('loggedOut') : t('body')}</p>
      <a href={`https://t.me/${BOT}/app`} className="mt-8 flex min-h-12 w-full max-w-xs items-center justify-center rounded-full bg-teal px-6 font-semibold text-white">{t('open')}</a>
      {/* Telegram ichida (chiqilgan holat) sayt web view'ni almashtirmasin: tashqi brauzerda ochiladi */}
      <Link
        href="/"
        onClick={(e) => { if (tg) { e.preventDefault(); tg.openLink(`${window.location.origin}${locale === 'uz' ? '' : `/${locale}`}`); } }}
        className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-teal-ink underline"
      >{t('site')}</Link>
    </div>
  );
}
