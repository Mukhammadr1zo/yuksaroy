'use client';
/**
 * Terminal obyekt sahifasi: ro'yxatdagi yon varaq o'rniga alohida manzil (havola ulashiladi,
 * paleta shu yerga olib keladi). Umumiy yorliqda to'liq forma (TerminalForm) va da'vo bloki,
 * Bog'liq da egasi, buyurtma va e'lonlari, Pul da tariflar va buyurtma sonlari, Tarix va Izohlar.
 * PATCH ga faqat o'zgargan kalitlar ketadi (diffBody), o'zgarish bo'lmasa Saqlash o'chiq.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { ClaimStatus, OrderStatus, ServiceCode, TariffUnit, TerminalStatus } from '@yuksaroy/domain';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiError, api } from '@/lib/api';
import { num, pricePer, serviceLabel, som, uzDate, uzDateTime } from '@/lib/format';
import type { ClaimFile, OwnerListing } from '@/lib/types-kabinet';
import { ListingStatusPill, useListingLabels } from '@/components/kabinet/bits';
import { StatusPill } from '@/components/order/bits';
import { MessageFiles } from '@/components/chat/Attachments';
import { BTN, BTN_GHOST, CARD, ConfirmButton, DataTable, Notice, Pill, errText, type Col } from '@/components/admin/kit';
import { useAdminMe } from '@/components/admin/context';
import { diffBody, fromRow, TerminalForm, type Draft, type TerminalFull } from '@/components/admin/TerminalForm';
import { Decide } from '@/components/admin/Decide';
import { Fact, FACTS, ObjectPage, RelatedTable, Section } from '@/components/admin/ObjectPage';
import { NotesTab } from '@/components/admin/NotesTab';
import { AuditFeed } from '@/components/admin/AuditFeed';

/** GET /admin/catalog/terminals/:id: pasport + da'vo dalili + oxirgi tariflar + qaror uchun sonlar. */
type Detail = TerminalFull & {
  claimedAt: string | null;
  claimEvidence: { note: string; files: ClaimFile[] } | null;
  notesCount: number;
  tariffs: TariffRow[];
  stats: { views30: number; openInquiries: number; orders: { done: number; doneTiyin: number; pending: number } };
};
type TariffRow = { id: string; serviceCode: ServiceCode; priceTiyin: number; unit: TariffUnit; createdAt: string };
/** GET /admin/orders qatorining shu yerda kerak qismi. */
type OrderRow = { no: string; status: OrderStatus; createdAt: string; totalTiyin: number; shipperOrg: { id: string; name: string } };
/** O'chirishda yo'qoladigan bog'liq qatorlar soni. */
type Impact = { tariffs: number; reviews: number; services: number; slots: number; inquiries?: number };

const PATH = '/admin/catalog/terminals';
const CLAIM_TONE: Record<ClaimStatus, 'ok' | 'warn' | 'bad' | 'neutral'> = { APPROVED: 'ok', PENDING: 'warn', REJECTED: 'bad', NONE: 'neutral' };
const STATUS_TONE: Record<TerminalStatus, 'ok' | 'warn' | 'neutral'> = { ACTIVE: 'ok', DRAFT: 'warn', HIDDEN: 'neutral' };

