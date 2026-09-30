'use client';
/**
 * Admin qobig'i: huquqni bir marta tekshiradi, chap menyu, yuqori panel, buyruq paleti va
 * klaviatura yo'llarini chizadi; kim kirgani va navbat sonlarini AdminContext orqali beradi.
 *
 * Tekshiruv klientda, chunki admin so'rovlari httpOnly cookie bilan ketadi va server
 * komponentidan ular uzatilmaydi. Bu yagona to'siq emas: haqiqiy himoya API tomonida,
 * PlatformAdminGuard da. Bu yerdagi tekshiruv faqat noto'g'ri ekran ko'rsatmaslik uchun.
 *
 * /auth/me ni o'zi chaqirmaydi: sayt bilan bir xil useMe() (sessionStorage 60 s kesh, bitta
 * inflight so'rov), aks holda qobiq, UserMenu va ekranlar bir odamni uch marta so'rardi.
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useMe } from '@/components/site/useMe';
import { Drawer, Skeleton } from './kit';
import { AdminContext, type AdminCtx } from './context';
import { AdminNav, GROUPS } from './AdminNav';
import { AdminTopbar } from './AdminTopbar';
import { CommandPalette } from './CommandPalette';

/** Yig'ilgan menyu holati: faqat qulaylik, xususiy rejimda otsa ochiq qoladi. */
const NAV_KEY = 'ys-admin-nav';
/** "g" dan keyin harf shuncha ms ichida bosilishi kerak, aks holda oddiy harf. */
const CHORD_MS = 800;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('admin');
  const ts = useTranslations('admin.shell');
  const me = useMe();
  const path = usePathname();
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [crumb, setCrumb] = useState<string | null>(null);
  const [navMin, setNavMin] = useState(false);
  const [menu, setMenu] = useState(false);
  const [palette, setPalette] = useState<'search' | 'keys' | null>(null);

  const isAdmin = !!me?.isPlatformAdmin;
  const isOwner = !!me?.isPlatformOwner;

  // localStorage effect ichida: server va mijoz birinchi chizishda bir xil (ochiq) bo'lsin
  useEffect(() => { try { setNavMin(localStorage.getItem(NAV_KEY) === '1'); } catch { /* xususiy rejim */ } }, []);
  const toggleNav = useCallback(() => setNavMin((v) => {
    try { localStorage.setItem(NAV_KEY, v ? '0' : '1'); } catch { /* xususiy rejim */ }
    return !v;
  }), []);

  /*
   * Menyudagi "kutilmoqda" sonlari. Qobiq admin maketida bir marta yaratiladi va sahifalar
   * almashganda qayta yaratilmaydi, shuning uchun ilgari bu so'rov butun sessiyada
   * bir marta ketardi: sakkizta e'lon tasdiqlangach ham yon menyuda "8" turaverardi,
   * bosh sahifadagi navbat esa "0" ko'rsatardi. Ikki xil raqam, bitta ekranda.
   * Endi har admin sahifasiga o'tganda yangilanadi. Yorliq almashganda emas:
   * u faqat ?tab= ni o'zgartiradi, usePathname esa so'rov qismini olib tashlaydi.
   * Uch kalit: moderatsiya yig'indisi, kutayotgan buyurtma, ochiq shoshilinch so'rov.
   */
  useEffect(() => {
    if (!isAdmin) return;
    api<{ counts: Record<string, number> }>('/admin/health')
      .then((h) => {
        const c = h.counts ?? {};
        // Murojaat va shikoyat ham moderatsiya sahifasining yorlig'i: menyu va sahifa bir xil raqam ko'rsatsin
        setCounts({
          pending: (c.listingsPendingReview ?? 0) + (c.orgsPendingKyc ?? 0) + (c.terminalClaimsPending ?? 0) + (c.premiumPending ?? 0) + (c.subscriptionPending ?? 0) + (c.contactNew ?? 0) + (c.reportsNew ?? 0),
          ordersPending: c.ordersPending ?? 0,
          urgentOpen: c.urgentOpen ?? 0,
        });
      })
      .catch(() => {});
  }, [isAdmin, path]);

  // Mobil varaq havola bosilganda yopiladi (onNavigate), sahifa almashganda ham: orqaga tugmasi bilan ochiq qolmasin
  useEffect(() => { setMenu(false); }, [path]);

  const openPalette = useCallback((mode: 'search' | 'keys' = 'search') => setPalette(mode), []);
  const closePalette = useCallback(() => setPalette(null), []);

  /*
   * Klaviatura yo'llari: Ctrl+K paleta, g+harf bo'lim, [ menyu, / qidiruv kataki, ? yo'llar.
   * Kirish kataklarida va ochiq dialogda (varaq, paleta) ishlamaydi: matn yozayotgan odam
   * "g" bosganda sahifa almashmasin. Ctrl/Alt/Meta bilan (Ctrl+K dan tashqari) ham yo'q:
   * brauzer yo'llari bilan to'qnashmasin. '/' faqat data-search kataki bo'lsa preventDefault
   * qiladi: Firefox tez qidiruvi boshqa sahifalarda ishlayversin.
   */
  useEffect(() => {
    if (!isAdmin) return;
    let chordAt = 0;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette('search'); return; }
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (document.querySelector('[role="dialog"]')) return;
      const now = Date.now();
      if (chordAt && now - chordAt < CHORD_MS) {
        chordAt = 0;
        const hit = GROUPS.flatMap((g) => g.items).find((it) => it.hotkey === e.key && (!it.owner || isOwner));
        if (hit) { e.preventDefault(); router.push(hit.href); }
        return;
      }
      switch (e.key) {
        case 'g': chordAt = now; return;
        case '[': e.preventDefault(); toggleNav(); return;
        case '?': e.preventDefault(); setPalette('keys'); return;
        case '/': {
          const s = document.querySelector<HTMLElement>('input[data-search]');
          if (s) { e.preventDefault(); s.focus(); }
          return;
        }
        default: return;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isAdmin, isOwner, router, toggleNav]);

  const ctx = useMemo<AdminCtx | null>(
    () => (me && isAdmin ? { me, isOwner, counts, crumb, setCrumb, openPalette } : null),
    [me, isAdmin, isOwner, counts, crumb, openPalette],
  );

  // Tekshirilmoqda: qobiq skeleti, joylar keyin sakramasin
  // Quyidagi uchta <main> ga ham id="main" qo'yilgan: ular bir-birini istisno qiladigan
  // tarmoqlar (tekshirilmoqda / huquq yo'q / panel), ya'ni bir vaqtda faqat bittasi chiziladi
  // va sahifada id takrorlanmaydi. Sakrash havolasi qaysi holat bo'lsa ham manzilni topadi.
  if (me === undefined) {
    return (
      <div className="min-h-dvh lg:grid lg:grid-cols-[208px_minmax(0,1fr)]" aria-busy="true">
        <aside className="hidden border-r border-line/70 lg:block" />
        <div className="min-w-0">
          <div className="h-[52px] border-b border-line/70" />
          <main id="main" className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6"><Skeleton rows={3} /></main>
        </div>
      </div>
    );
  }
  // Huquq yo'q: menyu ham, panel ham chizilmaydi, faqat saytga qaytish yo'li
  if (!ctx) {
    return (
      <main id="main" className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6">
        <p role="alert" className="text-sm text-muted">{t('forbidden')}</p>
        <Link href="/" className="mt-3 inline-block text-sm font-semibold text-teal-ink hover:underline">{ts('site')}</Link>
      </main>
    );
  }

  return (
    <AdminContext.Provider value={ctx}>
      {/* Chapda yopishqoq menyu (o'z ichida aylanadi), o'ngda topbar va sahifa; lg dan past menyu varaqda */}
      <div className="min-h-dvh lg:grid lg:grid-cols-[auto_minmax(0,1fr)]">
        {/* no-scrollbar: menyu aylanadi, lekin chiziq ko'rinmaydi. Ko'rinadigan chiziq 19 band
            bilan har ekranda turar va menyuni "sinib qolgan" dek ko'rsatardi */}
        <aside className="no-scrollbar hidden border-r border-line/70 lg:sticky lg:top-0 lg:block lg:h-dvh lg:overflow-y-auto">
          <AdminNav mode={navMin ? 'rail' : 'full'} counts={counts} isOwner={isOwner} />
        </aside>
        <div className="min-w-0">
          <AdminTopbar navMin={navMin} onToggleNav={toggleNav} onMenu={() => setMenu(true)} />
          <main id="main" className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
            {/* useSearchParams statik renderda Suspense talab qiladi: o'ram bitta joyda, ekranlar o'zi o'ramaydi */}
            <Suspense fallback={<Skeleton rows={3} />}>{children}</Suspense>
          </main>
        </div>
      </div>
      <Drawer open={menu} title={ts('menu')} onClose={() => setMenu(false)} side="left">
        <div className="-mx-5 -my-4">
          <AdminNav mode="full" counts={counts} isOwner={isOwner} onNavigate={() => setMenu(false)} />
        </div>
      </Drawer>
      <CommandPalette mode={palette} onClose={closePalette} />
    </AdminContext.Provider>
  );
}
