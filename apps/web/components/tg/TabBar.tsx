'use client';
// Pastki tab paneli: suzuvchi kapsula, besh ildiz. Ko'rinish/yashirinishni TgProvider boshqaradi (MainButton, klaviatura, kirish holati).
import type { MouseEvent } from 'react';
import { useTranslations } from 'next-intl';
import { ClipboardTextIcon, HouseIcon, MagnifyingGlassIcon, MapTrifoldIcon, UserIcon } from '@phosphor-icons/react';
import { Link, usePathname } from '@/i18n/navigation';
import { haptic } from './TgProvider';
import { TAB_ROOT, hasRealQuery, tabOf, type TabKey } from './nav';

const TABS: { key: TabKey; Icon: typeof HouseIcon }[] = [
  { key: 'home', Icon: HouseIcon },
  { key: 'search', Icon: MagnifyingGlassIcon },
  { key: 'map', Icon: MapTrifoldIcon },
  { key: 'my', Icon: ClipboardTextIcon },
  { key: 'profile', Icon: UserIcon },
];

export function TabBar({ hidden }: { hidden: boolean }) {
  const t = useTranslations('tg.tabs');
  const pathname = usePathname();
  const active = tabOf(pathname);

  // Faol tabni qayta bosish: ildizning o'zida (querysiz) tepaga suriladi, ichki sahifada esa ildizga qaytiladi (Link o'zi o'tadi)
  const onTap = (key: TabKey) => (e: MouseEvent<HTMLAnchorElement>) => {
    haptic();
    if (key !== active || pathname !== TAB_ROOT[key] || hasRealQuery(pathname, window.location.search)) return;
    e.preventDefault();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    // inert: yashirin panel klaviatura va ekran o'quvchi uchun ham yo'q bo'ladi, lekin DOM da qoladi (qayta chiqishi silliq)
    <nav data-tg-tabbar aria-label={t('aria')} aria-hidden={hidden || undefined} inert={hidden} className="tg-tabbar">
      {TABS.map(({ key, Icon }) => {
        const on = key === active;
        return (
          <Link key={key} href={TAB_ROOT[key]} data-tab={key} aria-current={on ? 'page' : undefined} onClick={onTap(key)} className="tg-tab">
            <span className="tg-tab-icon"><Icon size={22} weight={on ? 'bold' : 'regular'} aria-hidden="true" /></span>
            <span className="tg-tab-label">{t(key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
