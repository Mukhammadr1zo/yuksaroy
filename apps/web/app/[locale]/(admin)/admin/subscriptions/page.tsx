'use client';
/**
 * Obunachilar reyestri: kim to'layapti, kimniki tugayapti, kim ketdi.
 *
 * Moderatsiyadagi obuna yorlig'idan farqi: u faqat TO'LANMAGAN navbat va u yerda
 * qidiruv ham, sahifalash ham yo'q. Bu ekran esa hamma holatni ko'rsatadi va PAY
 * raqami, telefon yoki ism bo'yicha qidiradi.
 */
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api, post } from '@/lib/api';
import { num, uzDate } from '@/lib/format';
import { phoneDisplay } from '@/components/ui/fields';
import type { Me } from '@/lib/types-auth';
import { AuditLink, BTN, BTN_GHOST, type Col, ConfirmButton, DataTable, Drawer, INPUT, Labeled, Notice, PageHead, Pager, Pill, Toolbar, errText, useAdminList } from '@/components/admin/kit';

const STATUSES = ['PENDING', 'ACTIVE', 'CANCELLED'] as const;
type Status = (typeof STATUSES)[number];

type Row = {
  id: string; no: string; status: Status; months: number; amountTiyin: number; grants: string[];
  startsAt: string | null; endsAt: string | null; paidAt: string | null; createdAt: string;
  user: { id: string; fullName: string | null; phone: string | null };
};

const TONE: Record<Status, 'ok' | 'warn' | 'neutral'> = { ACTIVE: 'ok', PENDING: 'warn', CANCELLED: 'neutral' };
const F0 = { status: '', q: '', page: 1 };
const DAY = 86_400_000;

/** Tugashigacha necha kun. Manfiy bo'lsa allaqachon tugagan. */
const daysLeft = (endsAt: string | null) => (endsAt ? Math.ceil((new Date(endsAt).getTime() - Date.now()) / DAY) : null);

