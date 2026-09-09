'use client';
// Kabinet navigatsiyasi. Terminal havolasi faqat terminal tashkiloti bo'lganda, Moderatsiya faqat platforma admini uchun.
import { Link, usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Me, Membership } from '@/lib/types-kabinet';

type Summary = { terminals: number; byStatus: Record<string, number> };

export function KabinetNav() {
  const path = usePathname();
  const t = useTranslations('kabinet.nav');
  const ta = useTranslations('terminalsAdmin');
  const t2 = useTranslations('dashboard2.nav');
  const tu = useTranslations('urgent');
  const t9 = useTranslations('a11y');
  const [isTerminal, setIsTerminal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const refresh = () => {
      api<Membership[]>('/orgs/mine')
        .then((ms) => {
          const has = ms.some((m) => (m.org.kinds?.length ? m.org.kinds : [m.org.kind]).includes('TERMINAL'));
          setIsTerminal(has);
          if (has) api<Summary>('/orders/summary').then((s) => setPending(s.byStatus?.PENDING ?? 0)).catch(() => {});
        })
        .catch(() => {});
      api<Me>('/auth/me').then((me) => setIsAdmin(me.isPlatformAdmin)).catch(() => {});
    };
    void refresh();
    // Sanoq eskirmasin: fokus qaytganda va har daqiqada yangilanadi
    const timer = setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [path]);

  const links = [
    { href: '/dashboard', label: t('home') },
    { href: '/dashboard/listings', label: t('listings') },
    { href: '/dashboard/inquiries', label: t('inquiries') },
    { href: '/dashboard/orders', label: t('orders') },
    { href: '/dashboard/documents', label: t2('documents') },
    { href: '/dashboard/organization', label: t('org') },
    { href: '/dashboard/sidings', label: t('sidings') },
    { href: '/dashboard/profile', label: t('profile') },
    { href: '/dashboard/urgent', label: tu('nav') },
    ...(isTerminal ? [{ href: '/dashboard/terminal', label: t('terminal'), badge: pending }] : []),
    ...(isTerminal ? [{ href: '/dashboard/terminals', label: ta('nav') }] : []),
    ...(isAdmin ? [{ href: '/dashboard/admin', label: t('admin') }] : []),
  ];

  return (
    // Tasma emas, o'ralgan qatorlar: telefon ekranida ham hamma havola ko'rinadi, CTA doim o'ngda
    <div className="flex min-w-0 flex-1 items-start gap-2">
    <nav aria-label={t9('menu')} className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-sm">
      {links.map((l) => {
        const active = l.href === '/dashboard' ? path === '/dashboard' : path === l.href || path.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href} href={l.href} aria-current={active ? 'page' : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 font-semibold transition ${active ? 'bg-navy text-white' : 'text-muted hover:bg-sand hover:text-ink'}`}
          >
            {l.label}
            {'badge' in l && l.badge ? <span className={`ml-1.5 rounded-full px-1.5 py-0.5 font-mono text-[11px] font-semibold ${active ? 'bg-white text-navy' : 'bg-navy text-white'}`}>{l.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
      <Link href="/dashboard/orders/new" className="shrink-0 rounded-full bg-teal px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-teal-ink active:scale-[0.98]">
        <span className="sm:hidden">{t('new')}</span><span className="hidden sm:inline">{t('newOrder')}</span>
      </Link>
    </div>
  );
}
