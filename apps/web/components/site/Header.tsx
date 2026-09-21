import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Logo } from './Logo';
import { LocaleSwitcher } from './LocaleSwitcher';
import { AuthArea } from './AuthArea';

// nav: asosiy JSON'dagi kalitlar; nav2: katalog qo'shimchalari (messages/<locale>/nav2.json); map: xarita nomfazosi (map.json)
const NAV = [
  { href: '/terminals', ns: 'nav', key: 'terminals' },
  { href: '/equipment', ns: 'nav2', key: 'equipment' },
  { href: '/carriers', ns: 'nav2', key: 'carriers' },
  { href: '/cargo', ns: 'nav2', key: 'cargo' },
  { href: '/services', ns: 'nav2', key: 'services' },
  { href: '/wagon', ns: 'nav2', key: 'wagon' },
  { href: '/map', ns: 'map', key: 'nav' },
] as const;

export async function Header() {
  const [t, t2, t3] = await Promise.all([getTranslations('nav'), getTranslations('nav2'), getTranslations('map')]);
  const label = (n: (typeof NAV)[number]) => (n.ns === 'nav' ? t(n.key) : n.ns === 'nav2' ? t2(n.key) : t3(n.key));
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-sand/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-6">
        {/* Belgi siqilmaydi. Yetti havola + kirgan foydalanuvchining tugmalari 1152 px ga sig'magani
            uchun ustun 1280 px ga kengaydi va gorizontal menyu xl dan boshlanadi; undan pastda chip qatori. */}
        <Link href="/" aria-label={t('aria.home')} className="shrink-0"><Logo compact /></Link>
        <nav aria-label={t('aria.main')} className="hidden min-w-0 items-center gap-0.5 xl:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-full px-2.5 py-2 text-sm font-semibold text-ink/80 hover:bg-white hover:text-navy">
              {label(n)}
            </Link>
          ))}
        </nav>
        <div className="relative flex shrink-0 items-center gap-1.5 sm:gap-2">
          <LocaleSwitcher />
          <AuthArea />
        </div>
      </div>
      <nav aria-label={t('aria.mainMobile')} className="no-scrollbar mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 pb-2 sm:px-6 xl:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink/80">
            {label(n)}
          </Link>
        ))}
      </nav>
    </header>
  );
}
