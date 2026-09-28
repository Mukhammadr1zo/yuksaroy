'use client';
// Audit jurnali: ilgari faqat yozilardi, hech kim o'qiy olmasdi. "Buni kim qildi" ga javob shu yerda.
// Obyekt turi va ID bo'yicha qo'lda filtr yo'q: ular baza modelining inglizcha nomini
// harfma-harf yozishni talab qilardi, qabul qilinadigan so'zlar ro'yxati hech qayerda
// ko'rsatilmasdi va bir harf xato jimgina nol natija berardi. Havola bilan kelgan
// ?entity= va ?entityId= esa ishlayveradi: kelajakda qatordan jurnalga o'tish uchun.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { uzDateTime } from '@/lib/format';
import { BTN, BTN_GHOST, DataTable, Drawer, INPUT, Labeled, Notice, PageHead, Pager, Toolbar, errText, useActionText, useAdminList, type Col } from '@/components/admin/kit';

type Actor = { id: string; phone: string; fullName: string | null };
type Row = {
  id: string; actorId: string | null; action: string; entity: string | null; entityId: string | null;
  meta: unknown; ip: string | null; createdAt: string; actor: Actor | null;
};
type ActionCount = { action: string; count: number };

const EMPTY = { action: '', entity: '', entityId: '', actor: '', from: '', to: '' };

export default function AuditPage() {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const ta = useTranslations('admin.audit');
  const locale = useLocale();
  // Suspense shart emas: AdminShell huquq tasdiqlanguncha bolalarni chizmaydi, prerender bu hookga yetmaydi
  const sp = useSearchParams();
  // actor ham URL dan: foydalanuvchi varag'idagi "uning amallari" havolasi shu yerga keladi
  const init = { ...EMPTY, entity: sp.get('entity') ?? '', entityId: sp.get('entityId') ?? '', actor: sp.get('actor') ?? '' };
  // draft = maydonlardagi matn, f = qo'llangan filtr: har harfda so'rov ketmasin
  const [draft, setDraft] = useState(init);
  const [f, setF] = useState({ ...init, page: 1 });
  const [actions, setActions] = useState<ActionCount[]>([]);
  const [open, setOpen] = useState<Row | null>(null);
  const actionText = useActionText();
  const { data, pages, loading, err } = useAdminList<Row>('/admin/audit', { ...f, limit: 50 });

  useEffect(() => { api<ActionCount[]>('/admin/audit/actions').then(setActions).catch(() => {}); }, []);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  // Obyekt ustuni olindi: u baza modelining inglizcha nomini ("Listing", "Organization")
  // ko'rsatardi, endi gapning o'zi nima ustida ish qilinganini aytadi.
  const cols: Col<Row>[] = [
    { key: 'when', head: ta('when'), num: true, width: '1%', cell: (r) => <span className="whitespace-nowrap text-xs">{uzDateTime(r.createdAt, locale)}</span> },
    {
      key: 'actor', head: ta('actor'), cell: (r) => r.actor
        ? <><div className="font-semibold text-navy">{r.actor.fullName || r.actor.phone}</div><div className="font-mono text-[11px] text-muted">{r.actor.phone}</div></>
        : <span className="text-muted">{ta('system')}</span>,
    },
    { key: 'action', head: ta('action'), cell: (r) => actionText(r.action, r.meta) },
  ];

  return (
    <>
      <PageHead title={t('nav.audit')} lead={ta('lead')} />

      <Toolbar onSubmit={() => setF({ ...draft, page: 1 })}>
        <Labeled label={ta('action')} className="w-full sm:w-56">
          <select className={INPUT} value={draft.action} onChange={set('action')}>
            <option value="">{ta('allActions')}</option>
            {actions.map((a) => <option key={a.action} value={a.action}>{actionText(a.action, null)} ({a.count})</option>)}
          </select>
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

      <Drawer open={!!open} title={open ? actionText(open.action, open.meta) : ''} onClose={() => setOpen(null)}>
        {open ? (
          <dl className="space-y-3 text-sm">
            <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{ta('when')}</dt><dd className="font-mono">{uzDateTime(open.createdAt, locale)}</dd></div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{ta('actor')}</dt>
              <dd>{open.actor ? <>{open.actor.fullName || open.actor.phone} <span className="font-mono text-xs text-muted">{open.actor.phone}</span></> : <span className="text-muted">{ta('system')}</span>}</dd>
            </div>
            <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{ta('action')}</dt><dd>{actionText(open.action, open.meta)} <span className="font-mono text-[11px] text-muted">{open.action}</span></dd></div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{ta('entity')}</dt>
              <dd>{open.entity ? (ta.has(`ent.${open.entity}`) ? ta(`ent.${open.entity}`) : open.entity) : tc('none')}</dd>
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
