'use client';
// Admin: hamma buyurtmalar. Qotib qolgan buyurtmani (terminal javob bermadi, sweeper o'tkazib yubordi)
// o'tish qoidalarini chetlab holatga majburan qo'yish faqat shu yerda; sabab buyurtma tarixiga tushadi.
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { api, post } from '@/lib/api';
import { num, som, uzDateTime } from '@/lib/format';
import type { OrderLine, OrderTimelineEntry } from '@/lib/types';
import { StatusPill } from '@/components/order/bits';
import { useLang } from '@/components/kabinet/bits';
import { BTN, ConfirmButton, DataTable, Drawer, INPUT, Labeled, Notice, PageHead, Pager, Toolbar, errText, useAdminList, type Col } from '@/components/admin/kit';

/** GET /admin/orders qatori; pul maydonlari serverda Number ga o'tkazilgan. */
type Row = {
  no: string; status: OrderStatus; createdAt: string; operation: string; direction: string; wagonCount: number; totalTiyin: number;
  terminal: { id: string; name: string; slug: string }; shipperOrg: { id: string; name: string };
};
/** GET /admin/orders/:no: qatorlar va tarix (yangisi yuqorida). */
type Detail = Row & { items: OrderLine[]; history: (OrderTimelineEntry & { id: string })[] };

const isStatus = (s: string | null): s is OrderStatus => (ORDER_STATUSES as readonly string[]).includes(s ?? '');
const STOP = (e: React.MouseEvent) => e.stopPropagation();

export default function AdminOrdersPage() {
  const tc = useTranslations('admin.common');
  return <Suspense fallback={<p className="text-sm text-muted">{tc('loading')}</p>}><Orders /></Suspense>;
}

function Orders() {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const to = useTranslations('admin.orders');
  const locale = useLocale();
  const lang = useLang();
  const sp = useSearchParams();
  // Bosh sahifadagi "tasdiq kutayotgan" havolasi ?status=PENDING bilan keladi; noto'g'ri qiymat "hammasi" bo'lib qoladi
  // ?q= shikoyat qatoridan keladi: buyurtma raqami bilan to'g'ridan-to'g'ri ochilsin
  const [f, setF] = useState({ q: sp.get('q') ?? '', status: isStatus(sp.get('status')) ? sp.get('status')! : '', page: 1 });
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [open, setOpen] = useState<string | null>(null);
  const { data, pages, loading, err, reload } = useAdminList<Row>('/admin/orders', { ...f, limit: 30 });

  const cols: Col<Row>[] = [
    { key: 'no', head: to('no'), cell: (r) => <span className="font-mono font-bold">{r.no}</span> },
    { key: 'status', head: tc('status'), cell: (r) => <StatusPill status={r.status} /> },
    { key: 'terminal', head: to('terminal'), cell: (r) => <Link href={`/terminals/${r.terminal.slug}`} target="_blank" onClick={STOP} className="text-teal-ink underline">{r.terminal.name}</Link> },
    { key: 'shipper', head: to('shipper'), cell: (r) => (
      <Link href={`/admin/orgs?q=${encodeURIComponent(r.shipperOrg.name)}`} onClick={STOP} className="text-teal-ink underline">{r.shipperOrg.name}</Link>
    ) },
    // Ilgari bu yerda "LOAD / IMPORT" turardi: baza qiymatining o'zi, tarjimasiz
    { key: 'op', head: to('operation'), cell: (r) => `${to(`op.${r.operation}`)} / ${to(`dir.${r.direction}`)}` },
    { key: 'wagons', head: to('wagons'), num: true, cell: (r) => num(r.wagonCount, locale) },
    { key: 'total', head: to('total'), num: true, cell: (r) => som(r.totalTiyin, locale) },
    { key: 'created', head: tc('createdAt'), num: true, cell: (r) => uzDateTime(r.createdAt, locale) },
  ];

  return (
    <>
      <PageHead title={t('nav.orders')} lead={to('lead')} />
      <Toolbar onSubmit={() => setF({ ...f, q, page: 1 })}>
        <Labeled label={to('no')} className="w-40">
          <input value={q} onChange={(e) => setQ(e.target.value)} className={INPUT} />
        </Labeled>
        <Labeled label={tc('status')} className="w-48">
          <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value, page: 1 })} className={INPUT}>
            <option value="">{tc('all')}</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[lang][s]}</option>)}
          </select>
        </Labeled>
        <button type="submit" className={BTN}>{tc('apply')}</button>
        {data ? <span className="ml-auto font-mono text-xs text-muted">{tc('total', { count: data.total })}</span> : null}
      </Toolbar>

      {loading ? <p className="mt-4 text-sm text-muted">{tc('loading')}</p> : null}
      {err ? <Notice tone="err">{errText(err, t, t.has, tc('loadFailed'))}</Notice> : null}
      {data ? <DataTable cols={cols} rows={data.items} keyOf={(r) => r.no} empty={tc('empty')} onRow={(r) => setOpen(r.no)} /> : null}
      <Pager page={f.page} pages={pages} onPage={(p) => setF({ ...f, page: p })} />

      {open ? <OrderDrawer no={open} onClose={() => setOpen(null)} onChanged={reload} /> : null}
    </>
  );
}

