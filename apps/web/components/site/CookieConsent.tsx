'use client';
/**
 * Cookie roziligi chizig'i: ekranning pastida turadigan oddiy chiziq, MODAL EMAS.
 *
 * Sahifani to'smaydi, fokusni qamamaydi va Esc kutmaydi: odam uni e'tiborsiz qoldirib
 * ishlayverishi mumkin. Shuning uchun role="dialog" ham yo'q, nomlangan yonaki bo'lim
 * (aside): ekran o'quvchiga oyna deb va'da bersak, o'zini oyna kabi tutishi kerak bo'lardi.
 *
 * Javob berilgandan keyin chiziq butunlay yo'qoladi: holat lib/consent.ts da, ya'ni
 * boshqa sahifada ham qaytib chiqmaydi.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { PRIVATE_PATH, getConsent, getConsentServer, setConsent, subscribeConsent } from '@/lib/consent';

/*
 * Ikkala tugma AYNAN bir xil ko'rinadi. Biri katta yashil, ikkinchisi kichkina kulrang
 * bo'lsa, bu tanlov emas, itarish bo'lardi: ko'z o'zi kerakli tugmani topib beradi va
 * "kerak emas" degan javob amalda yashirilgan bo'lardi.
 */
const BTN = 'rounded-full border border-navy bg-white px-5 py-2.5 text-sm font-semibold text-navy transition hover:bg-sand active:scale-[0.98]';

export function CookieConsent() {
  const t = useTranslations('consent');
  const consent = useSyncExternalStore(subscribeConsent, getConsent, getConsentServer);
  const path = usePathname();
  const box = useRef<HTMLElement>(null);
  /*
   * Serverda brauzer xotirasi yo'q, ya'ni javob bergan odam ham server HTML ichida
   * chiziqni oladi va u faqat hydration tugagach yo'qoladi: bir yil oldin "kerak emas"
   * degan odam har safar pastda chaqnashni ko'rardi. Shuning uchun birinchi chizishda
   * hech narsa chizilmaydi. Yon ta'siri ham to'g'ri: JS ishlamasa tugmalari bosilmaydigan
   * chiziq ham qolmaydi.
   */
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  /*
   * Balandligini hujjat ildizidagi --ad-bottom ga yozamiz: yordam tugmasi va yordam oynasi
   * shu o'lchamni o'z pastki masofasiga qo'shadi (AdSlot.tsx dagi naqsh), ya'ni ular
   * chiziqning ustiga chiqadi. ResizeObserver kerak: matn telefonda ikki qatorga tushadi.
   *
   * Pastki reklama bilan to'qnashmaydi: u faqat rozilik berilgandan keyin chiziladi,
   * bu chiziq esa javobdan keyin yo'qoladi. Ikkalasi hech qachon bir vaqtda turmaydi.
   */
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const root = document.documentElement.style;
    const set = () => root.setProperty('--ad-bottom', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => { ro.disconnect(); root.removeProperty('--ad-bottom'); };
  }, [consent, ready]);

  if (!ready || consent !== 'ask' || PRIVATE_PATH.test(path)) return null;
  return (
    <aside
      ref={box}
      aria-label={t('title')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white px-4 py-3 shadow-2xl"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        {/* min-w: telefonda matn butun qatorni oladi va tugmalar pastga tushadi,
            aks holda uch element bitta tor qatorga siqilib ketardi */}
        <p className="min-w-[15rem] flex-1 text-sm leading-relaxed text-ink/85">
          {t('text')}{' '}
          <Link href="/privacy" className="font-semibold text-teal-ink hover:underline">{t('more')}</Link>
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setConsent('yes')} className={BTN}>{t('accept')}</button>
          <button type="button" onClick={() => setConsent('no')} className={BTN}>{t('decline')}</button>
        </div>
      </div>
    </aside>
  );
}
