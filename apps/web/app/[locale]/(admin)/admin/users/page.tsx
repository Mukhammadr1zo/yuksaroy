'use client';
// Foydalanuvchilar: qidiruv, bloklash, o'chirish.
//
// Amallar qatorda emas, yon varaqda. Ilgari ular jadvalda turardi va o'chirish
// ogohlantirishi faqat sichqoncha ustiga kelganda chiqadigan title edi: zich jadvalda
// to'rt soniya ichida ikki bosish hisobni butunlay anonimlashtirardi. Endi varaqda kim
// o'chirilayotgani, nima bo'lishi va sabab maydoni ko'rinib turadi. Sabab auditga yoziladi.
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api, post } from '@/lib/api';
import { num, som, uzDate, uzDateTime } from '@/lib/format';
import { phoneDisplay } from '@/components/ui/fields';
import { AuditLink, BTN, BTN_DANGER, BTN_GHOST, CARD, type Col, ConfirmButton, DataTable, Drawer, INPUT, Labeled, Notice, PageHead, Pager, Pill, Toolbar, errText, useAdminList } from '@/components/admin/kit';
import { Link } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';

type Row = {
  id: string; phone: string | null; email: string | null; fullName: string | null; isActive: boolean;
  createdAt: string; personalRoles: string[]; listings: number;
  orgs: { id: string; name: string; kyc: string; isOwner: boolean }[];
};
/** GET /admin/users/:id: ro'yxat qatoridan ko'ra ko'proq, har ro'yxat oxirgi 5 ta bilan chegaralangan. */
type Detail = Row & {
  locale: string; hasPassword: boolean; hasGoogle: boolean; lockedUntil: string | null; failedLogins: number;
  telegram: { username: string | null; linkedAt: string } | null;
  lastSeenAt: string | null; activeSessions: number;
  subscriptions: { id: string; no: string; status: string; grants: string[]; months: number; amountTiyin: number; endsAt: string | null; createdAt: string }[];
  listings: { id: string; title: string; kind: string; status: string; createdAt: string }[];
  listingsTotal: number; listingsActive: number;
  marketRequests: { id: string; no: string; board: string; status: string; createdAt: string }[];
  requestsTotal: number;
  serviceProfiles: { id: string; serviceType: string; title: string; status: string }[];
  wagonTotal: number; wagon30d: number; reveals: number;
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
  const td = useTranslations('admin.users.detail');
  const locale = useLocale();
  const [reason, setReason] = useState('');
  const need = !reason.trim();
  // Tafsilot alohida so'rovda: ro'yxat yengil qoladi, varaq ochilganda to'ladi
  const [d, setD] = useState<Detail | null>(null);
  const [dErr, setDErr] = useState(false);
  useEffect(() => {
    let alive = true;
    setD(null); setDErr(false);
    api<Detail>(`/admin/users/${u.id}`).then((x) => { if (alive) setD(x); }).catch(() => { if (alive) setDErr(true); });
    return () => { alive = false; };
  }, [u.id]);

  const login = d ? [d.hasPassword ? td('password') : null, d.hasGoogle ? td('google') : null].filter(Boolean).join(', ') || td('codeOnly') : '';
  const H = 'mb-1 mt-4 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted';
  const status = (s: string) => <Pill tone={s === 'ACTIVE' || s === 'OPEN' || s === 'DONE' ? 'ok' : s === 'PENDING' ? 'warn' : s === 'BLOCKED' || s === 'CANCELLED' ? 'bad' : 'neutral'}>{s}</Pill>;

  return (
    <Drawer open title={u.fullName || u.phone || t('users.noName')} onClose={onClose}>
      <dl className={`${CARD} grid grid-cols-2 gap-x-4 gap-y-2 p-3 text-sm wrap-anywhere`}>
        <Fact k={tc('phone')} v={u.phone ? phoneDisplay(u.phone) : '-'} mono />
        <Fact k={tc('email')} v={u.email || '-'} />
        <Fact k={tc('status')} v={u.isActive ? tc('open') : t('users.blocked')} />
        <Fact k={tc('createdAt')} v={uzDate(u.createdAt, locale)} mono />
        {d ? (
          <>
            <Fact k={td('lastSeen')} v={d.lastSeenAt ? uzDateTime(d.lastSeenAt, locale) : td('never')} mono />
            <Fact k={td('sessions')} v={num(d.activeSessions, locale)} mono />
            <Fact k={td('login')} v={login} />
            <Fact k={td('telegram')} v={d.telegram ? (d.telegram.username ? `@${d.telegram.username}` : uzDate(d.telegram.linkedAt, locale)) : td('noTelegram')} mono />
            <Fact k={td('locale')} v={d.locale} mono />
            {d.lockedUntil && new Date(d.lockedUntil) > new Date() ? <Fact k={td('failed', { n: d.failedLogins })} v={td('locked', { until: uzDateTime(d.lockedUntil, locale) })} mono /> : null}
          </>
        ) : null}
      </dl>
      {dErr ? <Notice tone="err">{td('loadFailed')}</Notice> : null}
      {!d && !dErr ? <p className="mt-2 text-xs text-muted">{tc('loading')}</p> : null}

      {d ? (
        <>
          {/* Pul: obuna olganmi, nechta raqam ochgan. Bezak emas: shikoyat yoki qaytarish so'rovida shu qaraladi */}
          <h3 className={H}>{td('money')}</h3>
          <dl className={`${CARD} grid grid-cols-2 gap-x-4 gap-y-2 p-3 text-sm`}>
            <Fact k={td('reveals')} v={num(d.reveals, locale)} mono />
            <Fact k={td('wagon')} v={`${num(d.wagonTotal, locale)} (${td('wagon30', { n: num(d.wagon30d, locale) })})`} mono />
          </dl>
          <h3 className={H}>{td('subscriptions')}</h3>
          {!d.subscriptions.length ? <p className={`${CARD} border-dashed p-3 text-sm text-muted`}>{td('noSubs')}</p> : (
            <ul className={`${CARD} divide-y divide-line/70 text-sm`}>
              {d.subscriptions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <span className="font-mono text-xs">{s.no}</span>
                  {status(s.status)}
                  <span className="font-mono text-[11px] text-muted">{s.grants.join('+')} · {s.months}</span>
                  <span className="ml-auto font-mono text-xs tabular-nums">{som(s.amountTiyin, locale)}</span>
                  {s.endsAt ? <span className="w-full font-mono text-[11px] text-muted sm:w-auto">{uzDate(s.endsAt, locale)}</span> : null}
                </li>
              ))}
            </ul>
          )}

          <h3 className={H}>{td('activity')}</h3>
          <dl className={`${CARD} grid grid-cols-3 gap-x-4 gap-y-2 p-3 text-sm`}>
            <Fact k={t('users.listings')} v={`${num(d.listingsTotal, locale)} (${td('listingsActive', { n: num(d.listingsActive, locale) })})`} mono />
            <Fact k={td('requests')} v={num(d.requestsTotal, locale)} mono />
            <Fact k={td('services')} v={num(d.serviceProfiles.length, locale)} mono />
          </dl>
          {d.listings.length ? (
            <ul className={`${CARD} mt-2 divide-y divide-line/70 text-sm`}>
              {d.listings.map((l) => (
                <li key={l.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate">{l.title}</span>
                  <span className="font-mono text-[11px] text-muted">{l.kind}</span>
                  {status(l.status)}
                </li>
              ))}
            </ul>
          ) : null}
          {d.marketRequests.length ? (
            <ul className={`${CARD} mt-2 divide-y divide-line/70 text-sm`}>
              {d.marketRequests.map((r) => (
                <li key={r.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="font-mono text-xs">{r.no}</span>
                  <span className="font-mono text-[11px] text-muted">{r.board}</span>
                  {status(r.status)}
                  <span className="ml-auto font-mono text-[11px] text-muted">{uzDate(r.createdAt, locale)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {d.serviceProfiles.length ? (
            <ul className={`${CARD} mt-2 divide-y divide-line/70 text-sm`}>
              {d.serviceProfiles.map((p) => (
                <li key={p.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  <span className="font-mono text-[11px] text-muted">{p.serviceType}</span>
                  {status(p.status)}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            <AuditLink entity="User" id={u.id} />
            {/* Uning o'zi qilgan amallar: raqam ochish, e'lon, taklif. Hisob tarixi bu emas */}
            <Link href={`/admin/audit?actor=${u.id}`} className="font-semibold text-teal-ink hover:underline">{td('actions')}</Link>
          </div>
        </>
      ) : null}

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
