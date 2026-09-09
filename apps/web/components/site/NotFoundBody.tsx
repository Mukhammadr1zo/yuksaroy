'use client';
// 404 sahifasining mazmuni. global-not-found [locale] segmentidan tashqarida bo'lgani uchun next-intl yo'q:
// til URL prefiksidan aniqlanadi (/ru, /en, aks holda uz), matnlar shu yerda.
import { MagnifyingGlassIcon, PathIcon, ShippingContainerIcon, TrainIcon, TruckIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Logo } from './Logo';

type Lang = 'uz' | 'ru' | 'en';

// ponytail: marshrutlar inglizchaga ko'chganda faqat shu jadval yangilanadi
const ROUTES = { home: '/', terminals: '/terminals', sidings: '/sidings', equipment: '/equipment', carriers: '/carriers' } as const;

const T: Record<Lang, { code: string; tabTitle: string; title: string; lead: string; search: string; submit: string; browse: string; home: string; terminals: string; sidings: string; equipment: string; carriers: string }> = {
  uz: {
    code: 'Xato 404',
    tabTitle: 'Sahifa topilmadi · YukSaroy',
    title: "Bu manzilda hech narsa yo'q",
    lead: "Havola eskirgan yoki manzil noto'g'ri yozilgan bo'lishi mumkin. Kerakli narsani qidiruv orqali toping yoki kategoriyadan boshlang.",
    search: "Terminal, shahobcha yo'l yoki texnika",
    submit: 'Qidirish',
    browse: 'Kategoriyalar',
    home: 'Bosh sahifaga',
    terminals: 'Terminallar',
    sidings: "Shahobcha yo'llar",
    equipment: 'Teplovoz va vagon',
    carriers: 'Yuk mashinalari',
  },
  ru: {
    code: 'Ошибка 404',
    tabTitle: 'Страница не найдена · YukSaroy',
    title: 'По этому адресу ничего нет',
    lead: 'Ссылка устарела или адрес написан с ошибкой. Найдите нужное через поиск или начните с категории.',
    search: 'Терминал, подъездной путь или техника',
    submit: 'Найти',
    browse: 'Категории',
    home: 'На главную',
    terminals: 'Терминалы',
    sidings: 'Подъездные пути',
    equipment: 'Тепловозы и вагоны',
    carriers: 'Грузовики',
  },
  en: {
    code: 'Error 404',
    tabTitle: 'Page not found · YukSaroy',
    title: 'There is nothing at this address',
    lead: 'The link may be outdated or the address mistyped. Search for what you need or start from a category.',
    search: 'Terminal, siding or equipment',
    submit: 'Search',
    browse: 'Categories',
    home: 'Back to home',
    terminals: 'Terminals',
    sidings: 'Private sidings',
    equipment: 'Locomotives and wagons',
    carriers: 'Trucks',
  },
};

const CATS = [
  { key: 'terminals', route: ROUTES.terminals, Icon: ShippingContainerIcon },
  { key: 'sidings', route: ROUTES.sidings, Icon: PathIcon },
  { key: 'equipment', route: ROUTES.equipment, Icon: TrainIcon },
  { key: 'carriers', route: ROUTES.carriers, Icon: TruckIcon },
] as const;

export function NotFoundBody() {
  const [lang, setLang] = useState<Lang>('uz');
  useEffect(() => {
    const seg = window.location.pathname.split('/')[1];
    const l: Lang = seg === 'ru' || seg === 'en' ? seg : 'uz';
    setLang(l);
    // server <html lang="uz"> beradi va sarlavhasiz keladi: til va tab sarlavhasi shu yerda qo'yiladi
    document.documentElement.lang = l;
    document.title = T[l].tabTitle;
  }, []);
  const t = T[lang];
  const prefix = lang === 'uz' ? '' : `/${lang}`;
  const href = (p: string) => `${prefix}${p === '/' ? '' : p}` || '/';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <a href={href('/')} aria-label="YukSaroy"><Logo /></a>
        <a href={href('/')} className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-navy transition duration-200 hover:border-teal hover:text-teal-ink">
          {t.home}
        </a>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-12">
        <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-teal-ink">{t.code}</p>
        <h1 className="font-display mt-3 text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.05] tracking-tight text-navy">{t.title}</h1>
        <p className="mt-4 max-w-[56ch] text-[17px] leading-relaxed text-muted">{t.lead}</p>

        <form action={href(ROUTES.terminals)} className="mt-8 flex max-w-xl items-center gap-2 rounded-full border border-line bg-white p-1.5">
          <MagnifyingGlassIcon size={20} weight="regular" className="ml-3 shrink-0 text-muted" aria-hidden="true" />
          <input name="q" type="search" placeholder={t.search} aria-label={t.search} className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] outline-none placeholder:text-muted/70" />
          <button className="shrink-0 rounded-full bg-teal px-5 py-2.5 text-[15px] font-semibold text-white transition duration-200 hover:bg-teal-ink active:scale-[0.98]">{t.submit}</button>
        </form>

        <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">{t.browse}</p>
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CATS.map(({ key, route, Icon }) => (
            <li key={key}>
              <a href={href(route)} className="group flex h-full flex-col gap-3 rounded-card border border-line bg-white p-4 transition duration-200 hover:border-teal">
                <Icon size={26} weight="duotone" className="text-navy transition-colors duration-200 group-hover:text-teal-ink" aria-hidden="true" />
                <span className="text-sm font-semibold text-ink">{t[key]}</span>
              </a>
            </li>
          ))}
        </ul>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 py-6 font-mono text-xs text-muted">© {new Date().getFullYear()} YukSaroy</footer>
    </div>
  );
}
