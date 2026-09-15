'use client';
// Audit jurnali: ilgari faqat yozilardi, hech kim o'qiy olmasdi. "Buni kim qildi" ga javob shu yerda.
// ?entity=Terminal&entityId=... bilan kelsa filtr tayyor turadi: boshqa sahifalar shu havolani beradi.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { uzDateTime } from '@/lib/format';
import { BTN, BTN_GHOST, DataTable, Drawer, INPUT, Labeled, Notice, PageHead, Pager, Toolbar, errText, useAdminList, type Col } from '@/components/admin/kit';

type Actor = { id: string; phone: string; fullName: string | null };
type Row = {
  id: string; actorId: string | null; action: string; entity: string | null; entityId: string | null;
  meta: unknown; ip: string | null; createdAt: string; actor: Actor | null;
};
type ActionCount = { action: string; count: number };

const EMPTY = { action: '', entity: '', entityId: '', actor: '', from: '', to: '' };
const metaText = (m: unknown) => (m == null ? '' : JSON.stringify(m));

/** "admin.terminal.update": prefiks xira, qolgani qalin - ko'z avval nima qilinganini ushlaydi, keyin qaysi modulda. */
function Action({ a }: { a: string }) {
  const i = a.indexOf('.');
  return (
    <span className="font-mono text-xs">
      {i < 0 ? <b>{a}</b> : <><span className="text-muted">{a.slice(0, i + 1)}</span><b>{a.slice(i + 1)}</b></>}
    </span>
  );
}

export default function AuditPage() {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const ta = useTranslations('admin.audit');
  const locale = useLocale();
  // Suspense shart emas: AdminShell huquq tasdiqlanguncha bolalarni chizmaydi, prerender bu hookga yetmaydi
  const sp = useSearchParams();
  const init = { ...EMPTY, entity: sp.get('entity') ?? '', entityId: sp.get('entityId') ?? '' };
  // draft = maydonlardagi matn, f = qo'llangan filtr: har harfda so'rov ketmasin
  const [draft, setDraft] = useState(init);
  const [f, setF] = useState({ ...init, page: 1 });
  const [actions, setActions] = useState<ActionCount[]>([]);
  const [open, setOpen] = useState<Row | null>(null);
  const { data, pages, loading, err } = useAdminList<Row>('/admin/audit', { ...f, limit: 50 });

  useEffect(() => { api<ActionCount[]>('/admin/audit/actions').then(setActions).catch(() => {}); }, []);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  const cols: Col<Row>[] = [
    { key: 'when', head: ta('when'), num: true, width: '1%', cell: (r) => <span className="whitespace-nowrap text-xs">{uzDateTime(r.createdAt, locale)}</span> },
    {
      key: 'actor', head: ta('actor'), cell: (r) => r.actor
        ? <><div className="font-semibold text-navy">{r.actor.fullName || r.actor.phone}</div><div className="font-mono text-[11px] text-muted">{r.actor.phone}</div></>
        : <span className="text-muted">{ta('system')}</span>,
    },
    { key: 'action', head: ta('action'), cell: (r) => <Action a={r.action} /> },
    {
      key: 'entity', head: ta('entity'), cell: (r) => <>
        <div>{r.entity ?? ''}</div>
        {r.entityId ? <div className="font-mono text-[11px] text-muted">{r.entityId}</div> : null}
      </>,
    },
    {
      key: 'meta', head: ta('meta'), cell: (r) => {
        const s = metaText(r.meta);
        return <span className="font-mono text-[11px] text-muted">{s.length > 80 ? `${s.slice(0, 80)}...` : s}</span>;
      },
    },
  ];

  return (
    <>
      <PageHead title={t('nav.audit')} lead={ta('lead')} />

      <Toolbar onSubmit={() => setF({ ...draft, page: 1 })}>
        <Labeled label={ta('action')} className="w-full sm:w-56">
          <select className={INPUT} value={draft.action} onChange={set('action')}>
            <option value="">{ta('allActions')}</option>
            {actions.map((a) => <option key={a.action} value={a.action}>{a.action} ({a.count})</option>)}
          </select>
        </Labeled>
        <Labeled label={ta('entity')} className="w-full sm:w-36">
          <input className={INPUT} value={draft.entity} onChange={set('entity')} />
        </Labeled>
        <Labeled label={t('audit.entityId')} className="w-full sm:w-56">
          <input className={`${INPUT} font-mono`} value={draft.entityId} onChange={set('entityId')} />
        </Labeled>
        <Labeled label={ta('actor')} className="w-full sm:w-56">
          <input className={`${INPUT} font-mono`} value={draft.actor} onChange={set('actor')} />
        </Labeled>
        <Labeled label={ta('from')} className="w-full sm:w-40">
          <input type="date" className={INPUT} value={draft.from} onChange={set('from')} />
        </Labeled>
        <Labeled label={ta('to')} className="w-full sm:w-40">
          <input type="date" className={INPUT} value={draft.to} onChange={set('to')} />
        </Labeled>
        <button type="submit" className={BTN}>{tc('apply')}</button>
        <button type="button" className={BTN_GHOST} onClick={() => { setDraft(EMPTY); setF({ ...EMPTY, page: 1 }); }}>{tc('reset')}</button>
      </Toolbar>

      {err ? <Notice tone="err">{errText(err, (k) => t(k), t.has, tc('loadFailed'))}</Notice> : null}
      <p className="mt-3 text-sm text-muted">{loading ? tc('loading') : tc('total', { count: data?.total ?? 0 })}</p>

      <DataTable cols={cols} rows={data?.items ?? []} keyOf={(r) => r.id} empty={tc('empty')} onRow={setOpen} />
      <Pager page={f.page} pages={pages} onPage={(page) => setF((x) => ({ ...x, page }))} />

      <Drawer open={!!open} title={open?.action ?? ''} onClose={() => setOpen(null)}>
        {open ? (
          <dl className="space-y-3 text-sm">
            <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{ta('when')}</dt><dd className="font-mono">{uzDateTime(open.createdAt, locale)}</dd></div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{ta('actor')}</dt>
              <dd>{open.actor ? <>{open.actor.fullName || open.actor.phone} <span className="font-mono text-xs text-muted">{open.actor.phone}</span></> : <span className="text-muted">{ta('system')}</span>}</dd>
              {open.actorId ? <dd className="font-mono text-[11px] text-muted">{open.actorId}</dd> : null}
            </div>
            <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{ta('action')}</dt><dd><Action a={open.action} /></dd></div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{ta('entity')}</dt>
              <dd>{open.entity ?? tc('none')}</dd>
              {open.entityId ? <dd className="font-mono text-[11px] text-muted">{open.entityId}</dd> : null}
            </div>
            {open.ip ? <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t('audit.ip')}</dt><dd className="font-mono text-xs">{open.ip}</dd></div> : null}
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{ta('meta')}</dt>
              <dd>
                {open.meta == null
                  ? <span className="text-muted">{tc('none')}</span>
                  : <pre className="mt-1 overflow-x-auto rounded-xl border border-line bg-white p-3 font-mono text-xs">{JSON.stringify(open.meta, null, 2)}</pre>}
              </dd>
            </div>
          </dl>
        ) : null}
      </Drawer>
    </>
  );
}