/** Bitta buyurtma: faktlar, qatorlar, tarix va majburiy holat bloki. */
function OrderDrawer({ no, onClose, onChanged }: { no: string; onClose: () => void; onChanged: () => void }) {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const to = useTranslations('admin.orders');
  const ts = useTranslations('service');
  const tu = useTranslations('unit');
  const locale = useLocale();
  const lang = useLang();
  const [d, setD] = useState<Detail | null>(null);
  const [status, setStatus] = useState<OrderStatus>('PENDING');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(() => api<Detail>(`/admin/orders/${no}`).then((x) => { setD(x); setStatus(x.status); }).catch((e) => setMsg({ tone: 'err', text: errText(e, t, t.has, tc('loadFailed')) })), [no, t, tc]);
  useEffect(() => { void load(); }, [load]);

  // Yopuvchi holatlar uchun sabab majburiy: server ham shuni talab qiladi, lekin
  // operator tugmani bosmasdan oldin bilib tursin (aks holda faqat xato banneri chiqardi).
  const closing = status === 'CANCELLED' || status === 'REJECTED' || status === 'EXPIRED';
  const needReason = closing && !reason.trim();

  async function force() {
    setMsg(null);
    try {
      await post(`/admin/orders/${no}/status`, { status, reason: reason.trim() || undefined });
      setReason('');
      setMsg({ tone: 'ok', text: tc('saved') });
      await load();
      onChanged();
    } catch (e) { setMsg({ tone: 'err', text: errText(e, t, t.has, tc('saveFailed')) }); }
  }

  return (
    <Drawer open title={no} onClose={onClose}>
      {!d ? <p className="text-sm text-muted">{tc('loading')}</p> : (
        <div className="space-y-5 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 wrap-anywhere">
            <dt className="text-muted">{tc('status')}</dt><dd><StatusPill status={d.status} /></dd>
            <dt className="text-muted">{to('terminal')}</dt><dd><Link href={`/terminals/${d.terminal.slug}`} target="_blank" className="text-teal-ink underline">{d.terminal.name}</Link></dd>
            <dt className="text-muted">{to('shipper')}</dt><dd><Link href={`/admin/orgs?q=${encodeURIComponent(d.shipperOrg.name)}`} className="text-teal-ink underline">{d.shipperOrg.name}</Link></dd>
            <dt className="text-muted">{tc('createdAt')}</dt><dd className="font-mono tabular-nums">{uzDateTime(d.createdAt, locale)}</dd>
          </dl>

          <section>
            <h3 className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted">{to('items')}</h3>
            <table className="w-full">
              <tbody>
                {d.items.map((i) => (
                  <tr key={i.serviceCode} className="border-t border-line/70">
                    <td className="py-1.5 pr-3">{ts(i.serviceCode)}</td>
                    <td className="py-1.5 pr-3 font-mono text-xs tabular-nums text-muted">{num(i.qty, locale)} {tu(i.unit)}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums">{som(i.amountTiyin, locale)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-line font-semibold">
                  <td className="py-1.5" colSpan={2}>{to('total')}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{som(d.totalTiyin, locale)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted">{to('history')}</h3>
            <ul className="divide-y divide-line/70">
              {d.history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1.5">
                  <span className="font-semibold">{h.toStatus ? ORDER_STATUS_LABELS[lang][h.toStatus] : h.code}</span>
                  {h.actorRole ? <span className="font-mono text-[11px] text-muted">{h.actorRole}</span> : null}
                  <span className="ml-auto font-mono text-xs tabular-nums text-muted">{uzDateTime(h.at, locale)}</span>
                  {h.reason ? <span className="basis-full text-xs text-muted">{h.reason}</span> : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-card border border-line bg-white p-3">
            <h3 className="mb-2 font-semibold text-navy">{to('force')}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <Labeled label={tc('status')}>
                <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)} className={INPUT}>
                  {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[lang][s]}</option>)}
                </select>
              </Labeled>
              <Labeled label={closing ? `${to('reason')} *` : to('reason')}>
                <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} required={closing} className={INPUT} />
              </Labeled>
            </div>
            <p className="mt-2 text-xs text-amber-ink">{to('forceNote')}</p>
            <div className="mt-3">
              <ConfirmButton label={to('force')} confirm={tc('confirm')} onRun={force} className={BTN} disabled={needReason} />
            </div>
            {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
          </section>
        </div>
      )}
      {!d && msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
    </Drawer>
  );
}
