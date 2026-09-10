'use client';
// Hujjatlar: akt va hisoblar bitta jadvalda. Terminal hisobni "to'landi" deb belgilaydi (bank o'tkazmasi, F1 da onlayn to'lov yo'q).
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api, post } from '@/lib/api';
import { som, uzDateTime } from '@/lib/format';
import type { Membership } from '@/lib/types-kabinet';
import type { MineDoc, MineDocs } from '@/lib/types-dashboard';
import { CHIP, INPUT, Notice } from '@/components/kabinet/bits';

type Scope = 'client' | 'terminal';
const STATUS = ['all', 'ISSUED', 'OVERDUE', 'PAID_OFFLINE', 'ACT'] as const;
type Status = (typeof STATUS)[number];
const TONE: Record<string, string> = {
  ISSUED: 'bg-amber-soft text-amber-ink', OVERDUE: 'bg-red-50 text-red-700', PAID_OFFLINE: 'bg-teal text-white',
  READY: 'bg-teal-soft text-teal-ink', DRAFT: 'bg-line text-ink/70', VOID: 'bg-line text-ink/70',
};
/** Toshkent oyi: "2026-09" (input type=month qiymati bilan bir xil). */
const monthOf = (d: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit' }).format(new Date(d));

export default function DocumentsPage() {
  const t = useTranslations('dashboard2.docs');
  const [isTerminal, setIsTerminal] = useState<boolean | null>(null);
  const [scope, setScope] = useState<Scope>('client');
  const [data, setData] = useState<MineDocs | null>(null);
  const [err, setErr] = useState(false);
  const [noStir, setNoStir] = useState(false);
  const [status, setStatus] = useState<Status>('all');
  const [month, setMonth] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  // Terminal tashkiloti bo'lsa standart ko'rinish terminalniki.
  // STIR birinchi buyurtmada so'ralmaydi, lekin hisob-fakturada kerak: bo'sh bo'lsa shu yerda eslatiladi.
  useEffect(() => {
    api<Membership[]>('/orgs/mine')
      .then((ms) => {
        const has = ms.some((m) => (m.org.kinds?.length ? m.org.kinds : [m.org.kind]).includes('TERMINAL'));
        setIsTerminal(has); if (has) setScope('terminal');
        setNoStir(ms.some((m) => m.isOwner && !m.org.stir));
      })
      .catch(() => setIsTerminal(false));
  }, []);
  useEffect(() => {
    if (isTerminal === null) return;
    setData(null); setErr(false);
    // ponytail: 100 tagacha hujjat, filtr brauzerda; sahifalash 100+ hujjatda
    api<MineDocs>(`/documents/mine?scope=${scope}&limit=100`).then(setData).catch(() => setErr(true));
  }, [scope, isTerminal]);

  async function markPaid(d: MineDoc) {
    if (!window.confirm(t('confirmPaid', { no: d.no }))) return;
    setBusy(d.no); setNote(null);
    try {
      const r = await post<{ no: string; status: string }>(`/invoices/${d.no}/mark-paid`, {});
      setData((x) => x ? { ...x, items: x.items.map((i) => (i.kind === 'INVOICE' && i.no === d.no ? { ...i, status: r.status } : i)) } : x);
      setNote({ tone: 'ok', text: t('marked', { no: d.no }) });
    } catch { setNote({ tone: 'err', text: t('markFailed') }); } finally { setBusy(null); }
  }

  const items = (data?.items ?? []).filter((d) =>
    (status === 'all' || (status === 'ACT' ? d.kind === 'ACT' : d.kind === 'INVOICE' && d.status === status)) && (!month || monthOf(d.createdAt) === month));

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
      <p className="mt-1 max-w-2xl text-muted">{t('lead')}</p>
      {noStir ? (
        <p className="mt-4 rounded-card border border-amber/40 bg-amber-soft px-4 py-3 text-sm">
          {t('stirMissing')}{' '}
          <Link href="/dashboard/organization" className="font-semibold text-amber-ink underline">{t('stirAdd')}</Link>
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {isTerminal ? (
          <>
            {(['terminal', 'client'] as Scope[]).map((s) => <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)} className={CHIP(scope === s)}>{t(`scope.${s}`)}</button>)}
            <span aria-hidden className="mx-1 h-5 w-px bg-line" />
          </>
        ) : null}
        {STATUS.map((s) => <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)} className={CHIP(status === s)}>{t(`status.${s}`)}</button>)}
        <label className="ml-auto flex items-center gap-2 text-sm font-semibold">
          <span className="sr-only">{t('month')}</span>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label={t('month')} className={`${INPUT} w-auto py-1.5 font-mono text-sm`} />
          {month ? <button type="button" onClick={() => setMonth('')} className="text-muted underline hover:text-ink">{t('anyMonth')}</button> : null}
        </label>
      </div>

      {note ? <div className="mt-5"><Notice tone={note.tone}>{note.text}</Notice></div> : null}
      {err ? <p role="alert" className="mt-6 text-sm text-red-700">{t('loadFailed')}</p> : null}
      {!data && !err ? <p className="mt-6 text-sm text-muted">{t('loading')}</p> : null}
      {data && items.length === 0 ? (
        <p className="mt-6 rounded-card border border-dashed border-line bg-white p-10 text-center text-muted">{t(data.items.length ? 'emptyFiltered' : 'empty')}</p>
      ) : null}

      {items.length ? (
        <div className="mt-6 overflow-x-auto rounded-card border border-line bg-white">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-semibold">{t('col.no')}</th>
                <th className="px-3 py-3 font-semibold">{t('col.kind')}</th>
                <th className="px-3 py-3 font-semibold">{t('col.order')}</th>
                <th className="px-3 py-3 font-semibold">{t('col.org')}</th>
                <th className="px-3 py-3 text-right font-semibold">{t('col.amount')}</th>
                <th className="px-3 py-3 font-semibold">{t('col.status')}</th>
                <th className="px-3 py-3 font-semibold">{t('col.date')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((d) => {
                const payable = scope === 'terminal' && d.kind === 'INVOICE' && (d.status === 'ISSUED' || d.status === 'OVERDUE');
                return (
                  <tr key={d.id} className="border-b border-line/70 last:border-0">
                    <td className="px-4 py-3 font-mono font-bold">{d.no}</td>
                    <td className="px-3 py-3">{t(`kind.${d.kind}`)}</td>
                    <td className="px-3 py-3"><Link href={`/dashboard/orders/${d.orderNo}`} className="font-mono hover:underline">{d.orderNo}</Link></td>
                    <td className="px-3 py-3">{d.orgName}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">{som(d.amountTiyin)}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${TONE[d.status] ?? 'bg-line text-ink/70'}`}>{t.has(`st.${d.status}`) ? t(`st.${d.status}`) : d.status}</span>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-muted">{uzDateTime(d.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2 whitespace-nowrap">
                        {/* Rewrite orqali cookie bilan boradi: /api/v1/documents/:id/download */}
                        <a href={`/api${d.downloadUrl}`} target="_blank" rel="noopener" className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold transition hover:border-teal hover:bg-sand">{t('pdf')}</a>
                        {payable ? (
                          <button type="button" disabled={busy === d.no} onClick={() => markPaid(d)} className="rounded-full bg-teal px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-ink disabled:opacity-60">{busy === d.no ? t('marking') : t('markPaid')}</button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {data && data.total > data.items.length ? <p className="mt-4 text-center text-sm text-muted">{t('shown', { n: data.items.length, total: data.total })}</p> : null}
    </main>
  );
}