export default function AdminSubscriptionsPage() {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const ts = useTranslations('admin.subs');
  const locale = useLocale();

  const [form, setForm] = useState(F0);
  const [f, setF] = useState(F0);
  const { data, pages, loading, err, reload } = useAdminList<Row>('/admin/subscriptions/registry', { ...f, limit: 30 });

  // Bekor qilish faqat egaga: server ham shunday, lekin ishlamaydigan tugmani ko'rsatmaymiz
  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => { api<Me>('/auth/me').then((m) => setIsOwner(!!m.isPlatformOwner)).catch(() => {}); }, []);

  const [sel, setSel] = useState<Row | null>(null);
  const [reason, setReason] = useState('');
  const [moneyReceived, setMoneyReceived] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function open(r: Row) { setSel(r); setReason(''); setMoneyReceived(false); setNote(null); }

  async function revoke() {
    if (!sel) return;
    setBusy(true);
    setNote(null);
    try {
      await post(`/admin/subscriptions/${sel.id}/revoke`, { reason: reason.trim(), moneyReceived });
      setSel(null);
      void reload();
    } catch (e) {
      setNote({ tone: 'err', text: errText(e, t, t.has, tc('saveFailed')) });
    } finally { setBusy(false); }
  }

  const som = (tiyin: number) => num(Math.round(tiyin / 100), locale);

  const cols: Col<Row>[] = [
    { key: 'no', head: ts('no'), cell: (r) => <span className="font-mono text-xs font-semibold text-navy">{r.no}</span> },
    {
      key: 'user', head: tc('name'),
      cell: (r) => (
        <>
          <div className="font-semibold text-navy">{r.user.fullName ?? ts('noName')}</div>
          <div className="font-mono text-[11px] text-muted">{phoneDisplay(r.user.phone ?? '')}</div>
        </>
      ),
    },
    { key: 'status', head: tc('status'), cell: (r) => <Pill tone={TONE[r.status]}>{ts(`status.${r.status}`)}</Pill> },
    // Qaysi tarif olingani qatorning o'z ruxsatlaridan: bir xil summali telefon va vagon qatori boshqacha ajralmaydi
    { key: 'grants', head: t('plans.grants'), cell: (r) => r.grants.map((g) => t(`plans.grant.${g}`)).join(', ') },
    { key: 'months', head: ts('months'), num: true, cell: (r) => r.months },
    { key: 'amount', head: ts('amount'), num: true, cell: (r) => som(r.amountTiyin) },
    {
      // Tugash sanasi yonida qolgan kun: operator "kimniki tugayapti" ni shu ustundan ko'radi
      key: 'endsAt', head: ts('endsAt'),
      cell: (r) => {
        const d = daysLeft(r.endsAt);
        if (!r.endsAt) return '';
        return (
          <>
            <div className="font-mono text-xs">{uzDate(r.endsAt, locale)}</div>
            {r.status === 'ACTIVE' && d !== null ? (
              <div className={`text-[11px] ${d <= 7 ? 'font-semibold text-amber-ink' : 'text-muted'}`}>{ts('daysLeft', { n: d })}</div>
            ) : null}
          </>
        );
      },
    },
    { key: 'paidAt', head: ts('paidAt'), cell: (r) => (r.paidAt ? <span className="font-mono text-xs">{uzDate(r.paidAt, locale)}</span> : '') },
  ];

  const opt = (v: string, label: string) => <option key={v} value={v}>{label}</option>;

  return (
    <div>
      <PageHead title={t('nav.subscriptions')} lead={ts('lead')} />

      <Toolbar onSubmit={() => setF({ ...form, page: 1 })}>
        <Labeled label={tc('search')} className="w-full sm:w-64">
          <input className={INPUT} value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} placeholder={ts('searchHint')} />
        </Labeled>
        <Labeled label={tc('status')} className="w-full sm:w-44">
          <select className={INPUT} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {opt('', tc('all'))}{STATUSES.map((s) => opt(s, ts(`status.${s}`)))}
          </select>
        </Labeled>
        <button type="submit" className={BTN}>{tc('apply')}</button>
        <button type="button" className={BTN_GHOST} onClick={() => { setForm(F0); setF(F0); }}>{tc('reset')}</button>
      </Toolbar>

      {err ? <Notice tone="err">{errText(err, t, t.has, tc('loadFailed'))}</Notice> : null}
      <p className="mt-4 font-mono text-xs text-muted">{loading || !data ? tc('loading') : tc('total', { count: data.total })}</p>

      <DataTable cols={cols} rows={data?.items ?? []} keyOf={(r) => r.id} empty={tc('empty')} onRow={open} />
      <Pager page={f.page} pages={pages} onPage={(p) => { setF({ ...f, page: p }); setForm({ ...form, page: p }); }} />

      <Drawer
        open={!!sel}
        title={sel?.no ?? ''}
        onClose={() => setSel(null)}
        footer={sel ? (
          <>
            {note ? <div className="w-full"><Notice tone={note.tone}>{note.text}</Notice></div> : null}
            <div className="w-full"><AuditLink entity="Subscription" id={sel.id} /></div>
            {isOwner && sel.status === 'ACTIVE' ? (
              <div className="mr-auto flex flex-col items-start gap-1">
                <span className="text-xs text-muted">{ts('revokeWarn')}</span>
                <ConfirmButton label={ts('revoke')} confirm={tc('confirm')} disabled={busy || !reason.trim()} onRun={revoke} />
              </div>
            ) : null}
            <button type="button" className={BTN_GHOST} onClick={() => setSel(null)}>{tc('cancel')}</button>
          </>
        ) : null}
      >
        {sel ? (
          <div className="space-y-3 text-sm">
            <Field k={tc('name')} v={sel.user.fullName ?? ts('noName')} />
            <Field k={ts('phone')} v={phoneDisplay(sel.user.phone ?? '')} mono />
            <Field k={tc('status')} v={ts(`status.${sel.status}`)} />
            <Field k={t('plans.grants')} v={sel.grants.map((g) => t(`plans.grant.${g}`)).join(', ')} />
            <Field k={ts('months')} v={String(sel.months)} mono />
            <Field k={ts('amount')} v={som(sel.amountTiyin)} mono />
            <Field k={ts('createdAt')} v={uzDate(sel.createdAt, locale)} mono />
            <Field k={ts('paidAt')} v={sel.paidAt ? uzDate(sel.paidAt, locale) : '-'} mono />
            <Field k={ts('startsAt')} v={sel.startsAt ? uzDate(sel.startsAt, locale) : '-'} mono />
            <Field k={ts('endsAt')} v={sel.endsAt ? uzDate(sel.endsAt, locale) : '-'} mono />

            {isOwner && sel.status === 'ACTIVE' ? (
              <div className="mt-4 rounded-2xl border border-line bg-white p-4">
                <p className="text-sm font-semibold text-navy">{ts('revokeTitle')}</p>
                <p className="mt-1 text-xs text-muted">{ts('revokeHint')}</p>
                <Labeled label={ts('reason')} className="mt-3 block">
                  <input className={INPUT} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
                </Labeled>
                {/* Pul kelgan-kelmagani daromad varag'iga ta'sir qiladi, shuning uchun taxmin qilinmaydi */}
                <label className="mt-3 flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={moneyReceived} onChange={(e) => setMoneyReceived(e.target.checked)} />
                  <span>{ts('moneyReceived')}</span>
                </label>
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

function Field({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-soft pb-2">
      <span className="text-xs text-muted">{k}</span>
      <span className={mono ? 'font-mono text-sm text-navy' : 'text-sm font-semibold text-navy'}>{v}</span>
    </div>
  );
}
