import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Logo } from './Logo';
import { LocaleSwitcher } from './LocaleSwitcher';
import { AuthButton } from './AuthButton';

// nav: asosiy JSON'dagi kalitlar; nav2: katalog qo'shimchalari (messages/<locale>/nav2.json); map: xarita nomfazosi (map.json)
const NAV = [
  { href: '/terminals', ns: 'nav', key: 'terminals' },
  { href: '/sidings', ns: 'nav', key: 'sidings' },
  { href: '/equipment', ns: 'nav2', key: 'equipment' },
  { href: '/carriers', ns: 'nav2', key: 'carriers' },
  { href: '/companies', ns: 'nav2', key: 'companies' },
  { href: '/map', ns: 'map', key: 'nav' },
] as const;

export async function Header() {
  const [t, t2, t3] = await Promise.all([getTranslations('nav'), getTranslations('nav2'), getTranslations('map')]);
  const label = (n: (typeof NAV)[number]) => (n.ns === 'nav' ? t(n.key) : n.ns === 'nav2' ? t2(n.key) : t3(n.key));
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-sand/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Belgi siqilmaydi: 768 da olti havola sig'magani uchun ular chip qatoriga tushadi (lg dan yuqori gorizontal menyu) */}
        <Link href="/" aria-label={t('aria.home')} className="shrink-0"><Logo compact /></Link>
        <nav aria-label={t('aria.main')} className="hidden min-w-0 items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold text-ink/80 hover:bg-white hover:text-navy">
              {label(n)}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <LocaleSwitcher />
          <AuthButton />
        </div>
      </div>
      <nav aria-label={t('aria.mainMobile')} className="no-scrollbar flex gap-1 overflow-x-auto px-4 pb-2 sm:px-6 lg:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink/80">
            {label(n)}
          </Link>
        ))}
      </nav>
    </header>
  );
}
