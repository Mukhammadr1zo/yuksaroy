'use client';
// Foydalanuvchilar ro'yxati: qidiruv, tartib, tanlab bloklash, CSV (faqat ega).
//
// Bitta foydalanuvchining tafsiloti, bloklash va o'chirish obyekt sahifasida (/admin/users/{id}):
// ilgari yon varaqda edi va orqaga tugmasi filtrli ro'yxatga qaytarmasdi. Ommaviy bloklash
// serverda bitta so'rov bilan (bulk-block), sabab majburiy va auditga yoziladi.
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { post } from '@/lib/api';
import { num, uzDate } from '@/lib/format';
import { phoneDisplay } from '@/components/ui/fields';
import {
  BTN, BTN_GHOST, BULK_MAX, BulkBar, type Col, ConfirmButton, DataTable, ExportLink, INPUT, Labeled, LoadError, Notice, PageHead, Pager, Pill,
  Toolbar, errText, useAdminList, useListQuery, type SortDir,
} from '@/components/admin/kit';

type Row = {
  id: string; phone: string | null; email: string | null; fullName: string | null; isActive: boolean;
  createdAt: string; personalRoles: string[]; listings: number;
  orgs: { id: string; name: string; kyc: string; isOwner: boolean }[];
};

/** URL dagi holat: blocked '1' faqat bloklanganlar; sukut qiymat manzilga yozilmaydi. */
const F0 = { q: '', blocked: '', sort: '', dir: '', page: 1 };
const PATH = '/admin/users';

