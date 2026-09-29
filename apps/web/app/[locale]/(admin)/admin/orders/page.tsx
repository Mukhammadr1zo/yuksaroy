'use client';
// Admin: hamma buyurtmalar. Qotib qolgan buyurtmani (terminal javob bermadi, sweeper o'tkazib yubordi)
// o'tish qoidalarini chetlab holatga majburan qo'yish faqat shu yerda; sabab buyurtma tarixiga tushadi.
// Filtr, tartib va ochiq varaq (?open=<no>) URL da: shikoyat qatori va paleta ?q= bilan keladi,
// tashkilot va terminal sahifalari ?orgId= / ?terminalId= bilan.
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { api, post } from '@/lib/api';
import { num, som, uzDateTime } from '@/lib/format';
import type { OrderLine, OrderTimelineEntry } from '@/lib/types';
import { StatusPill } from '@/components/order/bits';
import { useLang } from '@/components/kabinet/bits';
import {
  BTN, BTN_GHOST, ConfirmButton, DataTable, Drawer, ExportLink, INPUT, Labeled, LoadError, Notice, PageHead, Pager, Toolbar, errText,
  useAdminList, useListQuery, type Col, type SortDir,
} from '@/components/admin/kit';
import { AssignTask, type Task } from '@/components/admin/AssignTask';

/** GET /admin/orders qatori; pul maydonlari serverda Number ga o'tkazilgan. */
type Row = {
  no: string; status: OrderStatus; createdAt: string; operation: string; direction: string; wagonCount: number; totalTiyin: number;
  terminal: { id: string; name: string; slug: string }; shipperOrg: { id: string; name: string };
};
/** GET /admin/orders/:no: qatorlar va tarix (yangisi yuqorida); id vazifa uchun (vazifa obyekt id si bilan, no bilan emas). */
type Detail = Row & { id: string; items: OrderLine[]; history: (OrderTimelineEntry & { id: string })[] };

const isStatus = (s: string): s is OrderStatus => (ORDER_STATUSES as readonly string[]).includes(s);
const F0 = { q: '', status: '', terminalId: '', orgId: '', sort: '', dir: '', page: 1, open: '' };
const PATH = '/admin/orders';
const LIMIT = 30;

