'use client';
// Ish maydonining chap menyusi: o'n ikkita yassi banddan besh bandga tushdi.
// Har band bitta savolga javob beradi (nima kutilyapti, nimam bor, ish qaysi bosqichda, hujjat, tashkilot).
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

const LINKS: { href: string; key: string; exact?: boolean }[] = [
  { href: '/dashboard', key: 'now', exact: true },
  { href: '/dashboard/objects', key: 'objects' },
  { href: '/dashboard/orders', key: 'orders' },
  { href: '/dashboard/documents', key: 'documents' },
  { href: '/dashboard/organization', key: 'org' },
];

export function SideNav({ counts }: { counts?: Partial<Record<string, number>> }) {
  const t = useTranslations('kabinet.side');
  const path = usePathname();
  return (
    <nav aria-label={t('aria')} className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
      {LINKS.map(({ href, key, exact }) => {
        const on = exact ? path === href : path === href || path.startsWith(`${href}/`);
        const n = counts?.[key];
        return (
          <Link key={href} href={href}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition-colors duration-150 lg:shrink ${on ? 'bg-navy text-white' : 'text-muted hover:bg-white hover:text-navy'}`}>
            {t(key)}
            {n ? <span className={`rounded-full px-1.5 font-mono text-[11px] ${on ? 'bg-white/20 text-white' : 'bg-orange text-white'}`}>{n}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