export default function AdminUsersPage() {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const tb = useTranslations('admin.table');
  const locale = useLocale();

  // Murojaat qutisi va paleta ?q= bilan keladi: qidiruv URL dan boshlanadi
  const { f, set, reset } = useListQuery(F0);
  const { data, pages, loading, err, reload } = useAdminList<Row>(PATH, f);
  const [q, setQ] = useState(f.q);
  useEffect(() => setQ(f.q), [f.q]);

  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const filterKey = JSON.stringify({ ...f, page: 0 });
  useEffect(() => setIds(new Set()), [filterKey]);
  const clearSel = useCallback(() => setIds(new Set()), []);

  /** Tanlanganlarni bloklash: o'zini va jamoa a'zosini server o'tkazib yuboradi (skipped). */
  async function blockSel() {
    setBusy(true); setNote(null);
    try {
      const r = await post<{ done: number; skipped: number }>(`${PATH}/bulk-block`, { ids: Array.from(ids), reason: reason.trim() });
      setNote({ tone: 'ok', text: tb('bulkDone', { done: r.done, skipped: r.skipped }) });
      clearSel(); setReason('');
      void reload();
    } catch (e) { setNote({ tone: 'err', text: errText(e, t, t.has, tc('saveFailed')) }); } finally { setBusy(false); }
  }

  const cols: Col<Row>[] = [
    // Kenglik berilgan: uzun tashkilot nomi yonida ism ustuni siqilib, har harf yangi qatorga tushardi
    { key: 'name', head: tc('name'), sort: 'fullName', width: '15rem', cell: (u) => (
      <div className="min-w-0">
        <div className={`font-semibold ${u.fullName ? 'text-navy' : 'text-muted'}`}>{u.fullName || t('users.noName')}</div>
        {u.phone ? <div className="font-mono text-xs text-muted">{phoneDisplay(u.phone)}</div> : null}
      </div>
    ) },
    // wrap-anywhere: elektron pochta bo'shliqsiz uzun so'z, ustunni cho'zib yuborardi
    { key: 'email', head: tc('email'), width: '12rem', cell: (u) => <span className="block wrap-anywhere text-xs">{u.email ?? ''}</span> },
    { key: 'orgs', head: t('users.orgs'), cell: (u) => (
      // min-w-0: yorliq ichidagi uzun tashkilot nomi katakni cho'zmasin, kesilsin
      <div className="flex min-w-0 max-w-[14rem] flex-wrap gap-1">
        {u.orgs.map((o) => (
          <Pill key={o.id} tone={o.kyc === 'VERIFIED' ? 'ok' : o.kyc === 'PENDING' ? 'warn' : 'neutral'}>
            {o.isOwner ? <b>{o.name}</b> : o.name}
          </Pill>
        ))}
      </div>
    ) },
    { key: 'roles', head: t('users.personalRoles'), cell: (u) => <span className="font-mono text-[11px] text-muted">{u.personalRoles.join(', ')}</span> },
    { key: 'listings', head: t('users.listings'), num: true, sort: 'listings', cell: (u) => num(u.listings, locale) },
    { key: 'createdAt', head: tc('createdAt'), num: true, sort: 'createdAt', cell: (u) => uzDate(u.createdAt, locale) },
    { key: 'status', head: tc('status'), cell: (u) => (u.isActive ? <Pill tone="ok">{'✓'}</Pill> : <Pill tone="bad">{t('users.blocked')}</Pill>) },
  ];

  const needReason = !reason.trim();

  return (
    <>
      <PageHead title={t('nav.users')} lead={t('users.lead')}>
        {/* Telefon va email shaxsiy ma'lumot: eksport faqat egaga, operatorga tugma chizilmaydi */}
        <ExportLink path={PATH} filters={f} total={data?.total ?? 0} ids={ids} ownerOnly />
      </PageHead>
      <Toolbar onSubmit={() => set({ q: q.trim() })}>
        <Labeled label={tc('search')} className="grow basis-56">
          <input data-search="1" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('users.search')} maxLength={80} className={INPUT} />
        </Labeled>
        <label className="flex items-center gap-2 py-2 text-sm">
          <input type="checkbox" checked={f.blocked === '1'} onChange={(e) => set({ blocked: e.target.checked ? '1' : '' })} className="accent-teal" />
          {t('users.blockedOnly')}
        </label>
        <button className={BTN}>{tc('apply')}</button>
        <button type="button" className={BTN_GHOST} onClick={reset}>{tc('reset')}</button>
        {data ? <span className="ml-auto font-mono text-xs text-muted">{tc('total', { count: data.total })}</span> : null}
      </Toolbar>

      {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}
      {err ? <LoadError err={err} onRetry={reload} /> : null}
      <DataTable
        cols={cols} rows={data?.items ?? []} keyOf={(u) => u.id} empty={t('users.empty')} loading={loading} screen="users"
        onReset={reset}
        sort={f.sort ? { field: f.sort, dir: (f.dir === 'desc' ? 'desc' : 'asc') as SortDir } : undefined}
        onSort={(field, dir) => set({ sort: field, dir })}
        select={{ ids, onChange: setIds }}
        href={(u) => `/admin/users/${u.id}`}
        rowMenu={(u) => [
          { label: tb('open'), href: `/admin/users/${u.id}` },
          { label: tb('history'), href: `/admin/audit?entity=User&entityId=${u.id}` },
          // Uning o'zi qilgan amallar: raqam ochish, e'lon, taklif. Hisob tarixi bu emas
          { label: tb('hisActions'), href: `/admin/audit?actor=${u.id}` },
        ]}
      />
      <Pager page={f.page} pages={pages} onPage={(p) => set({ page: p })} />

      <BulkBar count={ids.size} onClear={clearSel}>
        <span className="flex w-full flex-col gap-0.5 sm:w-72">
          {/* Sabab faqat auditga: bloklangan odamga chiqmaydi (bulkReason listings uchun, u yerda egasiga ko'rinadi) */}
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder={tb('bulkBlockReason')}
            aria-label={tb('bulkBlockReason')} className={`${INPUT} text-navy`} />
          {needReason ? <span className="text-[11px] text-white/70">{t('reasonRequired')}</span> : null}
        </span>
        <ConfirmButton label={tb('bulkBlock')} confirm={tc('confirm')} onRun={blockSel} disabled={busy || needReason || ids.size > BULK_MAX} />
      </BulkBar>
    </>
  );
}
