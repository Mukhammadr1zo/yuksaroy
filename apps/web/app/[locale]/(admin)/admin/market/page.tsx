'use client';
// Admin: yuk bozori va xizmatlar markazi. Ikki jadval: so'rovlar (yuk va xizmat) va
// xizmat ko'rsatuvchi profillar. Admin ko'radi va kerak bo'lsa yashiradi (so'rov bekor
// qilinadi, profil HIDDEN bo'ladi); har amal auditga tushadi.
// Yorliq va so'rov filtrlari URL da: buyruq paleti SR-/CR- raqamini /admin/market?q= bilan ochadi.
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MARKET_BOARDS, MARKET_STATUSES, SERVICE_TYPES, SERVICE_TYPE_LABELS, type SearchLang } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { post } from '@/lib/api';
import { uzDate, uzDateTime } from '@/lib/format';
import { BTN, BTN_DANGER, BTN_GHOST, ConfirmButton, DataTable, INPUT, Labeled, LoadError, PageHead, Pager, Pill, Toolbar, useAdminList, useListQuery } from '@/components/admin/kit';

type Board = (typeof MARKET_BOARDS)[number];
type Tab = 'requests' | 'profiles';
type Req = {
  id: string; no: string; board: Board; serviceType: string | null; regionCode: string | null; fromRegion: string | null; toRegion: string | null;
  cargoName: string | null; weightT: number | null; loadDate: string | null; title: string; status: string; createdBy: string | null;
  contactPhone: string | null; offersCount: number; isDemo: boolean; createdAt: string;
};
type Profile = {
  id: string; serviceType: string; title: string; owner: string | null; regions: string[]; status: string;
  contactPhone: string | null; isDemo: boolean; createdAt: string;
};

const SM = 'px-3 py-1 text-xs';
const REQ0 = { q: '', board: '', status: 'OPEN', page: 1 };

