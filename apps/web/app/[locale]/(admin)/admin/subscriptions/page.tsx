'use client';
/**
 * Obunachilar reyestri: kim to'layapti, kimniki tugayapti, kim ketdi.
 *
 * Moderatsiyadagi obuna yorlig'idan farqi: u faqat TO'LANMAGAN navbat va u yerda
 * qidiruv ham, sahifalash ham yo'q. Bu ekran esa hamma holatni ko'rsatadi va PAY
 * raqami, telefon yoki ism bo'yicha qidiradi.
 *
 * Filtr, tartib va ochiq varaq (?open=<id>) URL da: havola ulashiladi, foydalanuvchi
 * sahifasi to'g'ridan-to'g'ri bitta obunaga olib keladi.
 */
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api, post } from '@/lib/api';
import { num, uzDate } from '@/lib/format';
import { phoneDisplay } from '@/components/ui/fields';
import { useAdminMe } from '@/components/admin/context';
import {
  AuditLink, BTN, BTN_GHOST, type Col, ConfirmButton, DataTable, Drawer, ExportLink, INPUT, Labeled, LoadError, Notice, PageHead, Pager, Pill,
  Toolbar, errText, useAdminList, useListQuery, type Paged, type SortDir,
} from '@/components/admin/kit';

const STATUSES = ['PENDING', 'ACTIVE', 'CANCELLED'] as const;
type Status = (typeof STATUSES)[number];

type Row = {
  id: string; no: string; status: Status; months: number; amountTiyin: number; grants: string[];
  startsAt: string | null; endsAt: string | null; paidAt: string | null; createdAt: string;
  user: { id: string; fullName: string | null; phone: string | null };
};

const TONE: Record<Status, 'ok' | 'warn' | 'neutral'> = { ACTIVE: 'ok', PENDING: 'warn', CANCELLED: 'neutral' };
const F0 = { status: '', q: '', sort: '', dir: '', page: 1, open: '' };
const PATH = '/admin/subscriptions/registry';
const LIMIT = 30;
const DAY = 86_400_000;

/** Tugashigacha necha kun. Manfiy bo'lsa allaqachon tugagan. */
const daysLeft = (endsAt: string | null) => (endsAt ? Math.ceil((new Date(endsAt).getTime() - Date.now()) / DAY) : null);

