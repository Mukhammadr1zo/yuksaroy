'use client';
/**
 * Admin panelining chap menyusi. Ilgari butun panel bitta sahifadagi yetti tab edi:
 * har tab har kirishda qayta yuklanardi va tabga havola berib bo'lmasdi.
 * Endi har bo'lim o'z manziliga ega, shu sababli menyu ham haqiqiy menyu.
 *
 * Tartib ish kuniga qarab: avval kutayotgan ish, keyin katalog, oxirida tizim.
 */
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

type Item = { href: string; key: string; exact?: boolean; badge?: string; owner?: true };
const GROUPS: { key: string; items: Item[] }[] = [
  { key: 'work', items: [
    { href: '/admin', key: 'home', exact: true },
    { href: '/admin/moderation', key: 'moderation', badge: 'pending' },
    { href: '/admin/orders', key: 'orders' },
    { href: '/admin/urgent', key: 'urgent' },
  ] },
  { key: 'catalog', items: [
    { href: '/admin/terminals', key: 'terminals' },
    { href: '/admin/stations', key: 'stations' },
    { href: '/admin/listings', key: 'listings' },
    { href: '/admin/reviews', key: 'reviews' },
  ] },
  { key: 'people', items: [
    { href: '/admin/orgs', key: 'orgs' },
    { href: '/admin/users', key: 'users' },
  ] },
  { key: 'system', items: [
    { href: '/admin/audit', key: 'audit' },
    // Komissiya foizi va muddatlar: operatorga ko'rinmaydi, server ham ruxsat bermaydi
    { href: '/admin/settings', key: 'settings', owner: true },
  ] },
];

export function AdminNav({ counts, isOwner = false }: { counts?: Partial<Record<string, number>>; isOwner?: boolean }) {
  const t = useTranslations('admin.nav');
  const path = usePathname();
  return (
    <nav aria-label={t('aria')} className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 lg:mx-0 lg:flex-col lg:gap-4 lg:overflow-visible lg:px-0">
      {GROUPS.map((g) => (
        <div key={g.key} className="flex shrink-0 gap-1 lg:flex-col lg:gap-0.5">
          {/* Guruh sarlavhasi faqat keng ekranda: mobil menyu bitta gorizontal qator */}
          <span className="hidden px-3 pb-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted lg:block">{t(`group.${g.key}`)}</span>
          {g.items.filter((it) => !it.owner || isOwner).map(({ href, key, exact, badge }) => {
            const on = exact ? path === href : path === href || path.startsWith(`${href}/`);
            const n = badge ? counts?.[badge] : undefined;
            return (
              <Link key={href} href={href}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition-colors duration-150 lg:shrink ${on ? 'bg-navy text-white' : 'text-muted hover:bg-white hover:text-navy'}`}>
                {t(key)}
                {n ? <span className={`rounded-full px-1.5 font-mono text-[11px] ${on ? 'bg-white/20 text-white' : 'bg-amber text-white'}`}>{n}</span> : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
