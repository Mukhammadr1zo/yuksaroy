'use client';
// Kutilmagan xato ekrani. Ilgari bunday paytda Next ning inglizcha standart sahifasi chiqardi,
// deploy paytidagi bir necha soniyalik oynada esa tashrif buyuruvchi o'sha sahifani ko'rardi.
//
// Matn shu yerda jadvalda, next-intl emas: xato chegarasining o'zi xato tashlay olmasligi kerak.
// Tarjima kaliti topilmasa next-intl chizishda yiqiladi va odam butunlay oq ekran ko'rardi.
import { ArrowClockwiseIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Logo } from './Logo';

type Lang = 'uz' | 'ru' | 'en';

const T: Record<Lang, { code: string; tabTitle: string; title: string; lead: string; retry: string; home: string }> = {
  uz: {
    code: 'Xato',
    tabTitle: "Sahifa ochilmadi · YukSaroy",
    title: 'Sahifa ochilmadi',
    lead: "Ma'lumot yuklanayotganda nimadir ishlamadi. Qayta urinib ko'ring; takrorlansa bir necha daqiqadan keyin qayting.",
    retry: "Qayta urinish",
    home: 'Bosh sahifaga',
  },
  ru: {
    code: 'Ошибка',
    tabTitle: 'Страница не открылась · YukSaroy',
    title: 'Страница не открылась',
    lead: 'При загрузке данных что-то пошло не так. Попробуйте ещё раз; если повторится, вернитесь через несколько минут.',
    retry: 'Попробовать снова',
    home: 'На главную',
  },
  en: {
    code: 'Error',
    tabTitle: 'Page did not load · YukSaroy',
    title: 'The page did not load',
    lead: 'Something went wrong while loading the data. Try again; if it keeps happening, come back in a few minutes.',
    retry: 'Try again',
    home: 'Back to home',
  },
};

export function ErrorBody({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [lang, setLang] = useState<Lang>('uz');
  useEffect(() => {
    const seg = window.location.pathname.split('/')[1];
    const l: Lang = seg === 'ru' || seg === 'en' ? seg : 'uz';
    setLang(l);
    document.documentElement.lang = l;
    document.title = T[l].tabTitle;
  }, []);
  const t = T[lang];
  const prefix = lang === 'uz' ? '' : `/${lang}`;
  const home = prefix || '/';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <a href={home} aria-label="YukSaroy"><Logo /></a>
        <a href={home} className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-navy transition duration-200 hover:border-teal hover:text-teal-ink">
          {t.home}
        </a>
      </header>

      {/* div, main emas: bu bo'lak (public) va (dashboard) qobiqlari ichida chiziladi va
          u yerda allaqachon <main id="main"> bor. Ikkita main bir-birining ichida bo'lsa
          sakrash havolasi qaysi biriga tushishini brauzer o'zi hal qilardi. */}
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-12">
        <p className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.16em] text-amber-ink">
          <WarningCircleIcon size={16} weight="duotone" aria-hidden="true" />
          {t.code}
        </p>
        <h1 className="font-display mt-3 text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.05] tracking-tight text-navy">{t.title}</h1>
        <p className="mt-4 max-w-[56ch] text-[17px] leading-relaxed text-muted">{t.lead}</p>

        <div className="mt-8">
          <button type="button" onClick={reset}
            className="inline-flex items-center gap-2 rounded-full bg-teal px-5 py-2.5 text-[15px] font-semibold text-white transition duration-200 hover:bg-teal-ink active:scale-[0.98]">
            <ArrowClockwiseIcon size={18} weight="bold" aria-hidden="true" />
            {t.retry}
          </button>
        </div>

        {/* Xato belgisi: odam uni murojaatda aytsa, jurnaldan aynan shu hodisa topiladi */}
        {error.digest ? <p className="mt-6 font-mono text-[11px] text-muted">{error.digest}</p> : null}
      </div>

      <footer className="mx-auto w-full max-w-6xl px-6 py-6 font-mono text-xs text-muted">© {new Date().getFullYear()} YukSaroy</footer>
    </div>
  );
}
