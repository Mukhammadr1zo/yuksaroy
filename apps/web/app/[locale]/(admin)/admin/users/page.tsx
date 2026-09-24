'use client';
// Foydalanuvchilar: qidiruv, bloklash, o'chirish.
//
// Amallar qatorda emas, yon varaqda. Ilgari ular jadvalda turardi va o'chirish
// ogohlantirishi faqat sichqoncha ustiga kelganda chiqadigan title edi: zich jadvalda
// to'rt soniya ichida ikki bosish hisobni butunlay anonimlashtirardi. Endi varaqda kim
// o'chirilayotgani, nima bo'lishi va sabab maydoni ko'rinib turadi. Sabab auditga yoziladi.
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { post } from '@/lib/api';
import { num, uzDate } from '@/lib/format';
import { phoneDisplay } from '@/components/ui/fields';
import { BTN, BTN_DANGER, BTN_GHOST, CARD, type Col, ConfirmButton, DataTable, Drawer, INPUT, Labeled, Notice, PageHead, Pager, Pill, Toolbar, errText, useAdminList } from '@/components/admin/kit';
import { useSearchParams } from 'next/navigation';

type Row = {
  id: string; phone: string | null; email: string | null; fullName: string | null; isActive: boolean;
  createdAt: string; personalRoles: string[]; listings: number;
  orgs: { id: string; name: string; kyc: string; isOwner: boolean }[];
};

export default function AdminUsersPage() {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  // Murojaat qutisidagi raqam shu yerga havola qiladi: qidiruv URL dan boshlanadi.
  // Suspense shart emas: AdminShell huquq tasdiqlanguncha bolalarni chizmaydi.
  const init = useSearchParams().get('q') ?? '';
  const [f, setF] = useState({ q: init, blocked: false, page: 1 });
  const [q, setQ] = useState(init);
  const { data, pages, loading, err } = useAdminList<Row>('/admin/users', { q: f.q, blocked: f.blocked ? 1 : undefined, page: f.page });
  // Jadvalning mahalliy nusxasi: blok/o'chirishdan keyin butun ro'yxatni qayta so'ramaymiz, qatorni o'zi o'zgaradi
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => setRows(data?.items ?? []), [data]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [sel, setSel] = useState<Row | null>(null);

  // Sabab auditga yoziladi: ilgari blokda u umuman yuborilmasdi, o'chirishda esa
  // har doim "admin" deb ketardi, ya'ni jurnalda nima uchun ekani qolmasdi.
  async function block(u: Row, next: boolean, reason: string) {
    setBusy(u.id); setNote(null);
    try {
      await post(`/admin/users/${u.id}/block`, { block: next, reason });
      setRows((rs) => rs.map((r) => (r.id === u.id ? { ...r, isActive: !next } : r)));
      setNote({ tone: 'ok', text: next ? t('users.blocked') : t('users.unblocked') });
      setSel(null);
    } catch (e) { setNote({ tone: 'err', text: errText(e, t, t.has, tc('saveFailed')) }); } finally { setBusy(null); }
  }

  async function remove(u: Row, reason: string) {
    setNote(null);
    try {
      await post(`/admin/users/${u.id}/delete`, { reason });
      setRows((rs) => rs.filter((r) => r.id !== u.id));
      setNote({ tone: 'ok', text: t('users.deleted') });
      setSel(null);
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
      {data ? <DataTable cols={cols} rows={rows} keyOf={(u) => u.id} empty={t('users.empty')} onRow={(u) => setSel(u)} /> : null}
      <Pager page={f.page} pages={pages} onPage={(p) => setF({ ...f, page: p })} />

      {sel ? (
        <UserDrawer
          u={sel}
          busy={busy === sel.id}
          onClose={() => setSel(null)}
          onBlock={(next, reason) => block(sel, next, reason)}
          onDelete={(reason) => remove(sel, reason)}
        />
      ) : null}
    </>
  );
}

/** Bitta foydalanuvchi: ma'lumoti, tashkilotlari va ikkita xavfli amal. */
function UserDrawer({ u, busy, onClose, onBlock, onDelete }: {
  u: Row; busy: boolean; onClose: () => void;
  onBlock: (next: boolean, reason: string) => Promise<void>;
  onDelete: (reason: string) => Promise<void>;
}) {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const [reason, setReason] = useState('');
  const need = !reason.trim();

  return (
    <Drawer open title={u.fullName || u.phone || t('users.noName')} onClose={onClose}>
      <dl className={`${CARD} grid grid-cols-2 gap-x-4 gap-y-2 p-3 text-sm wrap-anywhere`}>
        <Fact k={tc('phone')} v={u.phone ? phoneDisplay(u.phone) : '-'} mono />
        <Fact k={tc('email')} v={u.email || '-'} />
        <Fact k={tc('status')} v={u.isActive ? tc('open') : t('users.blocked')} />
        <Fact k={t('users.listings')} v={num(u.listings, locale)} mono />
        <Fact k={tc('createdAt')} v={uzDate(u.createdAt, locale)} mono />
      </dl>

      <section className="mt-4">
        <h3 className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted">{t('nav.orgs')}</h3>
        {!u.orgs.length ? <p className={`${CARD} border-dashed p-3 text-sm text-muted`}>{t('users.noOrg')}</p> : (
          <ul className={`${CARD} divide-y divide-line/70 text-sm`}>
            {u.orgs.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="min-w-0 font-semibold wrap-anywhere">{o.name}</span>
                {o.isOwner ? <Pill tone="ok">{t('users.owner')}</Pill> : null}
                <span className="ml-auto font-mono text-[11px] text-muted">{o.kyc}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${CARD} mt-4 p-3`}>
        <Labeled label={t('users.blockReason')}>
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={INPUT} />
        </Labeled>
        {need ? <p className="mt-1 text-[11px] text-muted">{t('reasonRequired')}</p> : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy || need} onClick={() => void onBlock(u.isActive, reason.trim())} className={BTN_GHOST}>
            {u.isActive ? t('users.block') : t('users.unblock')}
          </button>
          <button type="button" onClick={onClose} className={BTN_GHOST}>{tc('cancel')}</button>
        </div>

        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{t('users.deleteWarn')}</p>
        <div className="mt-2">
          <ConfirmButton label={tc('delete')} confirm={tc('confirm')} disabled={busy || need}
            onRun={() => onDelete(reason.trim())} className={BTN_DANGER} />
        </div>
      </section>
    </Drawer>
  );
}

function Fact({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted">{k}</dt>
      <dd className={`mt-0.5 font-semibold ${mono ? 'font-mono tabular-nums' : ''}`}>{v}</dd>
    </div>
  );
}
