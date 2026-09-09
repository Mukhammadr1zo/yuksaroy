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
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" aria-label={t('aria.home')}><Logo /></Link>
        <nav aria-label={t('aria.main')} className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-full px-4 py-2 text-sm font-semibold text-ink/80 hover:bg-white hover:text-navy">
              {label(n)}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <AuthButton />
        </div>
      </div>
      <nav aria-label={t('aria.mainMobile')} className="no-scrollbar flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink/80">
            {label(n)}
          </Link>
        ))}
      </nav>
    </header>
  );
}
