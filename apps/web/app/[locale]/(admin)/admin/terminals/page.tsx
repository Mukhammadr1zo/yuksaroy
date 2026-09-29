'use client';
/**
 * Terminal reestri (~1700 qator, asosan shahobcha yo'l): filtrli, tartiblanadigan ro'yxat.
 * Qator obyekt sahifasiga (/admin/terminals/{id}) olib boradi: tahrir va o'chirish o'sha yerda,
 * chunki yon varaqdan orqaga tugmasi filtrli ro'yxatga qaytarmasdi. Bu ekranda yaratish
 * varag'i (?new=1) va guruh amallari qoladi.
 * Filtr, tartib va sahifa URL da (useListQuery): orqaga tugmasi filtrni qaytaradi, havola ulashiladi.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CLAIM_STATUSES, OWNER_KINDS, REGIONS, TERMINAL_KINDS, TERMINAL_STATUSES, type ClaimStatus, type TerminalKind, type TerminalStatus } from '@yuksaroy/domain';
import { post } from '@/lib/api';
import { uzDate } from '@/lib/format';
import {
  BTN, BTN_GHOST, BULK_MAX, BulkBar, ConfirmButton, DataTable, Drawer, ExportLink, errText, INPUT, Labeled, LoadError, Notice,
  PageHead, Pager, Pill, Toolbar, useAdminList, useListQuery, type Col, type SortDir,
} from '@/components/admin/kit';
import { diffBody, TerminalForm, type Draft } from '@/components/admin/TerminalForm';

/** GET /admin/catalog/terminals ro'yxat proyeksiyasi. */
type Row = {
  id: string; slug: string; name: string; kind: TerminalKind; status: TerminalStatus; regionCode: string | null; orgId: string | null;
  claimStatus: ClaimStatus; lat: number | null; lng: number | null; registryNo: number | null; stationNameRaw: string | null;
  ownerNameRaw: string | null; contactName: string | null; createdAt: string;
  station: { id: string; nameUz: string; esrCode: string | null } | null;
  org: { id: string; name: string } | null;
  /** Faqat talab tartibida hisoblanadi, shuning uchun ustunlar ham o'sha tartibda chiziladi. */
  views30?: number; openInquiries?: number;
};

/**
 * URL dagi holat: sukut qiymat manzilga yozilmaydi. `new` yaratish varag'i, API ga ketmaydi.
 * `orgId` tashkilot sahifasidagi "hammasi" havolasidan: useListQuery faqat shu ro'yxatdagi kalitni o'qiydi,
 * u bo'lmasa filtr yo'qolib ~1700 qatorli umumiy ro'yxat ochilardi.
 */
const F0 = { q: '', kind: '', region: '', status: '', claim: '', owned: '', ownerKind: '', orgId: '', sort: '', dir: '', page: 1, new: '' };
const CLAIM_TONE: Record<ClaimStatus, 'ok' | 'warn' | 'bad' | 'neutral'> = { APPROVED: 'ok', PENDING: 'warn', REJECTED: 'bad', NONE: 'neutral' };
const STATUS_TONE: Record<TerminalStatus, 'ok' | 'warn' | 'neutral'> = { ACTIVE: 'ok', DRAFT: 'warn', HIDDEN: 'neutral' };
const NEW: Draft = { kind: 'RAIL', status: 'DRAFT', is24h: false, claimStatus: 'NONE' };
const PATH = '/admin/catalog/terminals';
const LIMIT = 30;

