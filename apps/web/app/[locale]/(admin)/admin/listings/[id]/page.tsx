'use client';
/**
 * E'lon obyekt sahifasi. Tahrir YO'Q: matn egasiniki, u kabinetida tuzatadi. Bu yerda faqat
 * qaror: tekshiruvdagi e'lonni tasdiqlash yoki rad etish (Decide), faol e'lonni sabab bilan
 * tortib olish. Sabab egasiga ko'rinadi va auditga yoziladi.
 * Bog'liq da egasi, terminal va shikoyatlar; Pul da Premium to'lovlari (to'lagan e'lonni
 * tortib olishda pul qaytarish savoli); Tarix va Izohlar.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { REPORT_REASON_LABELS, REPORT_STATUS_LABELS } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { ApiError, api, post } from '@/lib/api';
import { num, som, uzDate, uzDateTime } from '@/lib/format';
import { listingHref, type OwnerListing } from '@/lib/types-kabinet';
import type { AdminReport } from '@/lib/types-trust';
import { phoneDisplay } from '@/components/ui/fields';
import { ListingStatusPill, useLang, useListingLabels } from '@/components/kabinet/bits';
import { BTN_DANGER, BTN_GHOST, CARD, ConfirmButton, DataTable, INPUT, Labeled, Notice, Pill, errText, type Col } from '@/components/admin/kit';
import { Decide } from '@/components/admin/Decide';
import { Fact, FACTS, ObjectPage, RelatedTable, Section } from '@/components/admin/ObjectPage';
import { NotesTab } from '@/components/admin/NotesTab';
import { AuditFeed } from '@/components/admin/AuditFeed';

/** GET /admin/listings/:id: egasi ko'rinishi + qaror uchun sonlar + Premium to'lovlari. */
type Detail = OwnerListing & {
  inquiries: number; reports: number; notesCount: number;
  premiumOrders: { id: string; months: number; amountTiyin: number; status: string; paidAt: string | null; createdAt: string }[];
};

const PATH = '/admin/listings';
const payTone = (s: string) => (s === 'PAID' ? 'ok' : s === 'PENDING' ? 'warn' : 'neutral');

export default function ListingPage() {
  const { id } = useParams<{ id: string }>();
  const to = useTranslations('admin.object');
  const tl = useTranslations('admin.listings');
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [notes, setNotes] = useState<number | null>(null);
  const L = useListingLabels();

  const load = useCallback(() => { setErr(null); return api<Detail>(`${PATH}/${id}`).then(setD).catch(setErr); }, [id]);
  useEffect(() => { void load(); }, [load]);
  const notFound = err instanceof ApiError && err.status === 404;

  return (
    <ObjectPage
      entity="Listing" id={id} back="/admin/listings"
      title={d?.title ?? ''}
      subtitle={d ? `${L.kind[d.kind]} / ${d.owner.name}` : undefined}
      pills={d ? (
        <>
          <ListingStatusPill status={d.status} />
          {d.isDemo ? <Pill tone="warn">{tl('demo')}</Pill> : null}
          {/* Qaror: yozishma bor = talab bor; shikoyat + Premium bir joyda = firibgarlik belgisi */}
          {d.inquiries > 0 ? <Pill tone="ok">{to('stats.inquiries', { n: num(d.inquiries) })}</Pill> : null}
          {d.reports > 0 ? <Pill tone="bad">{to('stats.reports', { n: num(d.reports) })}</Pill> : null}
        </>
      ) : null}
      actions={d?.status === 'ACTIVE' ? <Link href={listingHref(d)} target="_blank" className={`${BTN_GHOST} px-3 py-1.5 text-xs`}>{to('onSite')}</Link> : null}
      loading={!d && !err} notFound={notFound} error={!notFound && err ? err : undefined} onRetry={() => void load()}
      tabs={d ? [
        { key: 'general', label: to('tabs.general'), render: () => <General d={d} reload={load} /> },
        { key: 'related', label: to('tabs.related'), count: d.reports, render: () => <Related d={d} /> },
        { key: 'money', label: to('tabs.money'), count: d.premiumOrders.length, render: () => <Money d={d} /> },
        { key: 'history', label: to('tabs.history'), render: () => <AuditFeed entity="Listing" entityId={d.id} /> },
        { key: 'notes', label: to('tabs.notes'), count: notes ?? d.notesCount, render: () => <NotesTab entity="Listing" entityId={d.id} onCount={setNotes} /> },
      ] : []}
    />
  );
}

