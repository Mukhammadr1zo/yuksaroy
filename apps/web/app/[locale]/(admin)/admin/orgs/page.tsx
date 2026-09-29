'use client';
// Tashkilotlar reestri: tashkilot tasdig'i holati, a'zolar va obyektlar soni.
// Tahrir, a'zolar va o'chirish obyekt sahifasida (/admin/orgs/{id}): ilgari yon varaqda edi
// va orqaga tugmasi filtrli ro'yxatga qaytarmasdi. Filtr va tartib URL da (useListQuery).
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { KYC_STATUSES, ORG_KINDS } from '@yuksaroy/domain';
import { num, uzDate } from '@/lib/format';
import {
  BTN, BTN_GHOST, type Col, DataTable, ExportLink, INPUT, Labeled, LoadError, PageHead, Pager, Pill, Toolbar, useAdminList, useListQuery, type SortDir,
} from '@/components/admin/kit';

type Row = {
  id: string; name: string; slug: string | null; kinds: string[]; stir: string | null; kycStatus: string; createdAt: string;
  _count: { members: number; terminals: number; listings: number };
};

const kycTone = (s: string) => (s === 'VERIFIED' ? 'ok' : s === 'PENDING' ? 'warn' : s === 'REJECTED' ? 'bad' : 'neutral');
const F0 = { q: '', kyc: '', kind: '', sort: '', dir: '', page: 1 };
const PATH = '/admin/orgs/all';
const LIMIT = 30;

export default function AdminOrgsPage() {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const tb = useTranslations('admin.table');
  const tk = useTranslations('kyc');
  const tok = useTranslations('orgKind');
  const locale = useLocale();

  // Buyurtmalar va paleta ?q= bilan keladi: qidiruv URL dan boshlanadi
  const { f, set, reset } = useListQuery(F0);
  const { data, pages, loading, err, reload } = useAdminList<Row>(PATH, { ...f, limit: LIMIT });
  const [q, setQ] = useState(f.q);
  useEffect(() => setQ(f.q), [f.q]);

  const cols: Col<Row>[] = [
    { key: 'name', head: tc('name'), sort: 'name', cell: (o) => (
      <div className="min-w-0">
        <div className="font-semibold text-navy">{o.name}</div>
        <div className="font-mono text-xs text-muted">{o.slug ?? ''}</div>
      </div>
    ) },
    { key: 'stir', head: t('orgs.stir'), num: true, cell: (o) => o.stir ?? '' },
    { key: 'kinds', head: t('orgs.kinds'), cell: (o) => <div className="flex flex-wrap gap-1">{o.kinds.map((k) => <Pill key={k}>{tok.has(k) ? tok(k) : k}</Pill>)}</div> },
    { key: 'kyc', head: t('orgs.kyc'), sort: 'kycStatus', cell: (o) => <Pill tone={kycTone(o.kycStatus)}>{tk.has(o.kycStatus) ? tk(o.kycStatus) : o.kycStatus}</Pill> },
    { key: 'members', head: t('orgs.members'), num: true, sort: 'members', cell: (o) => num(o._count.members, locale) },
    { key: 'terminals', head: t('orgs.objects'), num: true, sort: 'terminals', cell: (o) => num(o._count.terminals, locale) },
    { key: 'listings', head: t('nav.listings'), num: true, sort: 'listings', cell: (o) => num(o._count.listings, locale) },
    { key: 'createdAt', head: tc('createdAt'), num: true, sort: 'createdAt', cell: (o) => uzDate(o.createdAt, locale) },
  ];

  return (
    <>
      <PageHead title={t('nav.orgs')} lead={t('orgs.lead')}>
        <ExportLink path={PATH} filters={f} total={data?.total ?? 0} />
      </PageHead>
      <Toolbar onSubmit={() => set({ q: q.trim() })}>
        <Labeled label={tc('search')} className="grow basis-56">
          <input data-search="1" value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} className={INPUT} />
        </Labeled>
        <Labeled label={t('orgs.kyc')} className="basis-40">
          <select value={f.kyc} onChange={(e) => set({ kyc: e.target.value })} className={INPUT}>
            <option value="">{tc('all')}</option>
            {KYC_STATUSES.map((s) => <option key={s} value={s}>{tk(s)}</option>)}
          </select>
        </Labeled>
        <Labeled label={t('orgs.kinds')} className="basis-48">
          <select value={f.kind} onChange={(e) => set({ kind: e.target.value })} className={INPUT}>
            <option value="">{tc('all')}</option>
            {ORG_KINDS.map((k) => <option key={k} value={k}>{tok(k)}</option>)}
          </select>
        </Labeled>
        <button className={BTN}>{tc('apply')}</button>
        <button type="button" className={BTN_GHOST} onClick={reset}>{tc('reset')}</button>
        {data ? <span className="ml-auto font-mono text-xs text-muted">{tc('total', { count: data.total })}</span> : null}
      </Toolbar>

      {err ? <LoadError err={err} onRetry={reload} /> : null}
      <DataTable
        cols={cols} rows={data?.items ?? []} keyOf={(o) => o.id} empty={tc('empty')} loading={loading} screen="orgs"
        onReset={reset}
        sort={f.sort ? { field: f.sort, dir: (f.dir === 'desc' ? 'desc' : 'asc') as SortDir } : undefined}
        onSort={(field, dir) => set({ sort: field, dir })}
        href={(o) => `/admin/orgs/${o.id}`}
        rowMenu={(o) => [
          { label: tb('open'), href: `/admin/orgs/${o.id}` },
          { label: tb('history'), href: `/admin/audit?entity=Organization&entityId=${o.id}` },
          ...(o.slug ? [{ label: tb('storefront'), href: `/k/${o.slug}` }] : []),
        ]}
      />
      <Pager page={f.page} pages={pages} onPage={(p) => set({ page: p })} />
    </>
  );
}
