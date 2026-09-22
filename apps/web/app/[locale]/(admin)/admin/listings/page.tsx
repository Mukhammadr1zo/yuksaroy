'use client';
// Admin: hamma e'lonlar, holati bo'yicha. Moderatsiya navbati alohida; bu yerda admin faol e'lonni
// sabab bilan tortib oladi. Qidiruv va sahifalash serverda: ilgari endpoint 200 tagacha massiv
// qaytarardi va undan keyingi e'longa yetib borib bo'lmasdi.
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LISTING_STATUSES, type ListingStatus } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { api, post } from '@/lib/api';
import { som } from '@/lib/format';
import { listingHref, type OwnerListing } from '@/lib/types-kabinet';
import { ListingStatusPill, useListingLabels } from '@/components/kabinet/bits';
import { BTN_DANGER, BTN_GHOST, ConfirmButton, DataTable, INPUT, Labeled, Notice, PageHead, Pager, Pill, Toolbar, errText, useAdminList } from '@/components/admin/kit';

/** Jadval ichidagi tugmalar kichik: kit sinflari ustidan faqat o'lcham o'zgaradi. */
const SM = 'px-3 py-1 text-xs';

export default function AdminListingsPage() {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const tl = useTranslations('admin.listings');
  const tr = useTranslations('region');
  const locale = useLocale();
  const L = useListingLabels();
  const [status, setStatus] = useState<ListingStatus>('ACTIVE');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const list = useAdminList<OwnerListing>('/admin/listings', { status, q, page });
  // Qaror qatorni yangilaydi: filtrga mos kelmasa ham admin nima bo'lganini ko'rib turadi
  const patch = () => void list.reload();

  const cols = [
    { key: 'title', head: tc('name'), cell: (l: OwnerListing) => (
      <>
        <span className="font-semibold">{l.title}</span>
        {l.isDemo ? <Pill tone="warn">{tl('demo')}</Pill> : null}
        {l.status === 'ACTIVE'
          ? <Link href={listingHref(l)} target="_blank" className="block font-mono text-[11px] text-teal-ink underline">{l.slug}</Link>
          : <span className="block font-mono text-[11px] text-muted">{l.slug}</span>}
      </>
    ) },
    { key: 'kind', head: tl('kind'), cell: (l: OwnerListing) => L.kind[l.kind] },
    { key: 'status', head: tc('status'), cell: (l: OwnerListing) => <ListingStatusPill status={l.status} /> },
    { key: 'region', head: tc('region'), cell: (l: OwnerListing) => (tr.has(l.regionCode) ? tr(l.regionCode) : l.regionCode) },
    { key: 'owner', head: tl('owner'), cell: (l: OwnerListing) => l.owner.name },
    { key: 'price', head: tl('price'), num: true, cell: (l: OwnerListing) => (l.priceTiyin != null ? som(l.priceTiyin, locale) : <span className="font-sans text-muted">{t('listing.onRequest')}</span>) },
    { key: 'actions', head: tc('actions'), cell: (l: OwnerListing) => <RowActions l={l} onDone={patch} /> },
  ];

  return (
    <>
      <PageHead title={t('nav.listings')} lead={tl('lead')} />
      <Toolbar onSubmit={() => { setQ(qInput.trim()); setPage(1); }}>
        <Labeled label={tc('status')} className="w-48">
          <select value={status} onChange={(e) => { setStatus(e.target.value as ListingStatus); setPage(1); }} className={INPUT}>
            {LISTING_STATUSES.map((s) => <option key={s} value={s}>{L.status[s]}</option>)}
          </select>
        </Labeled>
        <Labeled label={tc('search')} className="w-56">
          <input value={qInput} onChange={(e) => setQInput(e.target.value)} className={INPUT} />
        </Labeled>
        <button type="submit" className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-navy transition-colors duration-150 hover:border-teal">{tc('apply')}</button>
        {list.data ? <span className="ml-auto font-mono text-xs text-muted">{tc('total', { count: list.data.total })}</span> : null}
      </Toolbar>

      {list.loading ? <p className="mt-4 text-sm text-muted">{tc('loading')}</p> : null}
      {list.err ? <Notice tone="err">{errText(list.err, t, t.has, tc('loadFailed'))}</Notice> : null}
      {list.data && !list.loading ? <DataTable cols={cols} rows={list.data.items} keyOf={(l) => l.id} empty={tc('empty')} /> : null}
      <Pager page={page} pages={list.pages} onPage={setPage} />
    </>
  );
}

/**
 * Faol e'lonni sabab bilan tortib olish. Tekshiruvdagi e'lonni tasdiqlash bu yerda YO'Q:
 * u Moderatsiya bo'limida, Decide bilan. Ilgari bitta qaror ikki ekranda, ikki xil
 * ko'rinishda turardi va operator qaysi biri to'g'ri ekanini bilmasdi.
 * Rad sababi majburiy va egasiga ko'rinadi, shuning uchun input ochilmaguncha tugma yo'q.
 */
function RowActions({ l, onDone }: { l: OwnerListing; onDone: () => void }) {
  const t = useTranslations('admin');
  const [reason, setReason] = useState<string | null>(null); // null = sabab maydoni yopiq
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  if (l.status !== 'ACTIVE') return null;

  async function withdraw() {
    setBusy(true); setErr(null);
    try { await post<OwnerListing>(`/admin/listings/${l.id}/decide`, { approve: false, reason: reason?.trim() }); setReason(null); onDone(); }
    catch (e) { setErr(e); } finally { setBusy(false); }
  }

  return (
    <div className="flex min-w-[10rem] flex-col gap-1.5">
      {reason === null ? (
        <button type="button" disabled={busy} onClick={() => setReason('')} className={`${BTN_DANGER} ${SM}`}>{t('reject')}</button>
      ) : (
        <>
          <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder={t('reason')} className={`${INPUT} py-1 text-xs`} />
          <div className="flex gap-1.5">
            {reason.trim()
              ? <ConfirmButton label={t('reject')} confirm={t('confirmReject')} onRun={withdraw} className={`${BTN_DANGER} ${SM}`} />
              : <button type="button" disabled className={`${BTN_DANGER} ${SM}`}>{t('reject')}</button>}
            <button type="button" onClick={() => setReason(null)} className={`${BTN_GHOST} ${SM}`}>{t('cancel')}</button>
          </div>
          {!reason.trim() ? <p className="text-[11px] text-muted">{t('reasonRequired')}</p> : null}
        </>
      )}
      {err ? <p role="alert" className="text-[11px] text-red-700">{errText(err, t, t.has, t('failed'))}</p> : null}
    </div>
  );
}
