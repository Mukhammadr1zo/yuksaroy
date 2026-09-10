'use client';
// Platforma egasi uchun foydalanuvchilar bo'limi: qidiruv, bloklash va o'chirish.
// Firibgar hisob topilganda uni to'xtatish yo'li shu yerda; har harakat auditga yoziladi.
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api, post } from '@/lib/api';
import { uzDate } from '@/lib/format';
import { phoneDisplay } from '@/components/ui/fields';
import { BTN_GHOST, BTN_NAVY, CHIP, INPUT, Notice } from './bits';

type AdminUser = {
  id: string; phone: string | null; email: string | null; fullName: string | null; isActive: boolean;
  createdAt: string; personalRoles: string[]; listings: number;
  orgs: { id: string; name: string; kyc: string; isOwner: boolean }[];
};
type Page = { items: AdminUser[]; total: number; page: number; limit: number };

export function AdminUsers() {
  const t = useTranslations('admin.users');
  const tc = useTranslations('kabinet.common');
  const locale = useLocale();
  const [q, setQ] = useState('');
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [page, setPage] = useState<Page | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const load = (p = 1) => api<Page>(`/admin/users?page=${p}&q=${encodeURIComponent(q.trim())}${onlyBlocked ? '&blocked=1' : ''}`)
    .then(setPage).catch(() => setNote({ tone: 'err', text: tc('loadFailed') }));

  useEffect(() => { void load(1); }, [onlyBlocked]); // eslint-disable-line react-hooks/exhaustive-deps

  async function block(u: AdminUser, next: boolean) {
    const reason = next ? window.prompt(t('blockReason')) : null;
    if (next && reason === null) return;
    setBusy(u.id); setNote(null);
    try {
      await post(`/admin/users/${u.id}/block`, { block: next, reason: reason || undefined });
      setPage((x) => (x ? { ...x, items: x.items.map((i) => (i.id === u.id ? { ...i, isActive: !next } : i)) } : x));
      setNote({ tone: 'ok', text: next ? t('blocked') : t('unblocked') });
    } catch { setNote({ tone: 'err', text: tc('failed') }); } finally { setBusy(null); }
  }

  async function remove(u: AdminUser) {
    if (!window.confirm(t('confirmDelete', { name: u.fullName || phoneDisplay(u.phone ?? '') || u.id }))) return;
    setBusy(u.id); setNote(null);
    try {
      await post(`/admin/users/${u.id}/delete`, { reason: 'admin' });
      setNote({ tone: 'ok', text: t('deleted') });
      await load(page?.page ?? 1);
    } catch { setNote({ tone: 'err', text: tc('failed') }); } finally { setBusy(null); }
  }

  const pages = page ? Math.max(1, Math.ceil(page.total / page.limit)) : 1;
  return (
    <section>
      <form onSubmit={(e) => { e.preventDefault(); void load(1); }} className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} maxLength={80} className={`${INPUT} max-w-xs`} />
        <button className={BTN_NAVY}>{t('find')}</button>
        <button type="button" aria-pressed={onlyBlocked} onClick={() => setOnlyBlocked(!onlyBlocked)} className={CHIP(onlyBlocked)}>{t('onlyBlocked')}</button>
        {page ? <span className="ml-auto font-mono text-xs text-muted">{t('total', { count: page.total })}</span> : null}
      </form>

      {note ? <div className="mt-3"><Notice tone={note.tone}>{note.text}</Notice></div> : null}
      {!page ? <p className="mt-4 text-sm text-muted">{tc('loading')}</p> : null}

      {page ? (
        <ul className="mt-4 space-y-2">
          {page.items.map((u) => (
            <li key={u.id} className={`rounded-card border bg-white p-4 ${u.isActive ? 'border-line' : 'border-red-200 bg-red-50/40'}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold">{u.fullName || t('noName')}</span>
                <span className="font-mono text-sm text-muted">{u.phone ? phoneDisplay(u.phone) : (u.email ?? '·')}</span>
                {!u.isActive ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">{t('blockedTag')}</span> : null}
                <span className="ml-auto font-mono text-xs text-muted">{uzDate(u.createdAt, locale)}</span>
              </div>
              <p className="mt-1 text-sm text-muted">
                {u.orgs.length ? u.orgs.map((o) => `${o.name}${o.isOwner ? ` (${t('owner')})` : ''}`).join(' · ') : t('noOrg')}
                {u.listings ? ` · ${t('listings', { count: u.listings })}` : ''}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={busy === u.id} onClick={() => void block(u, u.isActive)} className={BTN_GHOST}>
                  {u.isActive ? t('block') : t('unblock')}
                </button>
                <button type="button" disabled={busy === u.id} onClick={() => void remove(u)} className="rounded-full border border-red-200 px-5 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60">
                  {t('delete')}
                </button>
              </div>
            </li>
          ))}
          {page.items.length === 0 ? <li className="rounded-card border border-dashed border-line p-8 text-center text-sm text-muted">{t('empty')}</li> : null}
        </ul>
      ) : null}

      {page && pages > 1 ? (
        <nav className="mt-4 flex items-center justify-center gap-2 font-mono text-sm">
          <button type="button" disabled={page.page <= 1} onClick={() => void load(page.page - 1)} className={BTN_GHOST}>{'<'}</button>
          <span className="text-muted">{page.page} / {pages}</span>
          <button type="button" disabled={page.page >= pages} onClick={() => void load(page.page + 1)} className={BTN_GHOST}>{'>'}</button>
        </nav>
      ) : null}
    </section>
  );
}
