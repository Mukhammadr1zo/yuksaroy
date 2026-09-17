'use client';
/**
 * Terminal reestri (~1700 qator, asosan shahobcha yo'l): filtrli ro'yxat, qatorga bosilsa
 * yon varaqda to'liq qator tahrirlanadi. Ro'yxat qisqa proyeksiya, shuning uchun varaq
 * ochilganda to'liq qator alohida so'raladi. PATCH ga faqat o'zgargan kalitlar ketadi.
 */
import { useCallback, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CLAIM_STATUSES, REGIONS, TERMINAL_KINDS, TERMINAL_STATUSES, type ClaimStatus, type TerminalKind, type TerminalStatus } from '@yuksaroy/domain';
import { ApiError, api, post } from '@/lib/api';
import { uzDate } from '@/lib/format';
import { BTN, BTN_GHOST, ConfirmButton, DataTable, Drawer, errText, INPUT, Labeled, Notice, PageHead, Pager, Pill, Toolbar, useAdminList, type Col } from '@/components/admin/kit';
import { diffBody, fromRow, TerminalForm, type Draft, type TerminalFull } from '@/components/admin/TerminalForm';

/** O'chirishda yo'qoladigan bog'liq qatorlar soni. */
type Impact = { tariffs: number; reviews: number; services: number; slots: number; inquiries?: number };

/** GET /admin/catalog/terminals ro'yxat proyeksiyasi. */
type Row = {
  id: string; slug: string; name: string; kind: TerminalKind; status: TerminalStatus; regionCode: string | null; orgId: string | null;
  claimStatus: ClaimStatus; lat: number | null; lng: number | null; registryNo: number | null; stationNameRaw: string | null;
  ownerNameRaw: string | null; contactName: string | null; createdAt: string;
  station: { id: string; nameUz: string; esrCode: string | null } | null;
  org: { id: string; name: string } | null;
};
/** Yon varaq: id=null yaratish; d=null to'liq qator hali yuklanmoqda. */
type Sheet = { id: string | null; base: Draft | null; d: Draft | null };

const F0 = { q: '', kind: '', region: '', status: '', claim: '', owned: '', page: 1 };
const CLAIM_TONE: Record<ClaimStatus, 'ok' | 'warn' | 'bad' | 'neutral'> = { APPROVED: 'ok', PENDING: 'warn', REJECTED: 'bad', NONE: 'neutral' };
const STATUS_TONE: Record<TerminalStatus, 'ok' | 'warn' | 'neutral'> = { ACTIVE: 'ok', DRAFT: 'warn', HIDDEN: 'neutral' };
const NEW: Draft = { kind: 'RAIL', status: 'DRAFT', is24h: false, claimStatus: 'NONE' };
const PATH = '/admin/catalog/terminals';

