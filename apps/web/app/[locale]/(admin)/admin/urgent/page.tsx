'use client';
/**
 * Shoshilinch so'rovlar: teplovoz chaqirish, vagon ta'miri, kran.
 *
 * Nega kerak: bu platformadagi eng shoshilinch obyekt, ichida mijozning telefoni va
 * unga kelgan takliflar bor. API da ro'yxat, bitta so'rov va yopish allaqachon bor edi,
 * panelda esa ekran ham, menyuda band ham yo'q edi. Ya'ni operator qotib qolgan
 * so'rovni ko'ra ham, yopa ham olmasdi.
 *
 * Yopish sababi majburiy: so'rov egasiga bu ko'rinadi va keyin nega yopilgani so'raladi.
 */
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { REGIONS, URGENT_STATUSES, type UrgentStatus } from '@yuksaroy/domain';
import { api, post } from '@/lib/api';
import { num, som, uzDateTime } from '@/lib/format';
import {
  BTN_DANGER, BTN_GHOST, CARD, ConfirmButton, DataTable, Drawer, INPUT, Labeled, Notice,
  PageHead, Pager, Pill, Toolbar, errText, useAdminList, type Col,
} from '@/components/admin/kit';

type Row = {
  id: string; no: string; kind: string; status: string; regionCode: string;
  stationName: string | null; wagonCount: number | null; contactPhone: string;
  createdAt: string; offers: number;
};
type Offer = {
  id: string; providerOrgId: string | null; providerUserId: string;
  priceTiyin: number | null; etaMinutes: number | null; message: string | null;
  status: string; createdAt: string;
};
type Detail = Row & { description: string; lat: number | null; lng: number | null; awardedOfferId: string | null; offers: Offer[] };

const TONE: Record<string, 'ok' | 'warn' | 'bad' | 'neutral'> = {
  OPEN: 'warn', AWARDED: 'ok', CLOSED: 'neutral', CANCELLED: 'bad',
};

export default function AdminUrgentPage() {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const tu = useTranslations('admin.urgent');
  const ts = useTranslations('urgent.status');
  const tr = useTranslations('region');
  const locale = useLocale();

  // Bosh sahifadagi "Shoshilinch so'rov" kartochkasi ?status=OPEN bilan keladi: bosgan odam
  // ochiq so'rovlarni ko'rishni kutadi, yopilganlari aralashib turishini emas.
  // Suspense shart emas: AdminShell huquq tasdiqlanguncha bolalarni chizmaydi.
  const sp = useSearchParams();
  const [status, setStatus] = useState(URGENT_STATUSES.includes(sp.get('status') as never) ? (sp.get('status') as string) : '');
  const [region, setRegion] = useState('');
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<string | null>(null);

  const list = useAdminList<Row>('/admin/urgent', { status, region, page });

  const cols: Col<Row>[] = [
    { key: 'no', head: tu('no'), num: true, cell: (r) => <span className="font-semibold">{r.no}</span> },
    { key: 'kind', head: tu('kind'), cell: (r) => (tu.has(`kinds.${r.kind}`) ? tu(`kinds.${r.kind}`) : r.kind) },
    { key: 'status', head: tc('status'), cell: (r) => (
      <Pill tone={TONE[r.status] ?? 'neutral'}>{ts.has(r.status) ? ts(r.status) : r.status}</Pill>
    ) },
    { key: 'region', head: tc('region'), cell: (r) => (tr.has(r.regionCode) ? tr(r.regionCode) : r.regionCode) },
    { key: 'station', head: tu('station'), cell: (r) => r.stationName || <span className="text-muted">-</span> },
    { key: 'wagons', head: tu('wagons'), num: true, cell: (r) => (r.wagonCount != null ? num(r.wagonCount, locale) : '-') },
    { key: 'offers', head: tu('offers'), num: true, cell: (r) => num(r.offers, locale) },
    { key: 'phone', head: tu('phone'), cell: (r) => <a href={`tel:${r.contactPhone}`} className="font-mono text-teal-ink underline">{r.contactPhone}</a> },
    { key: 'createdAt', head: tc('createdAt'), num: true, cell: (r) => uzDateTime(r.createdAt, locale) },
  ];

  return (
    <>
      <PageHead title={t('nav.urgent')} lead={tu('lead')} />

      <Toolbar onSubmit={() => setPage(1)}>
        <Labeled label={tc('status')} className="w-48">
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={INPUT}>
            <option value="">{tc('all')}</option>
            {URGENT_STATUSES.map((s) => <option key={s} value={s}>{ts(s as UrgentStatus)}</option>)}
          </select>
        </Labeled>
        <Labeled label={tc('region')} className="w-56">
          <select value={region} onChange={(e) => { setRegion(e.target.value); setPage(1); }} className={INPUT}>
            <option value="">{tc('all')}</option>
            {REGIONS.map((r) => <option key={r} value={r}>{tr(r)}</option>)}
          </select>
        </Labeled>
        {list.data ? <span className="ml-auto font-mono text-xs text-muted">{tc('total', { count: list.data.total })}</span> : null}
      </Toolbar>

      {list.loading ? <p className="mt-4 text-sm text-muted">{tc('loading')}</p> : null}
      {list.err ? <Notice tone="err">{errText(list.err, t, t.has, tc('loadFailed'))}</Notice> : null}
      {list.data && !list.loading ? (
        <DataTable cols={cols} rows={list.data.items} keyOf={(r) => r.id} empty={tc('empty')} onRow={(r) => setSel(r.id)} />
      ) : null}
      <Pager page={page} pages={list.pages} onPage={setPage} />

      {sel ? <UrgentDrawer id={sel} onClose={() => setSel(null)} onChanged={() => void list.reload()} /> : null}
    </>
  );
}

