'use client';
/**
 * Admin qobig'ining yuqori paneli: sayt sarlavhasi o'rniga. Chapda menyu tugmasi (mobil) yoki
 * yig'ish tugmasi (desktop), belgi va nonushta yo'li; o'ngda qidiruv (Ctrl K), tez amallar,
 * til, rol va foydalanuvchi menyusi.
 *
 * Rol nishoni bezak emas: operator "Yangi reklama" tugmasini ko'rmaganida nega ekanini
 * shu yerdan tushunadi (reklamani faqat ega sotadi).
 */
import { useTranslations } from 'next-intl';
import { ListIcon, MagnifyingGlassIcon, PlusIcon, SidebarSimpleIcon } from '@phosphor-icons/react';
import { Link, usePathname } from '@/i18n/navigation';
import { Logo } from '@/components/site/Logo';
import { LocaleSwitcher } from '@/components/site/LocaleSwitcher';
import { UserMenu } from '@/components/site/UserMenu';
import { BTN_GHOST, type MenuItem, Pill, Popover } from './kit';
import { GROUPS } from './AdminNav';
import { useAdminShell } from './context';

const ICON_BTN = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-white hover:text-navy';

export function AdminTopbar({ navMin, onToggleNav, onMenu }: { navMin: boolean; onToggleNav: () => void; onMenu: () => void }) {
  const ts = useTranslations('admin.shell');
  const tn = useTranslations('admin.nav');
  const { crumb, isOwner, openPalette } = useAdminShell();
  const path = usePathname();

  // Yo'lning ikkinchi bo'g'ini (/admin/orgs/123 -> orgs) menyu bandi nomiga aylanadi;
  // ?tab= va filtrlar yo'lga chiqmaydi (usePathname ularni bermaydi)
  const seg = path.split('/')[2];
  const section = seg ? GROUPS.flatMap((g) => g.items).find((it) => it.href === `/admin/${seg}`) : undefined;
  const crumbs: { href?: string; label: string }[] = [{ href: '/admin', label: ts('crumbs.home') }];
  if (section) crumbs.push({ href: section.href, label: tn(section.key) });
  if (crumb) crumbs.push({ label: crumb });

  const quick: MenuItem[] = [
    { label: ts('quick.newTerminal'), href: '/admin/terminals?new=1' },
    { label: ts('quick.newPlan'), href: '/admin/plans?new=1' },
    // Reklamani ega sotadi: operatorga band umuman chiqmaydi, server ham rad etadi
    ...(isOwner ? [{ label: ts('quick.newAd'), href: '/admin/ads?new=1' }] : []),
  ];

  return (
    <header className="sticky z-30 flex h-[52px] items-center gap-1.5 border-b border-line/70 bg-sand/85 px-3 backdrop-blur sm:gap-2 sm:px-4"
      style={{ top: 'env(safe-area-inset-top, 0px)' }}>
      <button type="button" onClick={onMenu} aria-label={ts('menu')} className={`${ICON_BTN} lg:hidden`}>
        <ListIcon size={20} aria-hidden="true" />
      </button>
      <button type="button" onClick={onToggleNav} aria-pressed={navMin} aria-label={ts(navMin ? 'expand' : 'collapse')} title={`${ts(navMin ? 'expand' : 'collapse')} ([)`}
        className={`${ICON_BTN} hidden lg:inline-flex`}>
        <SidebarSimpleIcon size={20} aria-hidden="true" />
      </button>
      <Link href="/" title={ts('site')} className="shrink-0"><Logo compact /></Link>

      <nav aria-label={ts('crumbs.aria')} className="hidden min-w-0 flex-1 items-center gap-1 text-sm md:flex">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <span key={i} className="flex min-w-0 items-center gap-1">
              {i > 0 ? <span aria-hidden="true" className="text-line">/</span> : null}
              {last || !c.href
                ? <span aria-current={last ? 'page' : undefined} className={`truncate ${last ? 'font-semibold text-navy' : 'text-muted'}`}>{c.label}</span>
                : <Link href={c.href} className="truncate text-muted hover:text-navy">{c.label}</Link>}
            </span>
          );
        })}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        {/* Keng ekranda matn va tugma nomi, telefonda faqat lupa: qatorga sig'masdi */}
        <button type="button" onClick={() => openPalette('search')} aria-label={ts('search')} title={`${ts('search')} (${ts('searchKbd')})`}
          className={`${BTN_GHOST} h-9 px-2.5 py-0 sm:px-3`}>
          <MagnifyingGlassIcon size={16} aria-hidden="true" />
          <span className="hidden sm:inline">{ts('search')}</span>
          <kbd className="hidden rounded border border-line bg-sand px-1 font-mono text-[10px] text-muted sm:inline">{ts('searchKbd')}</kbd>
        </button>
        <Popover label={ts('quick.title')} icon={<PlusIcon size={16} weight="bold" aria-hidden="true" />} items={quick} className={`${BTN_GHOST} h-9 px-2.5 py-0 sm:px-3`} />
        <LocaleSwitcher />
        <span className="hidden sm:inline-block"><Pill tone={isOwner ? 'ok' : 'neutral'}>{ts(isOwner ? 'role.owner' : 'role.operator')}</Pill></span>
        <UserMenu />
      </div>
    </header>
  );
}