export default function AdminSubscriptionsPage() {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const ts = useTranslations('admin.subs');
  const tb = useTranslations('admin.table');
  const locale = useLocale();
  // Bekor qilish faqat egaga: server ham shunday, lekin ishlamaydigan tugmani ko'rsatmaymiz
  const { isOwner } = useAdminMe();

  const { f, set, reset } = useListQuery(F0);
  const filters = { ...f, open: undefined };
  const { data, pages, loading, err, reload } = useAdminList<Row>(PATH, { ...filters, limit: LIMIT });
  const [q, setQ] = useState(f.q);
  useEffect(() => setQ(f.q), [f.q]);

  // ?open= bilan kelgan obuna joriy sahifada bo'lmasa (masalan foydalanuvchi sahifasidan havola),
  // shu bitta qator ids= bilan alohida so'raladi: tafsilot yo'li yo'q, ro'yxatning o'zi yetadi
  const [extra, setExtra] = useState<Row | null>(null);
  useEffect(() => {
    if (!f.open || !data || data.items.some((r) => r.id === f.open)) return;
    let alive = true;
    api<Paged<Row>>(`${PATH}?ids=${encodeURIComponent(f.open)}`).then((r) => { if (alive) setExtra(r.items[0] ?? null); }).catch(() => {});
    return () => { alive = false; };
  }, [f.open, data]);
  const sel = f.open ? (data?.items.find((r) => r.id === f.open) ?? (extra?.id === f.open ? extra : null)) : null;

  const [reason, setReason] = useState('');
  const [moneyReceived, setMoneyReceived] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // Qo'lda eslatma natijasi ro'yxat tepasida: varaq yopiq turganda ham ko'rinsin
  const [remindMsg, setRemindMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  /**
   * Tugayotgan obunaga qo'lda eslatma (operator ham yuboradi). Bir bosqichli: qaytarilmas zarar
   * yo'q, kunlik chegara serverda (409 REMIND_TODAY), shu sababli ikkinchi bosish xabar bilan qaytadi.
   */
  async function remind(r: Row) {
    setRemindMsg(null);
    try {
      await post(`/admin/subscriptions/${r.id}/remind`, {});
      setRemindMsg({ tone: 'ok', text: ts('remindOk', { phone: phoneDisplay(r.user.phone ?? '') }) });
    } catch (e) {
      setRemindMsg({ tone: 'err', text: errText(e, t, t.has, tc('saveFailed')) });
    }
  }

  // Varaq URL da: page ham patch da, aks holda ochish sahifani 1 ga qaytarardi
  function open(r: Row) { setReason(''); setMoneyReceived(false); setNote(null); set({ open: r.id, page: f.page }, 'replace'); }
  function close() { set({ open: '', page: f.page }, 'replace'); }

  async function revoke() {
    if (!sel) return;
    setBusy(true);
    setNote(null);
    try {
      await post(`/admin/subscriptions/${sel.id}/revoke`, { reason: reason.trim(), moneyReceived });
      close();
      void reload();
    } catch (e) {
      setNote({ tone: 'err', text: errText(e, t, t.has, tc('saveFailed')) });
    } finally { setBusy(false); }
  }

  const som = (tiyin: number) => num(Math.round(tiyin / 100), locale);

  const cols: Col<Row>[] = [
    { key: 'no', head: ts('no'), sort: 'no', cell: (r) => <span className="font-mono text-xs font-semibold text-navy">{r.no}</span> },
    {
      key: 'user', head: tc('name'),
      cell: (r) => (
        <>
          <div className="font-semibold text-navy">{r.user.fullName ?? ts('noName')}</div>
          <div className="font-mono text-[11px] text-muted">{phoneDisplay(r.user.phone ?? '')}</div>
        </>
      ),
    },
    { key: 'status', head: tc('status'), sort: 'status', cell: (r) => <Pill tone={TONE[r.status]}>{ts(`status.${r.status}`)}</Pill> },
    // Qaysi tarif olingani qatorning o'z ruxsatlaridan: bir xil summali telefon va vagon qatori boshqacha ajralmaydi
    { key: 'grants', head: t('plans.grants'), cell: (r) => r.grants.map((g) => t(`plans.grant.${g}`)).join(', ') },
    { key: 'months', head: ts('months'), num: true, cell: (r) => r.months },
    { key: 'amount', head: ts('amount'), num: true, sort: 'amountTiyin', cell: (r) => som(r.amountTiyin) },
    {
      // Tugash sanasi yonida qolgan kun: operator "kimniki tugayapti" ni shu ustundan ko'radi
      key: 'endsAt', head: ts('endsAt'), sort: 'endsAt',
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
    { key: 'createdAt', head: ts('createdAt'), num: true, sort: 'createdAt', hidden: true, cell: (r) => uzDate(r.createdAt, locale) },
  ];

  const opt = (v: string, label: string) => <option key={v} value={v}>{label}</option>;

  return (
    <div>
      <PageHead title={t('nav.subscriptions')} lead={ts('lead')}>
        <ExportLink path={PATH} filters={filters} total={data?.total ?? 0} />
      </PageHead>

      <Toolbar onSubmit={() => set({ q: q.trim() })}>
        <Labeled label={tc('search')} className="w-full sm:w-64">
          <input data-search="1" className={INPUT} value={q} onChange={(e) => setQ(e.target.value)} placeholder={ts('searchHint')} />
        </Labeled>
        <Labeled label={tc('status')} className="w-full sm:w-44">
          <select className={INPUT} value={f.status} onChange={(e) => set({ status: e.target.value })}>
            {opt('', tc('all'))}{STATUSES.map((s) => opt(s, ts(`status.${s}`)))}
          </select>
        </Labeled>
        <button type="submit" className={BTN}>{tc('apply')}</button>
        <button type="button" className={BTN_GHOST} onClick={reset}>{tc('reset')}</button>
      </Toolbar>

      {err ? <LoadError err={err} onRetry={reload} /> : null}
      {remindMsg ? <Notice tone={remindMsg.tone}>{remindMsg.text}</Notice> : null}
      {data ? <p className="mt-4 font-mono text-xs text-muted">{tc('total', { count: data.total })}</p> : null}

      <DataTable
        cols={cols} rows={data?.items ?? []} keyOf={(r) => r.id} empty={tc('empty')} loading={loading} screen="subs"
        onReset={reset} onRow={open}
        sort={f.sort ? { field: f.sort, dir: (f.dir === 'desc' ? 'desc' : 'asc') as SortDir } : undefined}
        onSort={(field, dir) => set({ sort: field, dir })}
        rowMenu={(r) => [
          { label: tb('open'), onSelect: () => open(r) },
          { label: tb('user'), href: `/admin/users/${r.user.id}` },
          ...(r.user.phone ? [{ label: ts('openAll'), href: `/admin/subscriptions?q=${encodeURIComponent(r.user.phone)}` }] : []),
          // Eslatma faqat faol va 30 kun ichida tugaydiganga: avto eslatma 3 kun qolganda ketadi, undan oldingi
          // qo'ng'iroq o'rnini shu bosadi; uzoq muddatliga eslatma shovqin
          ...(r.status === 'ACTIVE' && (daysLeft(r.endsAt) ?? 99) <= 30 ? [{ label: ts('remind'), onSelect: () => void remind(r) }] : []),
          { label: tb('history'), href: `/admin/audit?entity=Subscription&entityId=${r.id}` },
        ]}
      />
      <Pager page={f.page} pages={pages} onPage={(p) => set({ page: p })} />

      <Drawer
        open={!!sel}
        title={sel?.no ?? ''}
        onClose={close}
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
            <button type="button" className={BTN_GHOST} onClick={close}>{tc('cancel')}</button>
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