export default function TerminalPage() {
  const { id } = useParams<{ id: string }>();
  const to = useTranslations('admin.object');
  const ts = useTranslations('terminalsAdmin.status');
  const tcl = useTranslations('claimStatus');
  const tk = useTranslations('kind');
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<unknown>(null);
  /** Izohlar yorlig'idagi son: NotesTab yozgandan keyin tafsilotni qayta so'ramaymiz. */
  const [notes, setNotes] = useState<number | null>(null);
  /** Da'vogar tashkilot nomi: tafsilotda faqat id bor, nom bitta kichik so'rov bilan. */
  const [claimant, setClaimant] = useState<string | null>(null);

  // Qayta yuklashda eski tafsilot turadi (skelet chiqmaydi): saqlashdan keyin forma sakramasin
  const load = useCallback(() => { setErr(null); return api<Detail>(`${PATH}/${id}`).then(setD).catch(setErr); }, [id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!d?.claimOrgId) { setClaimant(null); return; }
    let alive = true;
    api<{ name: string }>(`/admin/orgs/${d.claimOrgId}`).then((o) => { if (alive) setClaimant(o.name); }).catch(() => {});
    return () => { alive = false; };
  }, [d?.claimOrgId]);

  const notFound = err instanceof ApiError && err.status === 404;
  const station = d ? d.station?.nameUz ?? d.stationNameRaw ?? '' : '';

  return (
    <ObjectPage
      entity="Terminal" id={id} back="/admin/terminals"
      title={d?.name ?? ''}
      subtitle={d ? [tk(d.kind), station].filter(Boolean).join(' / ') : undefined}
      pills={d ? (
        <>
          <Pill tone={STATUS_TONE[d.status]}>{ts(d.status)}</Pill>
          {d.claimStatus !== 'NONE' ? <Pill tone={CLAIM_TONE[d.claimStatus]}>{tcl(d.claimStatus)}</Pill> : null}
          {/* Qaror: talab bor, egasiga qo'ng'iroq; javobsiz yozishma: platforma javob berishi kerak */}
          {d.stats.views30 > 0 ? <Pill tone="ok">{to('stats.views30', { n: num(d.stats.views30) })}</Pill> : null}
          {d.stats.openInquiries > 0 ? <Pill tone="warn">{to('stats.openInquiries', { n: num(d.stats.openInquiries) })}</Pill> : null}
        </>
      ) : null}
      actions={d?.status === 'ACTIVE' ? <Link href={`/terminals/${d.slug}`} target="_blank" className={`${BTN_GHOST} px-3 py-1.5 text-xs`}>{to('onSite')}</Link> : null}
      loading={!d && !err} notFound={notFound} error={!notFound && err ? err : undefined} onRetry={() => void load()}
      tabs={d ? [
        { key: 'general', label: to('tabs.general'), render: () => <General d={d} claimant={claimant} reload={load} /> },
        { key: 'related', label: to('tabs.related'), render: () => <Related d={d} claimant={claimant} /> },
        { key: 'money', label: to('tabs.money'), render: () => <Money d={d} /> },
        { key: 'history', label: to('tabs.history'), render: () => <AuditFeed entity="Terminal" entityId={d.id} /> },
        { key: 'notes', label: to('tabs.notes'), count: notes ?? d.notesCount, render: () => <NotesTab entity="Terminal" entityId={d.id} onCount={setNotes} /> },
      ] : []}
    />
  );
}

