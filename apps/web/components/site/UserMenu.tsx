'use client';
// Sarlavhadagi foydalanuvchi menyusi: kabinet alohida "dunyo" bo'lmasligi uchun profil, tashkilot va
// chiqish shu yerda turadi (menyuda alohida band emas).
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CaretDownIcon } from '@phosphor-icons/react';
import { Link, useRouter } from '@/i18n/navigation';
import { clearAuthedCache, post } from '@/lib/api';
import { useMe } from './useMe';

export function UserMenu() {
  const t = useTranslations('nav.user');
  const router = useRouter();
  const me = useMe();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (!me) return null;
  const initials = (me.fullName ?? '').split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  const item = 'block rounded-xl px-3 py-2 text-sm font-semibold text-ink hover:bg-sand';
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" aria-label={t('menu')}
        className="flex items-center gap-1.5 rounded-full border border-line bg-white py-1 pl-1 pr-2 transition-colors duration-150 hover:border-teal">
        <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-teal-soft font-mono text-[11px] font-bold text-teal-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {me.avatarUrl ? <img src={me.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials || '?'}
        </span>
        <CaretDownIcon size={12} weight="bold" className="text-muted" aria-hidden="true" />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-56 rounded-2xl border border-line bg-white p-1.5 shadow-lg">
          <p className="truncate px-3 pb-1.5 pt-1 text-xs text-muted">{me.fullName || me.phone || me.email}</p>
          <Link role="menuitem" href="/dashboard" className={item} onClick={() => setOpen(false)}>{t('workspace')}</Link>
          <Link role="menuitem" href="/dashboard/profile" className={item} onClick={() => setOpen(false)}>{t('profile')}</Link>
          <Link role="menuitem" href="/dashboard/organization" className={item} onClick={() => setOpen(false)}>{t('org')}</Link>
          {/* Obuna shu yerda: u hisobga tegishli, sarlavhadagi bo'limlar esa katalog va bozor */}
          <Link role="menuitem" href="/dashboard/subscription" className={item} onClick={() => setOpen(false)}>{t('subscription')}</Link>
          {me.isPlatformAdmin ? <Link role="menuitem" href="/admin" className={item} onClick={() => setOpen(false)}>{t('admin')}</Link> : null}
          <button role="menuitem" type="button" className={`${item} w-full text-left text-red-700`}
            onClick={async () => { await post('/auth/logout', {}).catch(() => {}); clearAuthedCache(); setOpen(false); router.replace('/'); }}>
            {t('logout')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
