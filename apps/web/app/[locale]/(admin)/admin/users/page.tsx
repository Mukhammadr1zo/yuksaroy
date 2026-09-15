'use client';
// Foydalanuvchilar: qidiruv, bloklash, o'chirish. Firibgar hisob topilganda uni to'xtatish yo'li shu yerda,
// shuning uchun blok tugmasi qatorning o'zida, alohida sahifaga o'tmasdan.
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { post } from '@/lib/api';
import { num, uzDate } from '@/lib/format';
import { phoneDisplay } from '@/components/ui/fields';
import { BTN, BTN_GHOST, type Col, ConfirmButton, DataTable, INPUT, Labeled, Notice, PageHead, Pager, Pill, Toolbar, errText, useAdminList } from '@/components/admin/kit';

type Row = {
  id: string; phone: string | null; email: string | null; fullName: string | null; isActive: boolean;
  createdAt: string; personalRoles: string[]; listings: number;
  orgs: { id: string; name: string; kyc: string; isOwner: boolean }[];
};

export default function AdminUsersPage() {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const [f, setF] = useState({ q: '', blocked: false, page: 1 });
  const [q, setQ] = useState('');
  const { data, pages, loading, err } = useAdminList<Row>('/admin/users', { q: f.q, blocked: f.blocked ? 1 : undefined, page: f.page });
  // Jadvalning mahalliy nusxasi: blok/o'chirishdan keyin butun ro'yxatni qayta so'ramaymiz, qatorni o'zi o'zgaradi
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => setRows(data?.items ?? []), [data]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  async function block(u: Row, next: boolean) {
    setBusy(u.id); setNote(null);
    try {
      await post(`/admin/users/${u.id}/block`, { block: next });
      setRows((rs) => rs.map((r) => (r.id === u.id ? { ...r, isActive: !next } : r)));
      setNote({ tone: 'ok', text: next ? t('users.blocked') : t('users.unblocked') });
    } catch (e) { setNote({ tone: 'err', text: errText(e, t, t.has, tc('saveFailed')) }); } finally { setBusy(null); }
  }

  async function remove(u: Row) {
    setNote(null);
    try {
      await post(`/admin/users/${u.id}/delete`, { reason: 'admin' });
      setRows((rs) => rs.filter((r) => r.id !== u.id));
      setNote({ tone: 'ok', text: t('users.deleted') });
    } catch (e) { setNote({ tone: 'err', text: errText(e, t, t.has, tc('saveFailed')) }); }
  }

  const cols: Col<Row>[] = [
    { key: 'name', head: tc('name'), cell: (u) => (
      <div className="min-w-0">
        <div className={`font-semibold ${u.fullName ? 'text-navy' : 'text-muted'}`}>{u.fullName || t('users.noName')}</div>
        {u.phone ? <div className="font-mono text-xs text-muted">{phoneDisplay(u.phone)}</div> : null}
      </div>
    ) },
    { key: 'email', head: tc('email'), cell: (u) => <span className="text-xs">{u.email ?? ''}</span> },
    { key: 'orgs', head: t('users.orgs'), cell: (u) => (
      <div className="flex flex-wrap gap-1">
        {u.orgs.map((o) => (
          <Pill key={o.id} tone={o.kyc === 'VERIFIED' ? 'ok' : o.kyc === 'PENDING' ? 'warn' : 'neutral'}>
            {o.isOwner ? <b>{o.name}</b> : o.name}
          </Pill>
        ))}
      </div>
    ) },
    { key: 'roles', head: t('users.personalRoles'), cell: (u) => <span className="font-mono text-[11px] text-muted">{u.personalRoles.join(', ')}</span> },
    { key: 'listings', head: t('users.listings'), num: true, cell: (u) => num(u.listings, locale) },
    { key: 'createdAt', head: tc('createdAt'), num: true, cell: (u) => uzDate(u.createdAt, locale) },
    { key: 'status', head: tc('status'), cell: (u) => (u.isActive ? <Pill tone="ok">{'✓'}</Pill> : <Pill tone="bad">{t('users.blocked')}</Pill>) },
    { key: 'actions', head: tc('actions'), cell: (u) => (
      <div className="flex flex-wrap gap-1.5">
        <button type="button" disabled={busy === u.id} onClick={() => void block(u, u.isActive)} className={`${BTN_GHOST} px-3 py-1 text-xs`}>
          {u.isActive ? t('users.block') : t('users.unblock')}
        </button>
        {/* ConfirmButton title qabul qilmaydi: ogohlantirish o'rovchi span da */}
        <span title={t('users.deleteWarn')}>
          <ConfirmButton label={tc('delete')} confirm={tc('confirm')} onRun={() => remove(u)}
            className="inline-flex items-center rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-700 transition duration-150 hover:bg-red-50 active:scale-[0.98] disabled:opacity-60" />
        </span>
      </div>
    ) },
  ];

  return (
    <>
      <PageHead title={t('nav.users')} lead={t('users.lead')} />
      <Toolbar onSubmit={() => setF({ ...f, q: q.trim(), page: 1 })}>
        <Labeled label={tc('search')} className="grow basis-56">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('users.search')} maxLength={80} className={INPUT} />
        </Labeled>
        <label className="flex items-center gap-2 py-2 text-sm">
          <input type="checkbox" checked={f.blocked} onChange={(e) => setF({ ...f, blocked: e.target.checked, page: 1 })} className="accent-teal" />
          {t('users.blockedOnly')}
        </label>
        <button className={BTN}>{tc('apply')}</button>
        {data ? <span className="ml-auto font-mono text-xs text-muted">{tc('total', { count: data.total })}</span> : null}
      </Toolbar>

      {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}
      {err ? <Notice tone="err">{errText(err, t, t.has, tc('loadFailed'))}</Notice> : null}
      {loading && !data ? <p className="mt-4 text-sm text-muted">{tc('loading')}</p> : null}
      {data ? <DataTable cols={cols} rows={rows} keyOf={(u) => u.id} empty={t('users.empty')} /> : null}
      <Pager page={f.page} pages={pages} onPage={(p) => setF({ ...f, page: p })} />
    </>
  );
}