/** Umumiy: o'qish maydonlari, suratlar, qaror (Decide yoki tortib olish). */
function General({ d, reload }: { d: Detail; reload: () => Promise<void> }) {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const to = useTranslations('admin.object');
  const tl = useTranslations('admin.listings');
  const tld = useTranslations('listing');
  const tk = useTranslations('kabinet');
  const ta = useTranslations('a11y');
  const tr = useTranslations('region');
  const locale = useLocale();
  const L = useListingLabels();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  /** Faol e'lonni tortib olish: decide approve=false, sabab majburiy (egasiga ko'rinadi). */
  async function withdraw() {
    setNote(null);
    try {
      await post(`${PATH}/${d.id}/decide`, { approve: false, reason: reason.trim() });
      setReason('');
      await reload();
    } catch (e) { setNote({ tone: 'err', text: errText(e, t, t.has, t('failed')) }); }
  }

  const price = d.priceTiyin != null
    ? `${som(d.priceTiyin, locale)}${d.priceUnit ? ` / ${L.priceUnit[d.priceUnit]}` : ''}`
    : t('listing.onRequest');
  const owner = d.orgId
    ? <Link href={`/admin/orgs/${d.orgId}`} className="text-teal-ink hover:underline">{d.owner.name}</Link>
    : d.ownerUserId ? <Link href={`/admin/users/${d.ownerUserId}`} className="text-teal-ink hover:underline">{d.owner.name}</Link> : d.owner.name;

  return (
    <div className="space-y-6">
      {/* Tahrir yo'q: matn egasiniki, panel faqat qaror qiladi (i18n object.listing.noEdit) */}
      <p className="text-xs text-muted">{to('listing.noEdit')}</p>

      <dl className={`${FACTS} sm:grid-cols-3`}>
        {/* Bitim turi (ijara/sotuv) tur yonida: alohida yorliq kaliti yo'q, ikkalasi bir gap */}
        <Fact k={tl('kind')} v={`${L.kind[d.kind]}${d.deal ? ` / ${tld.has(`deal.${d.deal}`) ? tld(`deal.${d.deal}`) : d.deal}` : ''}`} />
        <Fact k={tc('region')} v={tr.has(d.regionCode) ? tr(d.regionCode) : d.regionCode} />
        <Fact k={tl('price')} v={price} mono />
        <Fact k={tl('owner')} v={owner} />
        <Fact k={t('listing.contact')} v={d.contactPhone ? phoneDisplay(d.contactPhone) : <span className="text-muted">{tc('none')}</span>} mono />
        <Fact k={to('related.terminals')} v={d.object ? <Link href={`/admin/terminals/${d.object.id}`} className="text-teal-ink hover:underline">{d.object.name}</Link> : <span className="text-muted">{tc('none')}</span>} />
        <Fact k={t('listing.created')} v={uzDateTime(d.createdAt, locale)} mono />
        {d.publishedAt ? <Fact k={tld('detail.published')} v={uzDateTime(d.publishedAt, locale)} mono /> : null}
        {d.expiresAt ? <Fact k={tk('listings.expires')} v={uzDate(d.expiresAt, locale)} mono /> : null}
        <Fact k={to('money.premium')} v={d.premiumUntil ? to('listing.premiumUntil', { date: uzDate(d.premiumUntil, locale) }) : <span className="text-muted">{to('listing.noPremium')}</span>} mono />
      </dl>

      {d.rejectReason ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"><span className="font-semibold">{t('reason')}:</span> {d.rejectReason}</p> : null}

      {d.photos.length ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {/* Surat nomi e'lon nomidan: har surat alohida havola, nomsiz havola manzil bilan o'qilardi */}
          {d.photos.map((p, i) => {
            const alt = ta('photoOf', { name: d.title });
            // eslint-disable-next-line @next/next/no-img-element
            return <a key={p} href={p} target="_blank" rel="noopener noreferrer" className="shrink-0"><img src={p} alt={d.photos.length > 1 ? `${alt} (${i + 1}/${d.photos.length})` : alt} className="h-28 w-40 rounded-xl border border-line object-cover" /></a>;
          })}
        </div>
      ) : null}
      {d.description ? <p className={`${CARD} whitespace-pre-line break-words p-4 text-sm`}>{d.description}</p> : null}

      {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}
      {d.status === 'PENDING_REVIEW' ? (
        <div className={`${CARD} p-4`}>
          <Decide path={`${PATH}/${d.id}/decide`} reasonKey="reason" requireReason onDone={() => void reload()} />
        </div>
      ) : null}
      {d.status === 'ACTIVE' ? (
        <div className={`${CARD} p-4`}>
          <Labeled label={t('reason')} className="sm:max-w-md">
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className={INPUT} />
          </Labeled>
          {!reason.trim() ? <p className="mt-1 text-[11px] text-muted">{t('reasonRequired')}</p> : null}
          <div className="mt-3">
            {/* Sabab yozilmaguncha tugma o'chiq: sababsiz tortib olingan e'lonning egasi nima bo'lganini bilmaydi */}
            <ConfirmButton label={to('listing.withdraw')} confirm={t('confirmReject')} onRun={withdraw} className={BTN_DANGER} disabled={!reason.trim()} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Bog'liq: egasi, terminal, shikoyatlar (mini ro'yxat), e'lon izohlari havolasi. */
function Related({ d }: { d: Detail }) {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const to = useTranslations('admin.object');
  const tl = useTranslations('admin.listings');
  const lang = useLang();
  const locale = useLocale();

  const reportCols: Col<AdminReport>[] = [
    { key: 'reason', head: t('reason'), cell: (r) => <><div className="font-semibold">{REPORT_REASON_LABELS[lang][r.reason]}</div>{r.text ? <div className="text-xs text-muted">{r.text}</div> : null}</> },
    { key: 'status', head: tc('status'), cell: (r) => <Pill tone={r.status === 'NEW' ? 'warn' : r.status === 'RESOLVED' ? 'ok' : 'neutral'}>{REPORT_STATUS_LABELS[lang][r.status]}</Pill> },
    { key: 'reporter', head: t('reports.reporter'), cell: (r) => <Link href={`/admin/users/${r.reporterId}`} className="text-teal-ink hover:underline">{r.reporter?.fullName || (r.reporter?.phone ? phoneDisplay(r.reporter.phone) : r.reporterId)}</Link> },
    { key: 'created', head: tc('createdAt'), num: true, cell: (r) => uzDateTime(r.createdAt, locale) },
  ];

  return (
    <div className="space-y-6">
      <dl className={FACTS}>
        <Fact k={tl('owner')} v={d.orgId
          ? <Link href={`/admin/orgs/${d.orgId}`} className="text-teal-ink hover:underline">{d.owner.name}</Link>
          : d.ownerUserId ? <Link href={`/admin/users/${d.ownerUserId}`} className="text-teal-ink hover:underline">{d.owner.name}</Link> : d.owner.name} />
        <Fact k={to('related.terminals')} v={d.object ? <Link href={`/admin/terminals/${d.object.id}`} className="text-teal-ink hover:underline">{d.object.name}</Link> : <span className="text-muted">{to('related.none')}</span>} />
      </dl>
      <RelatedTable<AdminReport> title={to('related.reports')} path="/admin/reports" filters={{ targetKind: 'listing', targetId: d.id }} cols={reportCols} keyOf={(r) => r.id}
        all="/admin/moderation?tab=reports" />
      <Link href={`/admin/reviews?listingId=${d.id}`} className="inline-block text-sm font-semibold text-teal-ink hover:underline">{to('related.reviews')}</Link>
    </div>
  );
}

/** Pul: Premium to'lovlari. Qaror: to'lagan e'lonni tortib olishda pul qaytarish savoli. */
function Money({ d }: { d: Detail }) {
  const tc = useTranslations('admin.common');
  const to = useTranslations('admin.object');
  const ts = useTranslations('admin.subs');
  const tp = useTranslations('premium.admin');
  const locale = useLocale();
  const cols: Col<Detail['premiumOrders'][number]>[] = [
    { key: 'months', head: ts('months'), num: true, cell: (r) => num(r.months, locale) },
    { key: 'amount', head: ts('amount'), num: true, cell: (r) => som(r.amountTiyin, locale) },
    { key: 'status', head: tc('status'), cell: (r) => <Pill tone={payTone(r.status)}>{tp.has(`status.${r.status}`) ? tp(`status.${r.status}`) : r.status}</Pill> },
    { key: 'paidAt', head: ts('paidAt'), num: true, cell: (r) => (r.paidAt ? uzDateTime(r.paidAt, locale) : '') },
    { key: 'created', head: ts('createdAt'), num: true, cell: (r) => uzDateTime(r.createdAt, locale) },
  ];
  return (
    <Section title={to('money.premium')} count={d.premiumOrders.length}>
      {/* Son yonida qaror matni: to'lov bor bo'lsa tortib olish pul qaytarish savoliga aylanadi */}
      <p className="mb-2 text-xs text-muted">{to('money.premiumHint')}</p>
      <DataTable cols={cols} rows={d.premiumOrders} keyOf={(r) => r.id} empty={to('money.none')} />
    </Section>
  );
}