/** Bitta so'rov: tavsifi, kelgan takliflar va yopish. */
function UrgentDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const tu = useTranslations('admin.urgent');
  const ts = useTranslations('urgent.status');
  const tr = useTranslations('region');
  const locale = useLocale();

  const [d, setD] = useState<Detail | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(() => api<Detail>(`/admin/urgent/${id}`)
    .then(setD)
    .catch((e) => setNote({ tone: 'err', text: errText(e, t, t.has, tc('loadFailed')) })), [id, t, tc]);
  useEffect(() => { void load(); }, [load]);

  async function close() {
    setNote(null);
    try {
      await post(`/admin/urgent/${id}/close`, { reason: reason.trim() });
      setNote({ tone: 'ok', text: tu('closed') });
      setReason('');
      await load();
      onChanged();
    } catch (e) { setNote({ tone: 'err', text: errText(e, t, t.has, tc('saveFailed')) }); }
  }

  const closable = d ? d.status === 'OPEN' || d.status === 'AWARDED' : false;

  return (
    <Drawer open title={d?.no ?? tc('loading')} onClose={onClose}>
      {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}
      {!d ? <p className="text-sm text-muted">{tc('loading')}</p> : (
        <div className="space-y-5">
          <dl className={`${CARD} grid grid-cols-2 gap-x-4 gap-y-2 p-3 text-sm wrap-anywhere`}>
            <Fact k={tu('kind')} v={tu.has(`kinds.${d.kind}`) ? tu(`kinds.${d.kind}`) : d.kind} />
            <Fact k={tc('status')} v={ts.has(d.status) ? ts(d.status) : d.status} />
            <Fact k={tc('region')} v={tr.has(d.regionCode) ? tr(d.regionCode) : d.regionCode} />
            <Fact k={tu('station')} v={d.stationName || '-'} />
            <Fact k={tu('wagons')} v={d.wagonCount != null ? num(d.wagonCount, locale) : '-'} />
            <Fact k={tu('phone')} v={d.contactPhone} mono />
            <Fact k={tc('createdAt')} v={uzDateTime(d.createdAt, locale)} mono />
          </dl>

          <section>
            <h3 className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted">{tu('description')}</h3>
            <p className={`${CARD} whitespace-pre-line p-3 text-sm wrap-anywhere`}>{d.description}</p>
          </section>

          <section>
            <h3 className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted">
              {tu('offers')} ({num(d.offers.length, locale)})
            </h3>
            {!d.offers.length ? <p className={`${CARD} border-dashed p-3 text-sm text-muted`}>{tu('noOffers')}</p> : (
              <ul className="space-y-2">
                {d.offers.map((o) => (
                  <li key={o.id} className={`${CARD} p-3 text-sm ${o.id === d.awardedOfferId ? 'border-teal' : ''}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono font-semibold tabular-nums">
                        {o.priceTiyin != null ? som(o.priceTiyin, locale) : tu('noPrice')}
                      </span>
                      <span className="flex items-center gap-2">
                        {o.etaMinutes != null ? <span className="font-mono text-xs text-muted">{tu('eta', { min: o.etaMinutes })}</span> : null}
                        {o.id === d.awardedOfferId ? <Pill tone="ok">{tu('awarded')}</Pill> : null}
                      </span>
                    </div>
                    {o.message ? <p className="mt-1 text-xs text-muted wrap-anywhere">{o.message}</p> : null}
                    <p className="mt-1 font-mono text-[11px] text-muted">{uzDateTime(o.createdAt, locale)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {closable ? (
            <section className={`${CARD} p-3`}>
              <h3 className="mb-2 font-semibold text-navy">{tu('close')}</h3>
              <Labeled label={`${tu('reason')} *`}>
                <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={INPUT} />
              </Labeled>
              <p className="mt-2 text-xs text-muted">{tu('closeNote')}</p>
              <div className="mt-3 flex gap-2">
                <ConfirmButton label={tu('close')} confirm={tc('confirm')} onRun={close} className={BTN_DANGER} disabled={!reason.trim()} />
                <button type="button" onClick={onClose} className={BTN_GHOST}>{tc('cancel')}</button>
              </div>
            </section>
          ) : null}
        </div>
      )}
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