export default function AdminOrdersPage() {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const to = useTranslations('admin.orders');
  const tb = useTranslations('admin.table');
  const locale = useLocale();
  const lang = useLang();

  const { f, set, reset } = useListQuery(F0);
  // Bosh sahifadagi "tasdiq kutayotgan" havolasi ?status=PENDING bilan keladi; noto'g'ri qiymat "hammasi" bo'lib qoladi
  const filters = { ...f, status: isStatus(f.status) ? f.status : '', open: undefined };
  const { data, pages, loading, err, reload } = useAdminList<Row>(PATH, { ...filters, limit: LIMIT });
  const [q, setQ] = useState(f.q);
  useEffect(() => setQ(f.q), [f.q]);

  // Varaq URL da: page ham patch da, aks holda ochish sahifani 1 ga qaytarardi
  const open = (no: string) => set({ open: no, page: f.page }, 'replace');
  const close = useCallback(() => set({ open: '', page: f.page }, 'replace'), [set, f.page]);

  const cols: Col<Row>[] = [
    { key: 'no', head: to('no'), sort: 'no', cell: (r) => <span className="font-mono font-bold">{r.no}</span> },
    { key: 'status', head: tc('status'), sort: 'status', cell: (r) => <StatusPill status={r.status} /> },
    // Terminal va yuk egasi panel ichidagi obyekt sahifasiga: sayt havolasi qator menyusida
    { key: 'terminal', head: to('terminal'), cell: (r) => <Link href={`/admin/terminals/${r.terminal.id}`} className="text-teal-ink underline">{r.terminal.name}</Link> },
    { key: 'shipper', head: to('shipper'), cell: (r) => <Link href={`/admin/orgs/${r.shipperOrg.id}`} className="text-teal-ink underline">{r.shipperOrg.name}</Link> },
    // Ilgari bu yerda "LOAD / IMPORT" turardi: baza qiymatining o'zi, tarjimasiz
    { key: 'op', head: to('operation'), cell: (r) => `${to(`op.${r.operation}`)} / ${to(`dir.${r.direction}`)}` },
    { key: 'wagons', head: to('wagons'), num: true, cell: (r) => num(r.wagonCount, locale) },
    { key: 'total', head: to('total'), num: true, sort: 'totalTiyin', cell: (r) => som(r.totalTiyin, locale) },
    { key: 'created', head: tc('createdAt'), num: true, sort: 'createdAt', cell: (r) => uzDateTime(r.createdAt, locale) },
  ];

  return (
    <>
      <PageHead title={t('nav.orders')} lead={to('lead')}>
        <ExportLink path={PATH} filters={filters} total={data?.total ?? 0} />
      </PageHead>
      <Toolbar onSubmit={() => set({ q: q.trim() })}>
        <Labeled label={to('no')} className="w-40">
          <input data-search="1" value={q} onChange={(e) => setQ(e.target.value)} className={INPUT} />
        </Labeled>
        <Labeled label={tc('status')} className="w-48">
          <select value={filters.status} onChange={(e) => set({ status: e.target.value })} className={INPUT}>
            <option value="">{tc('all')}</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[lang][s]}</option>)}
          </select>
        </Labeled>
        <button type="submit" className={BTN}>{tc('apply')}</button>
        <button type="button" className={BTN_GHOST} onClick={reset}>{tc('reset')}</button>
        {data ? <span className="ml-auto font-mono text-xs text-muted">{tc('total', { count: data.total })}</span> : null}
      </Toolbar>

      {err ? <LoadError err={err} onRetry={reload} /> : null}
      <DataTable
        cols={cols} rows={data?.items ?? []} keyOf={(r) => r.no} empty={tc('empty')} loading={loading} screen="orders"
        onReset={reset} onRow={(r) => open(r.no)}
        sort={f.sort ? { field: f.sort, dir: (f.dir === 'desc' ? 'desc' : 'asc') as SortDir } : undefined}
        onSort={(field, dir) => set({ sort: field, dir })}
        rowMenu={(r) => [
          { label: tb('open'), onSelect: () => open(r.no) },
          { label: tb('onSite'), href: `/terminals/${r.terminal.slug}` },
        ]}
      />
      <Pager page={f.page} pages={pages} onPage={(p) => set({ page: p })} />

      {f.open ? <OrderDrawer no={f.open} onClose={close} onChanged={reload} /> : null}
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
  const [task, setTask] = useState<Task | null>(null);

  const load = useCallback(() => api<Detail>(`/admin/orders/${no}`).then((x) => { setD(x); setStatus(x.status); }).catch((e) => setMsg({ tone: 'err', text: errText(e, t, t.has, tc('loadFailed')) })), [no, t, tc]);
  useEffect(() => { void load(); }, [load]);
  // Vazifa faqat tasdiq kutayotgan buyurtmada (navbat shu); yiqilsa jim, biriktirish tugmasi baribir chiziladi
  const id = d?.status === 'PENDING' ? d.id : null;
  const loadTask = useCallback(() => {
    if (id) void api<{ items: Task[] }>(`/admin/tasks?entity=Order&entityId=${id}&open=1&limit=1`).then((r) => setTask(r.items[0] ?? null)).catch(() => {});
  }, [id]);
  useEffect(() => { loadTask(); }, [loadTask]);

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
          {/* AssignTask Fragment qaytaradi, forma keyingi qatorga tushishi uchun ota flex-wrap */}
          {id ? <div className="flex flex-wrap items-center gap-3"><AssignTask entity="Order" entityId={id} task={task} onChanged={loadTask} /></div> : null}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 wrap-anywhere">
            <dt className="text-muted">{tc('status')}</dt><dd><StatusPill status={d.status} /></dd>
            <dt className="text-muted">{to('terminal')}</dt><dd><Link href={`/admin/terminals/${d.terminal.id}`} className="text-teal-ink underline">{d.terminal.name}</Link></dd>
            <dt className="text-muted">{to('shipper')}</dt><dd><Link href={`/admin/orgs/${d.shipperOrg.id}`} className="text-teal-ink underline">{d.shipperOrg.name}</Link></dd>
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
