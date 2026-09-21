'use client';
// Ish maydonining chap menyusi: o'n ikkita yassi banddan olti bandga tushdi.
// Har band bitta savolga javob beradi (nima kutilyapti, nimam bor, ish qaysi bosqichda, hujjat, tashkilot).
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { api, hasSession } from '@/lib/api';

const LINKS: { href: string; key: string; exact?: boolean }[] = [
  { href: '/dashboard', key: 'now', exact: true },
  { href: '/dashboard/objects', key: 'objects' },
  { href: '/dashboard/orders', key: 'orders' },
  { href: '/dashboard/inquiries', key: 'chats' },
  { href: '/dashboard/market', key: 'market' },
  { href: '/dashboard/subscription', key: 'subscription' },
  { href: '/dashboard/documents', key: 'documents' },
  { href: '/dashboard/organization', key: 'org' },
];

export function SideNav({ counts }: { counts?: Partial<Record<string, number>> }) {
  const t = useTranslations('kabinet.side');
  const path = usePathname();
  // O'qilmagan xabar menyuda ko'rinadi: aks holda javob kelgani faqat yozishmani
  // ochgandan keyin bilinardi. Sahifa almashganda qayta so'raladi, shu bilan yangilanadi.
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!hasSession()) return;
    api<{ count: number }>('/inquiries/unread').then((r) => setUnread(r.count)).catch(() => {});
  }, [path]);
  return (
    <nav aria-label={t('aria')} className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
      {LINKS.map(({ href, key, exact }) => {
        const on = exact ? path === href : path === href || path.startsWith(`${href}/`);
        const n = key === 'chats' ? (counts?.[key] ?? unread) : counts?.[key];
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
