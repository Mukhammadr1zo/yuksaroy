'use client';
// Buyurtma tafsiloti: holat, faktlar, muzlatilgan narx, tarix, hujjatlar (brauzerda ochiladi), bekor qilish, DONE bo'lsa baho.
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ORDER_EVENT_LABELS, ORDER_STATUS_LABELS, type OrderEventCode, type OrderStatus } from '@yuksaroy/domain';
import { ApiError, api, post } from '@/lib/api';
import type { Order } from '@/lib/types';
import { PriceLines, StatusPill, dateTime, slotLabel } from '@/components/order/bits';
import { SlaTimer } from '@/components/order/SlaTimer';
import { OrderReview } from '@/components/reviews/OrderReview';
import { confirmTg, haptic, useTg } from '@/components/tg/TgProvider';
import { BTN_GHOST, CARD, Err, INPUT, Row, Skeleton, useLang } from '@/components/tg/bits';

type Docs = { documents: { id: string; no: string; kind: string; kindLabel: string; status: string }[]; invoice: { no: string; status: string; statusLabel: string; amountTiyin: number } | null };

export default function TgOrderPage() {
  const { no } = useParams<{ no: string }>();
  const lang = useLang();
  const t = useTranslations('tg.orders');
  const td = useTranslations('tg.orders.detail');
  const tb = useTranslations('tg.book');
  const tc = useTranslations('tg.common');
  const { tg } = useTg();
  const [o, setOrder] = useState<Order | null>(null);
  const [docs, setDocs] = useState<Docs | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');

  const load = useCallback(() => api<Order>(`/orders/${no}`).then(setOrder).catch((e) => setErr(e instanceof ApiError && e.status === 404 ? t('notFound') : tc('failed'))), [no, t, tc]);
  useEffect(() => { void load(); api<Docs>(`/orders/${no}/documents`).then(setDocs).catch(() => setDocs({ documents: [], invoice: null })); }, [load, no]);
  useEffect(() => {
    if (o?.status !== 'PENDING') return;
    const i = setInterval(() => void load(), 20_000);
    return () => clearInterval(i);
  }, [o?.status, load]);

  async function cancel() {
    if (!(await confirmTg(tg, td('cancelConfirm')))) return;
    setBusy(true); setErr(null);
    try { setOrder(await post<Order>(`/orders/${no}/cancel`, { reason: reason.trim() || undefined })); setAsking(false); haptic('medium'); }
    catch (e) { const code = e instanceof ApiError ? String(e.body?.code ?? '') : ''; setErr(code && td.has(`err.${code}`) ? td(`err.${code}`) : tc('failed')); }
    finally { setBusy(false); }
  }
  // Hujjat tashqi brauzerda ochiladi: u yerda sessiya yo'q, shuning uchun qisqa muddatli imzolangan havola olinadi
  async function openDoc(id: string) {
    setErr(null);
    try {
      const { url } = await api<{ url: string; expiresAt: string }>(`/documents/${id}/download-link`);
      haptic();
      if (tg) tg.openLink(url); else window.open(url, '_blank', 'noopener');
    } catch { setErr(tc('failed')); }
  }

  if (err && !o) return <main className="mx-auto max-w-md px-4 py-10 text-center text-sm text-muted">{err}</main>;
  if (!o) return <main className="mx-auto max-w-md px-4 pt-4"><Skeleton /></main>;
  const cancellable = o.status === 'PENDING' || o.status === 'CONFIRMED';

  return (
    <main className="mx-auto max-w-md px-4 pb-8 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-xl font-bold">{o.no}</h1>
        <StatusPill status={o.status} />
        {o.status === 'PENDING' && o.slaConfirmUntil ? <SlaTimer until={o.slaConfirmUntil} onExpire={load} /> : null}
      </div>
      <p className="mt-1 text-sm text-muted">{td(`hint.${o.status}`)}</p>
      {err ? <div className="mt-3"><Err>{err}</Err></div> : null}

      <section className={`${CARD} mt-4 p-4`}>
        <h2 className="break-words font-bold">{o.terminal.name}</h2>
        <dl className="mt-2">
          <Row k={td('station')} v={o.station.name} />
          <Row k={td('operation')} v={tb(o.operation)} />
          <Row k={td('slot')} v={o.slot ? slotLabel(o.slot.startsAt, o.slot.endsAt) : td('noSlot')} />
          <Row k={td('cargo')} v={o.cargoName ?? t('noCargo')} />
          <Row k={td('weight')} v={`${(o.weightKg / 1000).toLocaleString('ru-RU')} t`} mono />
          <Row k={td('wagons')} v={String(o.wagonCount)} mono />
          {o.wagonNumbers.length ? <Row k={td('wagonNumbers')} v={o.wagonNumbers.join(', ')} mono /> : null}
          {o.storageDays ? <Row k={td('storage')} v={td('days', { count: o.storageDays })} /> : null}
          <Row k={td('shipper')} v={o.shipper.name} />
        </dl>
        {o.note ? <p className="mt-2 rounded-xl bg-sand p-3 text-sm"><span className="text-muted">{td('note')}: </span>{o.note}</p> : null}
      </section>

      <section className={`${CARD} mt-3 p-4`}>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{td('price')}</h2>
        <div className="mt-1"><PriceLines items={o.items} subtotalTiyin={o.subtotalTiyin} commissionPct={o.commissionPct} commissionTiyin={o.commissionTiyin} commissionPayer={o.commissionPayer} totalTiyin={o.totalTiyin} /></div>
      </section>

      <section className={`${CARD} mt-3 p-4`}>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{td('documents')}</h2>
        {!docs ? <Skeleton n={1} h="h-10" /> : docs.documents.length === 0 ? <p className="mt-1 text-sm text-muted">{td('noDocs')}</p> : (
          <ul className="mt-2 divide-y divide-line">
            {docs.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span><span className="font-semibold">{d.kindLabel}</span> <span className="font-mono text-xs text-muted">{d.no}</span></span>
                <button type="button" onClick={() => openDoc(d.id)} className="min-h-10 rounded-full border border-line px-3 text-xs font-semibold">{td('openDoc')}</button>
              </li>
            ))}
          </ul>
        )}
        {docs?.invoice ? <p className="mt-2 font-mono text-xs text-muted">{td('invoice', { no: docs.invoice.no })} · {docs.invoice.statusLabel}</p> : null}
        {docs?.documents.length ? <p className="mt-1 text-[11px] text-muted">{td('docHint')}</p> : null}
      </section>

      <section className={`${CARD} mt-3 p-4`}>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{td('timeline')}</h2>
        <ol className="mt-3 space-y-3">
          {o.timeline.map((h, i) => (
            <li key={i} className="relative border-l-2 border-line pl-4">
              <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-teal" />
              <p className="text-sm font-semibold">{(h.code && ORDER_EVENT_LABELS[lang][h.code as OrderEventCode]) || (h.toStatus && ORDER_STATUS_LABELS[lang][h.toStatus as OrderStatus]) || h.code}</p>
              <p className="font-mono text-xs text-muted">{dateTime(h.at)}{h.actorRole && td.has(`actor.${h.actorRole}`) ? ` · ${td(`actor.${h.actorRole}`)}` : ''}</p>
              {h.reason ? <p className="mt-0.5 text-sm text-muted">{h.reason}</p> : null}
            </li>
          ))}
        </ol>
      </section>

      {cancellable ? (
        <section className="mt-4">
          {asking ? (
            <div className="space-y-2">
              <label className="block text-sm font-semibold">{td('cancelReason')}<input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={`${INPUT} mt-1 font-normal`} /></label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={cancel} disabled={busy} className="min-h-11 rounded-full bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-60">{td('cancelYes')}</button>
                <button type="button" onClick={() => setAsking(false)} className={BTN_GHOST}>{td('cancelNo')}</button>
              </div>
            </div>
          ) : <button type="button" onClick={() => setAsking(true)} className={`${BTN_GHOST} text-red-700`}>{td('cancel')}</button>}
          <p className="mt-2 text-xs text-muted">{td('cancelNote')}</p>
        </section>
      ) : null}
      {o.status === 'DONE' ? <section className={`${CARD} mt-4 p-4`}><OrderReview no={o.no} shipperOrgId={o.shipper.id} /></section> : null}
    </main>
  );
}