export default function TerminalsPage() {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const tt = useTranslations('admin.terminals');
  const tk = useTranslations('kind');
  const tr = useTranslations('region');
  const locale = useLocale();

  // form: filtr kataklari; f: qo'llangan filtr. Ajratilgan, chunki har harfda so'rov ketmasin.
  const [form, setForm] = useState(F0);
  const [f, setF] = useState(F0);
  const { data, pages, loading, err, reload } = useAdminList<Row>(PATH, { ...f, limit: 30 });
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = (e: unknown, fb: string) => setNotice({ tone: 'err', text: errText(e, t, t.has, fb) });
  // Drawer effekti onClose ga bog'liq: har renderda yangi funksiya bo'lsa fokus katakdan varaqqa qochadi
  const close = useCallback(() => { setSheet(null); setNotice(null); }, []);
  const set = (p: Draft) => setSheet((s) => (s?.d ? { ...s, d: { ...s.d, ...p } } : s));

  function openRow(id: string) {
    setNotice(null);
    setSheet({ id, base: null, d: null });
    api<TerminalFull>(`${PATH}/${id}`)
      .then((r) => { const d = fromRow(r); setSheet({ id, base: d, d }); })
      .catch((e) => fail(e, tc('loadFailed')));
  }

  async function save() {
    if (!sheet?.d) return;
    const body = diffBody(sheet.d, sheet.base);
    setBusy(true);
    setNotice(null);
    try {
      if (sheet.id) {
        if (Object.keys(body).length) {
          const r = await api<TerminalFull>(`${PATH}/${sheet.id}`, { method: 'PATCH', body: JSON.stringify(body) });
          const d = fromRow(r);
          setSheet({ id: sheet.id, base: d, d });
        }
        setNotice({ tone: 'ok', text: tc('saved') });
      } else {
        await post(PATH, body);
        setSheet(null);
        setNotice({ tone: 'ok', text: tc('created') });
      }
      void reload();
    } catch (e) { fail(e, tc('saveFailed')); } finally { setBusy(false); }
  }

  /*
   * Terminal o'chirilganda tarif tarixi, baholar, xizmatlar va slot kalendari birga
   * ketadi. Server bo'sh bo'lmagan terminalni birinchi urinishda rad etadi va nima
   * yo'qolishini sanab beradi; operator shuni ko'rib, ataylab ikkinchi marta tasdiqlaydi.
   * Ilgari ikki bosishlik oddiy tasdiq bilan hammasi jimgina yo'qolardi.
   */
  const [impact, setImpact] = useState<Impact | null>(null);

  async function remove(force = false) {
    if (!sheet?.id) return;
    try {
      await api(`${PATH}/${sheet.id}${force ? '?force=1' : ''}`, { method: 'DELETE' });
      setSheet(null);
      setImpact(null);
      setNotice({ tone: 'ok', text: tc('deleted') });
      void reload();
    } catch (e) {
      const body = e instanceof ApiError ? (e.body as (Impact & { code?: string }) | undefined) : undefined;
      if (body?.code === 'TERMINAL_HAS_DATA') { setImpact(body); return; }
      fail(e, tc('saveFailed'));
    }
  }

  const cols: Col<Row>[] = [
    { key: 'name', head: tc('name'), cell: (r) => <><div className="font-semibold text-navy">{r.name}</div><div className="font-mono text-[11px] text-muted">{r.slug}</div></> },
    { key: 'kind', head: tt('kind'), cell: (r) => tk(r.kind) },
    { key: 'station', head: tt('station'), cell: (r) => r.station?.nameUz ?? r.stationNameRaw ?? '' },
    { key: 'region', head: tc('region'), cell: (r) => (r.regionCode && tr.has(r.regionCode) ? tr(r.regionCode) : r.regionCode ?? '') },
    { key: 'owner', head: tt('owner'), cell: (r) => (r.org ? r.org.name : <Pill>{tt('noOwner')}</Pill>) },
    { key: 'claim', head: tt('claim'), cell: (r) => <Pill tone={CLAIM_TONE[r.claimStatus]}>{r.claimStatus}</Pill> },
    { key: 'status', head: tc('status'), cell: (r) => <Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill> },
    { key: 'coords', head: tt('coords'), num: true, cell: (r) => (r.lat != null && r.lng != null ? <span className="text-teal-ink">&#10003;</span> : <span className="text-muted">-</span>) },
    { key: 'registryNo', head: t('claim.registry'), num: true, cell: (r) => r.registryNo ?? '' },
    { key: 'createdAt', head: tc('createdAt'), num: true, cell: (r) => uzDate(r.createdAt, locale) },
  ];

  const selectCls = 'w-full sm:w-40';
  const opt = (v: string, label: string) => <option key={v} value={v}>{label}</option>;

  return (
    <div>
      <PageHead title={t('nav.terminals')} lead={tt('lead')}>
        <button type="button" className={BTN} onClick={() => { setNotice(null); setSheet({ id: null, base: null, d: NEW }); }}>{tt('new')}</button>
      </PageHead>

      <Toolbar onSubmit={() => setF({ ...form, page: 1 })}>
        <Labeled label={tc('search')} className="w-full sm:w-56">
          <input className={INPUT} value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} />
        </Labeled>
        <Labeled label={tt('kind')} className={selectCls}>
          <select className={INPUT} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            {opt('', tc('all'))}{TERMINAL_KINDS.map((k) => opt(k, tk(k)))}
          </select>
        </Labeled>
        <Labeled label={tc('region')} className={selectCls}>
          <select className={INPUT} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>
            {opt('', tc('all'))}{REGIONS.map((c) => opt(c, tr(c)))}
          </select>
        </Labeled>
        <Labeled label={tc('status')} className={selectCls}>
          <select className={INPUT} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {opt('', tc('all'))}{TERMINAL_STATUSES.map((s) => opt(s, s))}
          </select>
        </Labeled>
        <Labeled label={tt('claim')} className={selectCls}>
          <select className={INPUT} value={form.claim} onChange={(e) => setForm({ ...form, claim: e.target.value })}>
            {opt('', tc('all'))}{CLAIM_STATUSES.map((s) => opt(s, s))}
          </select>
        </Labeled>
        <Labeled label={tt('owner')} className={selectCls}>
          <select className={INPUT} value={form.owned} onChange={(e) => setForm({ ...form, owned: e.target.value })}>
            {opt('', tc('all'))}{opt('1', tt('ownedOnly'))}{opt('0', tt('freeOnly'))}
          </select>
        </Labeled>
        <button type="submit" className={BTN}>{tc('apply')}</button>
        <button type="button" className={BTN_GHOST} onClick={() => { setForm(F0); setF(F0); }}>{tc('reset')}</button>
      </Toolbar>

      {err ? <Notice tone="err">{errText(err, t, t.has, tc('loadFailed'))}</Notice> : null}
      {!sheet && notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
      <p className="mt-4 font-mono text-xs text-muted">{loading || !data ? tc('loading') : tc('total', { count: data.total })}</p>

      <DataTable cols={cols} rows={data?.items ?? []} keyOf={(r) => r.id} empty={tc('empty')} onRow={(r) => openRow(r.id)} />
      <Pager page={f.page} pages={pages} onPage={(p) => { setF({ ...f, page: p }); setForm({ ...form, page: p }); }} />

      <Drawer
        open={!!sheet}
        title={sheet?.id ? sheet.d?.name ?? tc('loading') : tt('new')}
        onClose={close}
        footer={sheet ? (
          <>
            {sheet.id ? (
              <div className="mr-auto flex flex-col items-start gap-1">
                <span className="text-xs text-muted">{tt('deleteWarn')}</span>
                {impact ? (
                  <span className="flex flex-wrap items-center gap-2">
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
            <button type="button" className={BTN_GHOST} onClick={close}>{tc('cancel')}</button>
            <button type="button" className={BTN} disabled={busy || !sheet.d} onClick={save}>{sheet.id ? tc('save') : tc('create')}</button>
          </>
        ) : null}
      >
        {sheet?.d ? <TerminalForm d={sheet.d} set={set} /> : <p className="text-sm text-muted">{tc('loading')}</p>}
        {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
      </Drawer>
    </div>
  );
}