/** Umumiy: da'vo bloki + forma + Saqlash / O'chirish (ega). */
function General({ d, claimant, reload }: { d: Detail; claimant: string | null; reload: () => Promise<void> }) {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const tt = useTranslations('admin.terminals');
  const to = useTranslations('admin.object');
  const tcl = useTranslations('claimStatus');
  const locale = useLocale();
  const router = useRouter();
  const { isOwner } = useAdminMe();

  const base = useMemo(() => fromRow(d), [d]);
  const [draft, setDraft] = useState<Draft>(base);
  // Qayta yuklangan qator formaga: saqlangan qiymat asos bo'ladi, dirty yo'qoladi
  useEffect(() => { setDraft(base); }, [base]);
  const body = diffBody(draft, base);
  const dirty = Object.keys(body).length > 0;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  /** O'chirishda nima yo'qolishi: server to'sganda to'ladi, remove() izohiga qara. */
  const [impact, setImpact] = useState<Impact | null>(null);

  const fail = (e: unknown, fb: string) => setNotice({ tone: 'err', text: errText(e, t, t.has, fb) });

  async function save() {
    if (!dirty) return;
    setBusy(true); setNotice(null);
    try {
      await api(`${PATH}/${d.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setNotice({ tone: 'ok', text: tc('saved') });
      await reload();
    } catch (e) { fail(e, tc('saveFailed')); } finally { setBusy(false); }
  }

  /*
   * Terminal o'chirilganda tarif tarixi, baholar, xizmatlar va slot kalendari birga
   * ketadi. Server bo'sh bo'lmagan terminalni birinchi urinishda rad etadi va nima
   * yo'qolishini sanab beradi; operator shuni ko'rib, ataylab ikkinchi marta tasdiqlaydi.
   * Ilgari ikki bosishlik oddiy tasdiq bilan hammasi jimgina yo'qolardi.
   */
  async function remove(force = false) {
    setNotice(null);
    try {
      await api(`${PATH}/${d.id}${force ? '?force=1' : ''}`, { method: 'DELETE' });
      router.push('/admin/terminals');
    } catch (e) {
      const b = e instanceof ApiError ? (e.body as (Impact & { code?: string }) | undefined) : undefined;
      if (b?.code === 'TERMINAL_HAS_DATA') { setImpact(b); return; }
      fail(e, tc('deleteFailed'));
    }
  }

  return (
    <div className="space-y-6">
      {d.claimStatus !== 'NONE' ? (
        <Section title={to('claim.title')}>
          <div className={`${CARD} p-4`}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Pill tone={CLAIM_TONE[d.claimStatus]}>{tcl(d.claimStatus)}</Pill>
              <span><span className="text-muted">{to('claim.claimant')}:</span>{' '}
                {d.claimOrgId ? <Link href={`/admin/orgs/${d.claimOrgId}`} className="font-semibold text-teal-ink hover:underline">{claimant ?? d.claimOrgId}</Link> : to('related.none')}
              </span>
              {d.claimedAt ? <span className="ml-auto font-mono text-xs text-muted">{uzDateTime(d.claimedAt, locale)}</span> : null}
            </div>
            {d.claimEvidence?.note ? <p className="mt-2 whitespace-pre-line break-words text-sm">{d.claimEvidence.note}</p> : null}
            {d.claimEvidence?.files?.length ? (<><p className="mt-2 text-xs text-muted">{to('claim.evidence')}</p><MessageFiles files={d.claimEvidence.files} mine={false} /></>) : null}
            {d.claimStatus === 'PENDING' ? <Decide path={`/terminals/${d.id}/claim/decide`} reasonKey="reason" requireReason onDone={() => void reload()} /> : null}
          </div>
        </Section>
      ) : null}

      <div className={`${CARD} p-4`}>
        <TerminalForm d={draft} set={(p) => setDraft((x) => ({ ...x, ...p }))} />
      </div>

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
      <div className="flex flex-wrap items-start gap-3">
        {/* O'zgarish bo'lmasa o'chiq: bosilardi-yu hech narsa bo'lmasdi, operator tugma ishlamayapti deb o'ylardi */}
        <button type="button" className={BTN} disabled={busy || !dirty} onClick={() => void save()}>{tc('save')}</button>
        {isOwner ? (
          <div className="ml-auto flex flex-col items-end gap-1">
            <span className="text-xs text-muted">{tt('deleteWarn')}</span>
            {impact ? (
              <span className="flex flex-wrap items-center justify-end gap-2">
                <span className="rounded-xl bg-red-50 px-3 py-1.5 text-xs text-red-700">
                  {tt('deleteImpact', { tariffs: impact.tariffs, reviews: impact.reviews, services: impact.services, slots: impact.slots, inquiries: impact.inquiries ?? 0 })}
                </span>
                <ConfirmButton label={tt('deleteAnyway')} confirm={tc('confirm')} onRun={() => remove(true)} />
              </span>
            ) : (
              <ConfirmButton label={tc('delete')} confirm={tc('confirm')} onRun={() => remove()} />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Bog'liq: egasi, da'vogar, stansiya, buyurtmalar, faol e'lonlar, baholar havolasi. */
function Related({ d, claimant }: { d: Detail; claimant: string | null }) {
  const tc = useTranslations('admin.common');
  const tt = useTranslations('admin.terminals');
  const to = useTranslations('admin.object');
  const tor = useTranslations('admin.orders');
  const tl = useTranslations('admin.listings');
  const locale = useLocale();
  const L = useListingLabels();

  const orderCols: Col<OrderRow>[] = [
    { key: 'no', head: tor('no'), cell: (r) => <span className="font-mono font-bold">{r.no}</span> },
    { key: 'status', head: tc('status'), cell: (r) => <StatusPill status={r.status} /> },
    { key: 'shipper', head: tor('shipper'), cell: (r) => r.shipperOrg.name },
    { key: 'total', head: tor('total'), num: true, cell: (r) => som(r.totalTiyin, locale) },
    { key: 'created', head: tc('createdAt'), num: true, cell: (r) => uzDateTime(r.createdAt, locale) },
  ];
  const listingCols: Col<OwnerListing>[] = [
    { key: 'title', head: tc('name'), cell: (l) => <span className="font-semibold">{l.title}</span> },
    { key: 'kind', head: tl('kind'), cell: (l) => L.kind[l.kind] },
    { key: 'status', head: tc('status'), cell: (l) => <ListingStatusPill status={l.status} /> },
    { key: 'created', head: tc('createdAt'), num: true, cell: (l) => uzDate(l.createdAt, locale) },
  ];

  return (
    <div className="space-y-6">
      <dl className={`${FACTS} sm:grid-cols-3`}>
        <Fact k={to('related.owner')} v={d.org ? <Link href={`/admin/orgs/${d.org.id}`} className="text-teal-ink hover:underline">{d.org.name}</Link> : <span className="text-muted">{tt('noOwner')}</span>} />
        <Fact k={to('related.claimant')} v={d.claimOrgId ? <Link href={`/admin/orgs/${d.claimOrgId}`} className="text-teal-ink hover:underline">{claimant ?? d.claimOrgId}</Link> : <span className="text-muted">{to('related.none')}</span>} />
        <Fact k={to('related.station')} v={d.station?.nameUz ?? d.stationNameRaw ?? <span className="text-muted">{to('related.none')}</span>} />
      </dl>
      <RelatedTable<OrderRow> title={to('related.orders')} path="/admin/orders" filters={{ terminalId: d.id }} cols={orderCols} keyOf={(r) => r.no}
        href={(r) => `/admin/orders?open=${r.no}`} all={`/admin/orders?terminalId=${d.id}`} />
      <RelatedTable<OwnerListing> title={to('related.listings')} path="/admin/listings" filters={{ terminalId: d.id, status: 'ACTIVE' }} cols={listingCols} keyOf={(l) => l.id}
        href={(l) => `/admin/listings/${l.id}`} all={`/admin/listings?terminalId=${d.id}&status=ACTIVE`} />
      <Link href={`/admin/reviews?terminalId=${d.id}`} className="inline-block text-sm font-semibold text-teal-ink hover:underline">{to('related.reviews')}</Link>
    </div>
  );
}

/** Pul: buyurtma sonlari (o'chirish yoki yashirish qarori, komissiya manbasi) va oxirgi tariflar (narx eskirganmi). */
function Money({ d }: { d: Detail }) {
  const tt = useTranslations('admin.terminals');
  const to = useTranslations('admin.object');
  const tc = useTranslations('admin.common');
  const tl = useTranslations('admin.listings');
  const locale = useLocale();
  const o = d.stats.orders;
  const cols: Col<TariffRow>[] = [
    { key: 'service', head: tc('name'), cell: (r) => serviceLabel(r.serviceCode) },
    { key: 'price', head: tl('price'), num: true, cell: (r) => pricePer(r.priceTiyin, r.unit, locale) },
    { key: 'created', head: tc('createdAt'), num: true, cell: (r) => uzDate(r.createdAt, locale) },
  ];
  return (
    <div className="space-y-6">
      <Section title={to('related.orders')}>
        <dl className={`${FACTS} sm:grid-cols-3`}>
          <Fact k={to('money.ordersDone')} v={num(o.done, locale)} mono />
          <Fact k={to('money.ordersDoneSum')} v={som(o.doneTiyin, locale)} mono />
          <Fact k={to('money.ordersPending')} v={num(o.pending, locale)} mono />
        </dl>
        {/* Qaror: buyurtmasi bor terminal o'chmaydi, yashiriladi */}
        <p className="mt-1 text-xs text-muted">{tt('deleteWarn')}</p>
      </Section>
      <Section title={to('money.tariffs')}>
        <DataTable cols={cols} rows={d.tariffs} keyOf={(r) => r.id} empty={to('money.none')} />
        <p className="mt-2 text-xs text-muted">{to('money.tariffHint')}</p>
      </Section>
    </div>
  );
}