export default function AdminMarketPage() {
  const t = useTranslations('admin');
  const tm = useTranslations('admin.market');
  const tr = useTranslations('region');
  const locale = useLocale();
  const lang = (locale === 'ru' || locale === 'en' ? locale : 'uz') as SearchLang;
  // Yorliq URL da: paleta ?q= bilan kelganda so'rovlar yorlig'i ochilsin (sukut), profillar emas
  const { f, set } = useListQuery({ tab: 'requests' });
  const tab: Tab = f.tab === 'profiles' ? 'profiles' : 'requests';
  const region = (c: string | null) => (c && tr.has(c) ? tr(c) : c ?? '-');
  const svc = (s: string | null) => (s ? SERVICE_TYPE_LABELS[lang][s as keyof (typeof SERVICE_TYPE_LABELS)['uz']] ?? s : '-');

  return (
    <>
      <PageHead title={t('nav.market')} lead={tm('lead')} />
      <div className="mt-5 flex flex-wrap gap-2">
        {(['requests', 'profiles'] as Tab[]).map((k) => (
          <button key={k} type="button" aria-pressed={tab === k} onClick={() => set({ tab: k })}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors duration-150 ${tab === k ? 'bg-navy text-white' : 'border border-line bg-white text-muted hover:border-teal hover:text-ink'}`}>
            {tm(`tabs.${k}`)}
          </button>
        ))}
      </div>
      {tab === 'requests' ? <Requests region={region} svc={svc} /> : <Profiles region={region} svc={svc} />}
    </>
  );
}

function Requests({ region, svc }: { region: (c: string | null) => string; svc: (s: string | null) => string }) {
  const tc = useTranslations('admin.common');
  const tm = useTranslations('admin.market');
  const locale = useLocale();
  const { f, set, reset } = useListQuery(REQ0);
  const list = useAdminList<Req>('/admin/market/requests', f);
  const [q, setQ] = useState(f.q);
  useEffect(() => setQ(f.q), [f.q]);

  const cols = [
    { key: 'no', head: tm('col.no'), cell: (r: Req) => (
      <>
        <Link href={r.board === 'CARGO' ? `/cargo/${r.no}` : `/services/requests/${r.no}`} target="_blank" className="font-mono text-xs text-teal-ink underline">{r.no}</Link>
        {r.isDemo ? <Pill tone="neutral">{tm('demo')}</Pill> : null}
      </>
    ) },
    { key: 'title', head: tc('name'), cell: (r: Req) => <span className="font-semibold">{r.title}</span> },
    { key: 'what', head: tm('col.what'), cell: (r: Req) => (r.board === 'CARGO'
      ? <span className="text-sm">{region(r.fromRegion)} {'->'} {region(r.toRegion)}{r.weightT ? <span className="ml-1 font-mono text-xs text-muted">{r.weightT} t</span> : null}</span>
      : <span className="text-sm">{svc(r.serviceType)} <span className="font-mono text-xs text-muted">{region(r.regionCode)}</span></span>) },
    { key: 'status', head: tc('status'), cell: (r: Req) => <Pill tone={r.status === 'OPEN' ? 'ok' : r.status === 'AWARDED' ? 'warn' : 'neutral'}>{tm(`status.${r.status}`)}</Pill> },
    { key: 'by', head: tm('col.by'), cell: (r: Req) => <span>{r.createdBy ?? '-'}{r.contactPhone ? <span className="block font-mono text-[11px] text-muted">{r.contactPhone}</span> : null}</span> },
    { key: 'offers', head: tm('col.offers'), num: true, cell: (r: Req) => r.offersCount },
    { key: 'date', head: tm('col.date'), num: true, cell: (r: Req) => (r.loadDate ? uzDate(r.loadDate, locale) : uzDateTime(r.createdAt, locale)) },
    { key: 'actions', head: tc('actions'), hideable: false, cell: (r: Req) => (r.status === 'OPEN'
      ? <ConfirmButton label={tm('hide')} confirm={tm('hideConfirm')} className={`${BTN_DANGER} ${SM}`} onRun={async () => { await post(`/admin/market/requests/${r.id}/hide`, {}); await list.reload(); }} />
      : <span className="text-muted">-</span>) },
  ];

  return (
    <>
      <Toolbar onSubmit={() => set({ q: q.trim() })}>
        <Labeled label={tm('searchNo')} className="w-44">
          <input data-search="1" value={q} onChange={(e) => setQ(e.target.value)} maxLength={20} className={`${INPUT} font-mono`} />
        </Labeled>
        <Labeled label={tm('col.board')} className="w-44">
          <select value={f.board} onChange={(e) => set({ board: e.target.value })} className={INPUT}>
            <option value="">{tm('board.all')}</option>
            {MARKET_BOARDS.map((b) => <option key={b} value={b}>{tm(`board.${b}`)}</option>)}
          </select>
        </Labeled>
        <Labeled label={tc('status')} className="w-44">
          <select value={f.status} onChange={(e) => set({ status: e.target.value })} className={INPUT}>
            {MARKET_STATUSES.map((s) => <option key={s} value={s}>{tm(`status.${s}`)}</option>)}
          </select>
        </Labeled>
        <button type="submit" className={BTN}>{tc('apply')}</button>
        <button type="button" className={BTN_GHOST} onClick={reset}>{tc('reset')}</button>
        {list.data ? <span className="ml-auto font-mono text-xs text-muted">{tc('total', { count: list.data.total })}</span> : null}
      </Toolbar>
      {list.err ? <LoadError err={list.err} onRetry={list.reload} /> : null}
      <DataTable cols={cols} rows={list.data?.items ?? []} keyOf={(r) => r.id} empty={tm('empty')} loading={list.loading} onReset={reset} />
      <Pager page={f.page} pages={list.pages} onPage={(p) => set({ page: p })} />
    </>
  );
}

function Profiles({ region, svc }: { region: (c: string | null) => string; svc: (s: string | null) => string }) {
  const tc = useTranslations('admin.common');
  const tm = useTranslations('admin.market');
  const locale = useLocale();
  // Profillar filtri mahalliy: paleta bu yerga olib kelmaydi, URL da faqat yorliq
  const [type, setType] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [page, setPage] = useState(1);
  const list = useAdminList<Profile>('/admin/services/profiles', { type, status, page });

  const cols = [
    { key: 'title', head: tc('name'), cell: (p: Profile) => (
      <>
        <Link href={`/services/${p.id}`} target="_blank" className="font-semibold text-teal-ink underline">{p.title}</Link>
        {p.isDemo ? <Pill tone="neutral">{tm('demo')}</Pill> : null}
      </>
    ) },
    { key: 'type', head: tm('col.type'), cell: (p: Profile) => svc(p.serviceType) },
    { key: 'owner', head: tm('col.by'), cell: (p: Profile) => <span>{p.owner ?? '-'}{p.contactPhone ? <span className="block font-mono text-[11px] text-muted">{p.contactPhone}</span> : null}</span> },
    { key: 'regions', head: tc('region'), cell: (p: Profile) => (p.regions.length ? p.regions.map(region).join(', ') : tm('allRegions')) },
    { key: 'status', head: tc('status'), cell: (p: Profile) => <Pill tone={p.status === 'ACTIVE' ? 'ok' : 'neutral'}>{tm(`profileStatus.${p.status}`)}</Pill> },
    { key: 'date', head: tm('col.date'), num: true, cell: (p: Profile) => uzDateTime(p.createdAt, locale) },
    { key: 'actions', head: tc('actions'), hideable: false, cell: (p: Profile) => (p.status === 'ACTIVE'
      ? <ConfirmButton label={tm('hide')} confirm={tm('hideConfirm')} className={`${BTN_DANGER} ${SM}`} onRun={async () => { await post(`/admin/services/profiles/${p.id}/hide`, {}); await list.reload(); }} />
      : <span className="text-muted">-</span>) },
  ];

  return (
    <>
      <Toolbar onSubmit={() => setPage(1)}>
        <Labeled label={tm('col.type')} className="w-52">
          <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className={INPUT}>
            <option value="">{tm('board.all')}</option>
            {SERVICE_TYPES.map((s) => <option key={s} value={s}>{svc(s)}</option>)}
          </select>
        </Labeled>
        <Labeled label={tc('status')} className="w-44">
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={INPUT}>
            {(['ACTIVE', 'HIDDEN', 'BLOCKED'] as const).map((s) => <option key={s} value={s}>{tm(`profileStatus.${s}`)}</option>)}
          </select>
        </Labeled>
        {list.data ? <span className="ml-auto font-mono text-xs text-muted">{tc('total', { count: list.data.total })}</span> : null}
      </Toolbar>
      {list.err ? <LoadError err={list.err} onRetry={list.reload} /> : null}
      <DataTable cols={cols} rows={list.data?.items ?? []} keyOf={(p) => p.id} empty={tm('empty')} loading={list.loading} />
      <Pager page={page} pages={list.pages} onPage={setPage} />
    </>
  );
}
