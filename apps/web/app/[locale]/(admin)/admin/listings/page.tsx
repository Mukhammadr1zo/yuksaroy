'use client';
// Admin: hamma e'lonlar, holati bo'yicha. Moderatsiya navbati alohida; bu yerda admin faol e'lonni
// sabab bilan tortib oladi. Endpoint bitta holatning massivini (200 tagacha) qaytaradi, shuning
// uchun qidiruv va sahifalash brauzerda.
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LISTING_STATUSES, type ListingStatus } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { api, post } from '@/lib/api';
import { num, som, uzDate, uzDateTime } from '@/lib/format';
import { listingHref, type OwnerListing } from '@/lib/types-kabinet';
import { ListingStatusPill, useListingLabels } from '@/components/kabinet/bits';
import { BTN_DANGER, BTN_GHOST, ConfirmButton, DataTable, INPUT, Labeled, Notice, PageHead, Pager, Pill, Toolbar, errText } from '@/components/admin/kit';

const PAGE = 30;
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
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<OwnerListing[] | null>(null);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => {
    setRows(null); setErr(null); setPage(1);
    api<OwnerListing[]>(`/admin/listings?status=${status}`).then(setRows).catch(setErr);
  }, [status]);

  const needle = q.trim().toLowerCase();
  const filtered = (rows ?? []).filter((l) => !needle || l.title.toLowerCase().includes(needle) || l.owner.name.toLowerCase().includes(needle));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const shown = filtered.slice((page - 1) * PAGE, page * PAGE);
  // Qaror qatorni joyida yangilaydi: filtrga mos kelmasa ham admin nima bo'lganini ko'rib turadi
  const patch = (l: OwnerListing) => setRows((rs) => (rs ?? []).map((x) => (x.id === l.id ? l : x)));

  const cols = [
    { key: 'title', head: tc('name'), cell: (l: OwnerListing) => (
      <>
        <span className="font-semibold">{l.title}</span>
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
    { key: 'views', head: tl('views'), num: true, cell: (l: OwnerListing) => num(l.views, locale) },
    { key: 'premium', head: tl('premium'), num: true, cell: (l: OwnerListing) => (l.premiumUntil ? uzDate(l.premiumUntil, locale) : l.premium ? <Pill tone="ok">{tl('premium')}</Pill> : <span className="text-muted">-</span>) },
    { key: 'updated', head: tl('updatedAt'), num: true, cell: (l: OwnerListing) => uzDateTime(l.updatedAt, locale) },
    { key: 'actions', head: tc('actions'), cell: (l: OwnerListing) => <RowActions l={l} onDone={patch} /> },
  ];

  return (
    <>
      <PageHead title={t('nav.listings')} lead={tl('lead')} />
      <Toolbar onSubmit={() => setPage(1)}>
        <Labeled label={tc('status')} className="w-48">
          <select value={status} onChange={(e) => setStatus(e.target.value as ListingStatus)} className={INPUT}>
            {LISTING_STATUSES.map((s) => <option key={s} value={s}>{L.status[s]}</option>)}
          </select>
        </Labeled>
        <Labeled label={tc('search')} className="w-56">
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className={INPUT} />
        </Labeled>
        {rows ? <span className="ml-auto font-mono text-xs text-muted">{tc('total', { count: filtered.length })}</span> : null}
      </Toolbar>

      {!rows && !err ? <p className="mt-4 text-sm text-muted">{tc('loading')}</p> : null}
      {err ? <Notice tone="err">{errText(err, t, t.has, tc('loadFailed'))}</Notice> : null}
      {rows ? <DataTable cols={cols} rows={shown} keyOf={(l) => l.id} empty={tc('empty')} /> : null}
      <Pager page={page} pages={pages} onPage={setPage} />
    </>
  );
}

/**
 * Tekshiruvdagi e'lon: tasdiqlash yoki sabab bilan rad etish. Faol e'lon: faqat sabab bilan tortib olish.
 * Rad sababi majburiy va egasiga ko'rinadi, shuning uchun input ochilmaguncha yuborish tugmasi yo'q.
 */
function RowActions({ l, onDone }: { l: OwnerListing; onDone: (l: OwnerListing) => void }) {
  const t = useTranslations('admin');
  const [reason, setReason] = useState<string | null>(null); // null = sabab maydoni yopiq
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  if (l.status !== 'PENDING_REVIEW' && l.status !== 'ACTIVE') return null;

  async function decide(approve: boolean) {
    setBusy(true); setErr(null);
    try { onDone(await post<OwnerListing>(`/admin/listings/${l.id}/decide`, { approve, reason: approve ? undefined : reason?.trim() })); setReason(null); }
    catch (e) { setErr(e); } finally { setBusy(false); }
  }

  return (
    <div className="flex min-w-[10rem] flex-col gap-1.5">
      {reason === null ? (
        <div className="flex gap-1.5">
          {l.status === 'PENDING_REVIEW' ? <button type="button" disabled={busy} onClick={() => decide(true)} className={`${BTN_GHOST} ${SM}`}>{t('approve')}</button> : null}
          <button type="button" disabled={busy} onClick={() => setReason('')} className={`${BTN_DANGER} ${SM}`}>{t('reject')}</button>
        </div>
      ) : (
        <>
          <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder={t('reason')} className={`${INPUT} py-1 text-xs`} />
          <div className="flex gap-1.5">
            {reason.trim()
              ? <ConfirmButton label={t('reject')} confirm={t('confirmReject')} onRun={() => decide(false)} className={`${BTN_DANGER} ${SM}`} />
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
