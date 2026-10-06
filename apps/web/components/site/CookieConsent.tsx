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
import { XIcon } from '@phosphor-icons/react';
import { Link, usePathname } from '@/i18n/navigation';
import { PRIVATE_PATH, getConsent, getConsentServer, setConsent, subscribeConsent } from '@/lib/consent';

/*
 * Ikkala tugma AYNAN bir xil ko'rinadi. Biri katta yashil, ikkinchisi kichkina kulrang
 * bo'lsa, bu tanlov emas, itarish bo'lardi: ko'z o'zi kerakli tugmani topib beradi va
 * "kerak emas" degan javob amalda yashirilgan bo'lardi.
 */
const BTN = 'rounded-full border border-navy bg-white px-5 py-2.5 text-sm font-semibold text-navy transition hover:bg-sand active:scale-[0.98]';

/*
 * X javob emas, "hozir emas": hech narsaga ruxsat berilmaydi (javobsiz turgan chiziqning
 * holati aynan shu) va keyingi tashrifda yana so'raymiz. Rad etish deb yozmaymiz: yopgan
 * odam "kerak emas" demagan, shunchaki xalaqit bermasin degan.
 * sessionStorage da, ya'ni yorliq yopilguncha: oddiy holatda sahifa yangilansa yoki til
 * almashsa chiziq qaytib chiqardi.
 */
const LATER = 'ys-consent-later';

export function CookieConsent() {
  const t = useTranslations('consent');
  const a = useTranslations('a11y');
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
  const [later, setLater] = useState(false);
  useEffect(() => {
    try { setLater(sessionStorage.getItem(LATER) === '1'); } catch { /* maxfiy oyna */ }
    setReady(true);
  }, []);
  const close = () => {
    setLater(true);
    try { sessionStorage.setItem(LATER, '1'); } catch { /* maxfiy oyna: shu sahifada yopiq qoladi */ }
  };
  const show = ready && !later && consent === 'ask' && !PRIVATE_PATH.test(path);

  /*
   * Balandligini hujjat ildizidagi --ad-bottom ga yozamiz: yordam tugmasi va yordam oynasi
   * shu o'lchamni o'z pastki masofasiga qo'shadi (AdSlot.tsx dagi naqsh), ya'ni ular
   * chiziqning ustiga chiqadi. ResizeObserver kerak: matn telefonda ikki qatorga tushadi.
   *
   * Pastki reklama bilan to'qnashmaydi: u faqat rozilik berilgandan keyin chiziladi,
   * bu chiziq esa javobdan keyin yo'qoladi. Ikkalasi hech qachon bir vaqtda turmaydi.
   *
   * Kalit show: chiziq har chiqqanda YANGI element bo'ladi (masalan kabinetdan qaytganda)
   * va kuzatuvchi o'shanga qayta ulanishi kerak. Faqat rozilikka bog'lansa eski, uzilgan
   * elementni kuzatib qolardi va yordam tugmasi chiziq ustiga tushardi.
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
  }, [show]);

  if (!show) return null;
  return (
    <aside
      ref={box}
      aria-label={t('title')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white px-4 py-3 shadow-2xl"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
    >
      {/* X o'z ustunida: telefonda matn va tugmalar ikki qatorga tushadi, X esa o'ng
          yuqori burchakda qoladi va hech biriga mingashmaydi */}
      <div className="mx-auto flex max-w-5xl items-start gap-2 sm:items-center">
        <div className="flex flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
          <p className="text-sm leading-relaxed text-ink/85">
            {t('text')}{' '}
            {/* nowrap: telefonda havola ikki qatorga bo'linib qolmasin, butunligicha pastga tushsin */}
            <Link href="/privacy" className="whitespace-nowrap font-semibold text-teal-ink underline underline-offset-2">{t('policy')}</Link>
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConsent('yes')} className={BTN}>{t('accept')}</button>
            <button type="button" onClick={() => setConsent('no')} className={BTN}>{t('decline')}</button>
          </div>
        </div>
        {/* 44x44, pastki reklamaning X i bilan bir xil o'lcham */}
        <button
          type="button" onClick={close} aria-label={a('close')}
          className="-mr-2 -mt-2.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-sand hover:text-navy sm:my-0"
        >
          <XIcon size={18} weight="bold" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
