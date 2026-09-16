'use client';
// Saytdagi bildirishnomalar: ilgari hamma xabar faqat Telegramga ketardi va Telegramni
// bog'lamagan odam hech narsani bilmasdi. Qo'ng'iroq ochilganda hammasi o'qilgan bo'ladi.
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { BellIcon } from '@phosphor-icons/react';
import { Link } from '@/i18n/navigation';
import { api, post } from '@/lib/api';
import { uzDateTime } from '@/lib/format';

type Item = { id: string; kind: string; title: string; body: string | null; href: string | null; readAt: string | null; createdAt: string };

export function NotificationBell() {
  const t = useTranslations('nav.notifications');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [unread, setUnread] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const load = () => api<{ items: Item[]; unread: number }>('/notifications?limit=20')
    .then((r) => { setItems(r.items); setUnread(r.unread); })
    .catch(() => { setItems([]); });

  useEffect(() => {
    void load();
    // Sanoq eskirmasin: fokus qaytganda va har ikki daqiqada
    const timer = setInterval(load, 120_000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread) {
      setUnread(0);
      void post('/notifications/read', {}).catch(() => {});
    }
  };

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={toggle} aria-expanded={open} aria-label={t('aria', { count: unread })}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white transition-colors duration-150 hover:border-teal">
        <BellIcon size={17} weight={unread ? 'fill' : 'regular'} className={unread ? 'text-navy' : 'text-muted'} aria-hidden="true" />
        {unread ? <span className="absolute -right-1 -top-1 rounded-full bg-orange px-1.5 font-mono text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span> : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-5rem)] overflow-hidden rounded-2xl border border-line bg-white shadow-lg">
          <p className="border-b border-line px-4 py-2.5 text-sm font-bold">{t('title')}</p>
          {items === null ? <p className="px-4 py-6 text-center text-sm text-muted">{t('loading')}</p> : null}
          {items && items.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted">{t('empty')}</p> : null}
          {items && items.length ? (
            <ul className="max-h-[60vh] overflow-y-auto divide-y divide-line">
              {items.map((n) => {
                const body = (
                  <>
                    <span className="block truncate text-sm font-semibold">{n.title}</span>
                    {n.body ? <span className="mt-0.5 block line-clamp-2 text-xs text-muted">{n.body}</span> : null}
                    <span className="mt-1 block font-mono text-[11px] text-muted">{uzDateTime(n.createdAt, locale)}</span>
                  </>
                );
                return (
                  <li key={n.id} className={n.readAt ? '' : 'bg-teal-soft/40'}>
                    {n.href
                      ? <Link href={n.href} onClick={() => setOpen(false)} className="block px-4 py-3 hover:bg-sand">{body}</Link>
                      : <span className="block px-4 py-3">{body}</span>}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