export default function TerminalsPage() {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const tt = useTranslations('admin.terminals');
  const tb = useTranslations('admin.table');
  const ts = useTranslations('terminalsAdmin.status');
  const tcl = useTranslations('claimStatus');
  const tk = useTranslations('kind');
  const tr = useTranslations('region');
  const locale = useLocale();

  const { f, set, reset } = useListQuery(F0);
  const filters = { ...f, new: undefined };
  const { data, pages, loading, err, reload } = useAdminList<Row>(PATH, { ...filters, limit: LIMIT });
  // Qidiruv kataki qoralama: har harfda so'rov ketmasin; orqaga tugmasi URL ni qaytarsa katak ham ergashadi
  const [q, setQ] = useState(f.q);
  useEffect(() => setQ(f.q), [f.q]);

  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  /** Guruh amalining (egasining turi bo'yicha) natijasi yoki xatosi: blok ichida ko'rinadi. */
  const [bulk, setBulk] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  // Tanlov sahifalar aro saqlanadi, filtr o'zgarsa tozalanadi: eski tanlov yangi ro'yxatda ko'rinmaydi
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const filterKey = JSON.stringify({ ...f, page: 0, new: '' });
  useEffect(() => setIds(new Set()), [filterKey]);
  const clearSel = useCallback(() => setIds(new Set()), []);

  // Yaratish varag'i: ?new=1 ochadi (topbar "Yangi terminal" ham shu manzilga keladi)
  const isNew = f.new === '1';
  const [draft, setDraft] = useState<Draft>(NEW);
  const closeNew = useCallback(() => { setDraft(NEW); setNotice(null); set({ new: '', page: f.page }, 'replace'); }, [set, f.page]);

  const fail = (e: unknown, fb: string) => setNotice({ tone: 'err', text: errText(e, t, t.has, fb) });

  async function create() {
    setBusy(true);
    setNotice(null);
    try {
      await post(PATH, diffBody(draft, null));
      closeNew();
      setNotice({ tone: 'ok', text: tc('created') });
      void reload();
    } catch (e) { fail(e, tc('saveFailed')); } finally { setBusy(false); }
  }

  /** Tanlangan qatorlarni yashirish yoki faollashtirish: server namuna qatorlarni o'tkazib yuboradi. */
  async function runSel(action: 'HIDE' | 'ACTIVATE') {
    setBusy(true);
    setNotice(null);
    try {
      const r = await post<{ done: number; skipped: number }>(`${PATH}/bulk`, { ids: Array.from(ids), action });
      setNotice({ tone: 'ok', text: tb('bulkDone', { done: r.done, skipped: r.skipped }) });
      clearSel();
      void reload();
    } catch (e) { fail(e, tc('saveFailed')); } finally { setBusy(false); }
  }

  /**
   * Guruh amali: filtrda topilganlarning hammasiga (egasining turi bo'yicha).
   *
   * expect ga ekranda ko'rinib turgan jami son yuboriladi. Server uni qaytadan sanaydi
   * va farq qilsa hech narsa qilmaydi: operator ko'rgan ro'yxat bilan o'zgaradigan
   * ro'yxat bir xil bo'lishi kerak.
   */
  async function runBulk(action: 'HIDE' | 'DELETE') {
    if (!f.ownerKind || !data?.total) return;
    setBusy(true);
    setBulk(null);
    try {
      const r = await post<{ done: number; skipped: number }>(`${PATH}/bulk-owner`, { ownerKind: f.ownerKind, action, expect: data.total });
      setBulk({ tone: 'ok', text: tt('bulkDone', { done: r.done, skipped: r.skipped }) });
      void reload();
    } catch (e) {
      setBulk({ tone: 'err', text: errText(e, t, t.has, tc('saveFailed')) });
    } finally { setBusy(false); }
  }

  const demand = f.sort === 'demand';
  const cols: Col<Row>[] = [
    { key: 'name', head: tc('name'), sort: 'name', cell: (r) => <><div className="font-semibold text-navy">{r.name}</div><div className="font-mono text-[11px] text-muted">{r.slug}</div></> },
    { key: 'kind', head: tt('kind'), cell: (r) => tk(r.kind) },
    // Stansiya va reestr raqami sukutda yashirin: 640-1000 px oralig'ida jadval zich, kerak bo'lsa Ustunlar menyusidan ochiladi
    { key: 'station', head: tt('station'), hidden: true, cell: (r) => r.station?.nameUz ?? r.stationNameRaw ?? '' },
    { key: 'region', head: tc('region'), sort: 'regionCode', cell: (r) => (r.regionCode && tr.has(r.regionCode) ? tr(r.regionCode) : r.regionCode ?? '') },
    {
      // Reestrdagi ega nomi ham chiziladi: operator qatorni aynan shu nom bo'yicha hukm qiladi.
      key: 'owner',
      head: tt('owner'),
      cell: (r) => (
        <>
          {r.org ? <div>{r.org.name}</div> : <Pill>{tt('noOwner')}</Pill>}
          {/* line-clamp, truncate emas: nowrap katak ustunni 240 px ga majburlab Nomi ustunini siqib qo'yardi */}
          {r.ownerNameRaw ? <div className="mt-0.5 line-clamp-1 break-words text-[11px] text-muted" title={r.ownerNameRaw}>{r.ownerNameRaw}</div> : null}
        </>
      ),
    },
    { key: 'claim', head: tt('claim'), sort: 'claimStatus', cell: (r) => <Pill tone={CLAIM_TONE[r.claimStatus]}>{tcl(r.claimStatus)}</Pill> },
    { key: 'status', head: tc('status'), sort: 'status', cell: (r) => <Pill tone={STATUS_TONE[r.status]}>{ts(r.status)}</Pill> },
    ...(demand
      ? [
          { key: 'views30', head: tt('views30'), num: true, cell: (r: Row) => r.views30 ?? 0 },
          { key: 'openInquiries', head: tt('openInquiries'), num: true, cell: (r: Row) => r.openInquiries ?? 0 },
        ]
      : []),
    { key: 'registryNo', head: t('claim.registry'), num: true, sort: 'registryNo', hidden: true, cell: (r) => r.registryNo ?? '' },
    { key: 'createdAt', head: tc('createdAt'), num: true, sort: 'createdAt', cell: (r) => uzDate(r.createdAt, locale) },
  ];

  const selectCls = 'w-full sm:w-40';
  const opt = (v: string, label: string) => <option key={v} value={v}>{label}</option>;
  const sel = (k: keyof typeof F0) => (e: React.ChangeEvent<HTMLSelectElement>) => set({ [k]: e.target.value } as Partial<typeof F0>);
  const tooMany = ids.size > BULK_MAX;

  return (
    <div>
      <PageHead title={t('nav.terminals')} lead={tt('lead')}>
        <ExportLink path={PATH} filters={filters} total={data?.total ?? 0} ids={ids} />
        <button type="button" className={BTN} onClick={() => { setNotice(null); set({ new: '1', page: f.page }, 'replace'); }}>{tt('new')}</button>
      </PageHead>

      <Toolbar onSubmit={() => set({ q: q.trim() })}>
        <Labeled label={tc('search')} className="w-full sm:w-56">
          <input data-search="1" className={INPUT} value={q} onChange={(e) => setQ(e.target.value)} />
        </Labeled>
        <Labeled label={tt('kind')} className={selectCls}>
          <select className={INPUT} value={f.kind} onChange={sel('kind')}>
            {opt('', tc('all'))}{TERMINAL_KINDS.map((k) => opt(k, tk(k)))}
          </select>
        </Labeled>
        <Labeled label={tc('region')} className={selectCls}>
          <select className={INPUT} value={f.region} onChange={sel('region')}>
            {opt('', tc('all'))}{REGIONS.map((c) => opt(c, tr(c)))}
          </select>
        </Labeled>
        <Labeled label={tc('status')} className={selectCls}>
          <select className={INPUT} value={f.status} onChange={sel('status')}>
            {opt('', tc('all'))}{TERMINAL_STATUSES.map((s) => opt(s, ts(s)))}
          </select>
        </Labeled>
        <Labeled label={tt('claim')} className={selectCls}>
          <select className={INPUT} value={f.claim} onChange={sel('claim')}>
            {opt('', tc('all'))}{CLAIM_STATUSES.map((s) => opt(s, tcl(s)))}
          </select>
        </Labeled>
        <Labeled label={tt('owner')} className={selectCls}>
          <select className={INPUT} value={f.owned} onChange={sel('owned')}>
            {opt('', tc('all'))}{opt('1', tt('ownedOnly'))}{opt('0', tt('freeOnly'))}
          </select>
        </Labeled>
        <Labeled label={tt('ownerKindLabel')} className={selectCls}>
          <select className={INPUT} value={f.ownerKind} onChange={sel('ownerKind')}>
            {opt('', tc('all'))}{OWNER_KINDS.map((k) => opt(k, tt(`ownerKinds.${k}`)))}
          </select>
        </Labeled>
        <Labeled label={tt('sort')} className={selectCls}>
          {/* Talab tartibi alohida yo'l (views30 hisoblanadi); ustun sarlavhasi tanlansa bu katak "yangilar" da turadi */}
          <select className={INPUT} value={demand ? 'demand' : ''} onChange={(e) => set({ sort: e.target.value, dir: '' })}>
            {opt('', tt('sortNew'))}{opt('demand', tt('sortDemand'))}
          </select>
        </Labeled>
        <button type="submit" className={BTN}>{tc('apply')}</button>
        <button type="button" className={BTN_GHOST} onClick={reset}>{tc('reset')}</button>
      </Toolbar>

      {err ? <LoadError err={err} onRetry={reload} /> : null}
      {!isNew && notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
      {data ? <p className="mt-4 font-mono text-xs text-muted">{tc('total', { count: data.total })}</p> : null}
      {demand ? <p className="mt-1 text-xs text-muted">{tt('demandNote')}</p> : null}

      <DataTable
        cols={cols} rows={data?.items ?? []} keyOf={(r) => r.id} empty={tc('empty')} loading={loading} screen="terminals"
        onReset={reset}
        sort={f.sort && !demand ? { field: f.sort, dir: (f.dir === 'desc' ? 'desc' : 'asc') as SortDir } : undefined}
        onSort={demand ? undefined : (field, dir) => set({ sort: field, dir })}
        select={{ ids, onChange: setIds }}
        href={(r) => `/admin/terminals/${r.id}`}
        rowMenu={(r) => [
          { label: tb('open'), href: `/admin/terminals/${r.id}` },
          { label: tb('history'), href: `/admin/audit?entity=Terminal&entityId=${r.id}` },
          ...(r.status === 'ACTIVE' ? [{ label: tb('onSite'), href: `/terminals/${r.slug}` }] : []),
        ]}
      />
      <Pager page={f.page} pages={pages} onPage={(p) => set({ page: p })} />

      {/* Guruh amali faqat egasining turi filtri qo'llanganda chiqadi: amal aynan
          shu filtrga tegishli, ya'ni ekranda ko'rinib turgan ro'yxatga. */}
      {f.ownerKind ? (
        <div className="mt-6 rounded-2xl border border-line bg-white p-4">
          <p className="text-sm font-semibold text-navy">{tt('bulkWarn', { count: data?.total ?? 0 })}</p>
          <p className="mt-1 text-xs text-muted">{tt('ownerKindNote')}</p>
          {bulk ? <div className="mt-3"><Notice tone={bulk.tone}>{bulk.text}</Notice></div> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <ConfirmButton label={tt('bulkHide')} confirm={tc('confirm')} onRun={() => runBulk('HIDE')} className={BTN} disabled={busy || !data?.total} />
            <ConfirmButton label={tt('bulkDelete')} confirm={tc('confirm')} onRun={() => runBulk('DELETE')} disabled={busy || !data?.total} />
          </div>
        </div>
      ) : null}

      {/* Tanlangan qatorlar: yashirish qaytariladigan amal, shuning uchun operatorga ham ochiq; o'chirish bu yerda yo'q */}
      <BulkBar count={ids.size} onClear={clearSel}>
        <ConfirmButton label={tb('bulkHide')} confirm={tc('confirm')} onRun={() => runSel('HIDE')} disabled={busy || tooMany} />
        <ConfirmButton label={tb('bulkActivate')} confirm={tc('confirm')} onRun={() => runSel('ACTIVATE')} className={BTN} disabled={busy || tooMany} />
      </BulkBar>

      <Drawer
        open={isNew}
        title={tt('createTitle')}
        onClose={closeNew}
        footer={(
          <>
            {/* Xabar tugma bilan bitta panelda: uzun shaklning ostida qolsa ko'rinmaydi */}
            {notice ? <div className="w-full"><Notice tone={notice.tone}>{notice.text}</Notice></div> : null}
            <button type="button" className={BTN_GHOST} onClick={closeNew}>{tc('cancel')}</button>
            <button type="button" className={BTN} disabled={busy} onClick={create}>{tc('create')}</button>
          </>
        )}
      >
        <TerminalForm d={draft} set={(p) => setDraft({ ...draft, ...p })} />
      </Drawer>
    </div>
  );
}
