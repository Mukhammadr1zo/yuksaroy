'use client';
// Buyurtma tafsiloti: holat, muzlatilgan narx, tarix. Mijoz uchun yagona harakat: bekor qilish.
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ORDER_EVENT_LABELS, ORDER_STATUS_LABELS, type OrderEventCode, type OrderStatus } from '@yuksaroy/domain';
import { ApiError, api, post } from '@/lib/api';
import { num } from '@/lib/format';
import type { Order } from '@/lib/types';
import { useLang } from '@/components/kabinet/bits';
import { PriceLines, StatusPill, dateTime, slotLabel } from '@/components/order/bits';
import { SlaTimer } from '@/components/order/SlaTimer';
import { OrderReview } from '@/components/reviews/OrderReview';

type OrderDoc = { id: string; no: string; kindLabel: string };

export default function OrderPage() {
  const { no } = useParams<{ no: string }>();
  const locale = useLocale();
  const lang = useLang();
  const t = useTranslations('dashboard2.order');
  const tc = useTranslations('kabinet.common');
  const ts = useTranslations('service');
  const ta = useTranslations('a11y');
  const tdoc = useTranslations('dashboard2.docs');
  const [o, setOrder] = useState<Order | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [docs, setDocs] = useState<OrderDoc[]>([]);

  // 404 va server xatosi bir xil ko'rsatilardi: bron qilgan mijoz "buyurtma yo'q" deb o'ylardi
  const load = useCallback(() => api<Order>(`/orders/${no}`).then(setOrder).catch((e) => setErr(e instanceof ApiError && e.status === 404 ? t('notFound') : tc('loadFailed'))), [no, t, tc]);
  useEffect(() => { void load(); }, [load]);

  // Yakunlangan buyurtmada akt va hisob-faktura chiqariladi
  useEffect(() => {
    if (o?.status !== 'DONE') return;
    api<{ documents: OrderDoc[] }>(`/orders/${no}/documents`).then((r) => setDocs(r.documents)).catch(() => {});
  }, [o?.status, no]);

  // Tasdiq kutilayotgan buyurtma o'zi yangilanadi (terminal tasdiqlashi yoki SLA tugashi mumkin)
  useEffect(() => {
    if (o?.status !== 'PENDING') return;
    const timer = setInterval(() => void load(), 20_000);
    return () => clearInterval(timer);
  }, [o?.status, load]);

  async function cancel() {
    setBusy(true); setErr(null);
    try { setOrder(await post<Order>(`/orders/${no}/cancel`, { reason: reason.trim() || undefined })); setAsking(false); setReason(''); }
    catch (e) {
      const code = e instanceof ApiError ? e.body?.code : null;
      setErr(code === 'CANCEL_TOO_LATE' ? t('err.cancelTooLate') : code === 'TRANSITION_NOT_ALLOWED' ? t('err.cancelNotAllowed') : t('err.cancelFailed'));
    } finally { setBusy(false); }
  }

  if (err && !o) return <main className="mx-auto max-w-3xl px-6 py-16"><p className="text-muted">{err}</p><Link href="/dashboard/orders" className="mt-4 inline-block underline">{t('backToOrders')}</Link></main>;
  if (!o) return <main className="mx-auto max-w-3xl px-6 py-16 text-muted">{t('loading')}</main>;

  const cancellable = o.status === 'PENDING' || o.status === 'CONFIRMED';
  const entryLabel = (to: OrderStatus | null, code: string | null) =>
    (code && ORDER_EVENT_LABELS[lang][code as OrderEventCode]) || (to && ORDER_STATUS_LABELS[lang][to]) || code || t('updated');

  return (
    <main className="mx-auto max-w-4xl">
      <nav aria-label={ta('breadcrumb')} className="font-mono text-xs text-muted"><Link href="/dashboard/orders" className="hover:text-navy">{t('title')}</Link> / {o.no}</nav>

      <header className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold">{o.no}</h1>
        <StatusPill status={o.status} />
        {o.status === 'PENDING' && o.slaConfirmUntil ? (
          <span className="flex items-center gap-1.5 text-sm text-muted">{t('terminalConfirm')} <SlaTimer until={o.slaConfirmUntil} onExpire={load} /></span>
        ) : null}
      </header>
      <p className="mt-1 text-muted">{t(`statusHint.${o.status}`)}</p>

      {err ? <p role="alert" className="mt-4 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p> : null}

      <div className="mt-6 grid gap-5 md:grid-cols-[1.3fr_1fr] md:items-start">
        <section className="rounded-card border border-line bg-white p-6">
          <h2 className="text-lg font-bold">
            <Link href={`/terminals/${o.terminal.slug}`} className="hover:underline">{o.terminal.name}</Link>
          </h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row k={t('row.station')} v={o.station.name} />
            <Row k={t('row.operation')} v={ts(o.operation)} />
            <Row k={t('row.slot')} v={o.slot ? slotLabel(o.slot.startsAt, o.slot.endsAt, locale) : t('notSet')} />
            <Row k={t('row.cargo')} v={o.cargoName ?? t('notSpecified')} />
            <Row k={t('row.weight')} v={`${num(o.weightKg / 1000, locale)} t`} mono />
            <Row k={t('row.wagons')} v={String(o.wagonCount)} mono />
            {o.wagonNumbers.length ? <Row k={t('row.wagonNumbers')} v={o.wagonNumbers.join(', ')} mono /> : null}
            {o.storageDays ? <Row k={t('row.storage')} v={t('storageDays', { n: o.storageDays })} /> : null}
            <Row k={t('row.shipper')} v={o.shipper.name} />
          </dl>
          {o.note ? <p className="mt-4 rounded-xl bg-sand p-3 text-sm"><span className="text-muted">{t('noteLabel')} </span>{o.note}</p> : null}

          {cancellable ? (
            <div className="mt-6 border-t border-line pt-4">
              {asking ? (
                <div className="space-y-3">
                  <label className="block text-sm font-semibold">{t('cancel.reason')}
                    <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className="mt-1 w-full rounded-xl border border-line px-4 py-2.5 text-base font-normal" />
                  </label>
                  <div className="flex gap-2">
                    <button type="button" onClick={cancel} disabled={busy} className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">{t('cancel.yes')}</button>
                    <button type="button" onClick={() => setAsking(false)} className="rounded-full border border-line px-5 py-2 text-sm font-semibold hover:bg-sand">{t('cancel.no')}</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setAsking(true)} className="text-sm font-semibold text-red-700 underline">{t('cancel.start')}</button>
              )}
              <p className="mt-2 text-xs text-muted">{t('cancel.hint')}</p>
            </div>
          ) : null}

          {o.status === 'DONE' ? <div className="mt-6 border-t border-line pt-4"><OrderReview no={o.no} shipperOrgId={o.shipper.id} /></div> : null}
        </section>

        <aside className="space-y-5">
          <section className="rounded-card border border-line bg-white p-6">
            <h2 className="text-sm font-semibold text-muted">{t('priceTitle')}</h2>
            <div className="mt-2">
              <PriceLines items={o.items} subtotalTiyin={o.subtotalTiyin} commissionPct={o.commissionPct} commissionTiyin={o.commissionTiyin} commissionPayer={o.commissionPayer} totalTiyin={o.totalTiyin} />
            </div>
          </section>

          {docs.length ? (
            <section className="rounded-card border border-line bg-white p-6">
              <h2 className="text-sm font-semibold text-muted">{tdoc('title')}</h2>
              <ul className="mt-3 divide-y divide-line">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span><span className="font-semibold">{d.kindLabel}</span> <span className="font-mono text-xs text-muted">{d.no}</span></span>
                    {/* Rewrite orqali cookie bilan boradi: /api/v1/documents/:id/download */}
                    <a href={`/api/v1/documents/${d.id}/download`} target="_blank" rel="noopener" className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold transition hover:border-teal hover:bg-sand">{tdoc('pdf')}</a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="rounded-card border border-line bg-white p-6">
            <h2 className="text-sm font-semibold text-muted">{t('historyTitle')}</h2>
            <ol className="mt-3 space-y-3">
              {o.timeline.map((h, i) => (
                <li key={i} className="relative border-l-2 border-line pl-4">
                  <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-teal" />
                  <p className="text-sm font-semibold">{entryLabel(h.toStatus, h.code)}</p>
                  <p className="font-mono text-xs text-muted">{dateTime(h.at, locale)}{h.actorRole ? ` · ${t.has(`actor.${h.actorRole}`) ? t(`actor.${h.actorRole}`) : h.actorRole}` : ''}</p>
                  {h.reason ? <p className="mt-0.5 text-sm text-muted">{h.reason}</p> : null}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </main>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className={`text-right ${mono ? 'font-mono tabular-nums' : ''}`}>{v}</dd></div>;
}
