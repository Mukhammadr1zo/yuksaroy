'use client';
// Admin: hamma e'lonlar, holati bo'yicha. Moderatsiya navbati alohida (tasdiqlash o'sha yerda).
// Qator obyekt sahifasiga (/admin/listings/{id}) olib boradi; faol e'lonni tortib olish o'sha
// yerda va pastdagi guruh panelida (bulk-archive: sabab majburiy, egasiga ko'rinadi, xabar ketadi).
// Filtr va tartib URL da: tashkilot, foydalanuvchi va terminal sahifalari ?orgId= / ?ownerUserId= /
// ?terminalId= bilan keladi, kataksiz filtr "Tozalash" bilan ketadi.
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LISTING_STATUSES } from '@yuksaroy/domain';
import { post } from '@/lib/api';
import { som, uzDate } from '@/lib/format';
import { listingHref, type OwnerListing } from '@/lib/types-kabinet';
import { ListingStatusPill, useListingLabels } from '@/components/kabinet/bits';
import {
  BTN, BTN_GHOST, BULK_MAX, BulkBar, type Col, ConfirmButton, DataTable, ExportLink, INPUT, Labeled, LoadError, Notice, PageHead, Pager, Pill,
  Toolbar, errText, useAdminList, useListQuery, type SortDir,
} from '@/components/admin/kit';

/** Sukut holat ACTIVE: ro'yxat doim bitta holatda, "hammasi" tanlovi yo'q (server ham shunday). */
const F0 = { status: 'ACTIVE', q: '', orgId: '', ownerUserId: '', terminalId: '', sort: '', dir: '', page: 1 };
const PATH = '/admin/listings';

export default function AdminListingsPage() {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const tl = useTranslations('admin.listings');
  const tb = useTranslations('admin.table');
  const tr = useTranslations('region');
  const locale = useLocale();
  const L = useListingLabels();

  const { f, set, reset } = useListQuery(F0);
  const { data, pages, loading, err, reload } = useAdminList<OwnerListing>(PATH, f);
  const [q, setQ] = useState(f.q);
  useEffect(() => setQ(f.q), [f.q]);

  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const filterKey = JSON.stringify({ ...f, page: 0 });
  useEffect(() => setIds(new Set()), [filterKey]);
  const clearSel = useCallback(() => setIds(new Set()), []);

  /** Tanlanganlarni tortib olish: faqat ACTIVE qatorlar o'zgaradi, qolgani skipped bo'lib qaytadi. */
  async function withdrawSel() {
    setBusy(true); setNote(null);
    try {
      const r = await post<{ done: number; skipped: number }>(`${PATH}/bulk-archive`, { ids: Array.from(ids), reason: reason.trim() });
      setNote({ tone: 'ok', text: tb('bulkDone', { done: r.done, skipped: r.skipped }) });
      clearSel(); setReason('');
      void reload();
    } catch (e) { setNote({ tone: 'err', text: errText(e, t, t.has, tc('saveFailed')) }); } finally { setBusy(false); }
  }

  const cols: Col<OwnerListing>[] = [
    { key: 'title', head: tc('name'), sort: 'title', cell: (l) => (
      <>
        <span className="font-semibold">{l.title}</span>
        {l.isDemo ? <Pill tone="warn">{tl('demo')}</Pill> : null}
        <span className="block font-mono text-[11px] text-muted">{l.slug}</span>
      </>
    ) },
    { key: 'kind', head: tl('kind'), cell: (l) => L.kind[l.kind] },
    { key: 'status', head: tc('status'), cell: (l) => <ListingStatusPill status={l.status} /> },
    { key: 'region', head: tc('region'), cell: (l) => (tr.has(l.regionCode) ? tr(l.regionCode) : l.regionCode) },
    { key: 'owner', head: tl('owner'), cell: (l) => l.owner.name },
    { key: 'price', head: tl('price'), num: true, sort: 'priceTiyin', cell: (l) => (l.priceTiyin != null ? som(l.priceTiyin, locale) : <span className="font-sans text-muted">{t('listing.onRequest')}</span>) },
    { key: 'createdAt', head: tc('createdAt'), num: true, sort: 'createdAt', cell: (l) => uzDate(l.createdAt, locale) },
  ];

  const needReason = !reason.trim();

  return (
    <>
      <PageHead title={t('nav.listings')} lead={tl('lead')}>
        <ExportLink path={PATH} filters={f} total={data?.total ?? 0} ids={ids} />
      </PageHead>
      <Toolbar onSubmit={() => set({ q: q.trim() })}>
        <Labeled label={tc('status')} className="w-48">
          <select value={f.status} onChange={(e) => set({ status: e.target.value })} className={INPUT}>
            {LISTING_STATUSES.map((s) => <option key={s} value={s}>{L.status[s]}</option>)}
          </select>
        </Labeled>
        <Labeled label={tc('search')} className="w-56">
          <input data-search="1" value={q} onChange={(e) => setQ(e.target.value)} className={INPUT} />
        </Labeled>
        <button type="submit" className={BTN}>{tc('apply')}</button>
        <button type="button" className={BTN_GHOST} onClick={reset}>{tc('reset')}</button>
        {data ? <span className="ml-auto font-mono text-xs text-muted">{tc('total', { count: data.total })}</span> : null}
      </Toolbar>

      {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}
      {err ? <LoadError err={err} onRetry={reload} /> : null}
      <DataTable
        cols={cols} rows={data?.items ?? []} keyOf={(l) => l.id} empty={tc('empty')} loading={loading} screen="listings"
        onReset={reset}
        sort={f.sort ? { field: f.sort, dir: (f.dir === 'desc' ? 'desc' : 'asc') as SortDir } : undefined}
        onSort={(field, dir) => set({ sort: field, dir })}
        // Tanlov faqat faol ro'yxatda: tortib olish faqat ACTIVE dan, boshqa holatda tanlashning ma'nosi yo'q
        select={f.status === 'ACTIVE' ? { ids, onChange: setIds } : undefined}
        href={(l) => `/admin/listings/${l.id}`}
        rowMenu={(l) => [
          { label: tb('open'), href: `/admin/listings/${l.id}` },
          ...(l.status === 'ACTIVE' ? [{ label: tb('onSite'), href: listingHref(l) }] : []),
          { label: tb('history'), href: `/admin/audit?entity=Listing&entityId=${l.id}` },
        ]}
      />
      <Pager page={f.page} pages={pages} onPage={(p) => set({ page: p })} />

      <BulkBar count={ids.size} onClear={clearSel}>
        <span className="flex w-full flex-col gap-0.5 sm:w-72">
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder={tb('bulkReason')}
            aria-label={tb('bulkReason')} className={`${INPUT} text-navy`} />
          {needReason ? <span className="text-[11px] text-white/70">{t('reasonRequired')}</span> : null}
        </span>
        <ConfirmButton label={tb('bulkWithdraw')} confirm={t('confirmReject')} onRun={withdrawSel} disabled={busy || needReason || ids.size > BULK_MAX} />
      </BulkBar>
    </>
  );
}
