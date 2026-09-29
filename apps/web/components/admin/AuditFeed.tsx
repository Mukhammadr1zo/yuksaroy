'use client';
/**
 * Audit lentasi: jurnal sahifasi ham, obyekt sahifalaridagi Tarix yorlig'i ham shundan.
 * Uch ustun (qachon, kim, nima) va qatorga bosilganda tafsilot varag'i (meta JSON).
 * Filtrlar tashqaridan: jurnal sahifasi ularni URL dan beradi, obyekt sahifasi
 * entity/entityId ni, foydalanuvchi sahifasi actor ni.
 *
 * Sahifa raqami ikki rejimda: `page`/`onPage` berilsa tashqarida (jurnalda URL),
 * berilmasa ichkarida (Tarix yorlig'ida URL band, u ?tab= ni saqlaydi).
 */
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { uzDateTime } from '@/lib/format';
import { BTN_GHOST, DataTable, Drawer, Notice, Pager, errText, useActionText, useAdminList, type Col } from './kit';

type Actor = { id: string; phone: string; fullName: string | null };
type Row = {
  id: string; actorId: string | null; action: string; entity: string | null; entityId: string | null;
  meta: unknown; ip: string | null; createdAt: string; actor: Actor | null;
};

export function AuditFeed({ entity, entityId, actor, action, from, to, limit = 50, pager = true, page, onPage }: {
  entity?: string; entityId?: string; actor?: string; action?: string; from?: string; to?: string;
  limit?: number; pager?: boolean;
  page?: number; onPage?: (page: number) => void;
}) {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const ta = useTranslations('admin.audit');
  const tt = useTranslations('admin.table');
  const locale = useLocale();
  const actionText = useActionText();
  const [inner, setInner] = useState(1);
  const cur = page ?? inner;
  const go = onPage ?? setInner;
  // Filtr o'zgarsa ichki sahifa boshiga: eski raqam yangi ro'yxatda hech nimani anglatmaydi
  useEffect(() => { setInner(1); }, [entity, entityId, actor, action, from, to]);

  const [open, setOpen] = useState<Row | null>(null);
  const { data, pages, loading, err, reload } = useAdminList<Row>('/admin/audit', { entity, entityId, actor, action, from, to, page: cur, limit });

  // Obyekt ustuni yo'q: gapning o'zi nima ustida ish qilinganini aytadi, model nomi tafsilotda
  const cols: Col<Row>[] = [
    { key: 'when', head: ta('when'), num: true, width: '1%', cell: (r) => <span className="whitespace-nowrap text-xs">{uzDateTime(r.createdAt, locale)}</span> },
    {
      key: 'actor', head: ta('actor'), cell: (r) => r.actor
        ? <><div className="font-semibold text-navy">{r.actor.fullName || r.actor.phone}</div><div className="font-mono text-[11px] text-muted">{r.actor.phone}</div></>
        : <span className="text-muted">{ta('system')}</span>,
    },
    { key: 'action', head: ta('action'), cell: (r) => actionText(r.action, r.meta) },
  ];
  const H = 'text-[11px] font-semibold uppercase tracking-wide text-muted';

  return (
    <div>
      {err ? (
        <div className="flex flex-wrap items-center gap-2">
          <Notice tone="err">{errText(err, t, t.has, tc('loadFailed'))}</Notice>
          <button type="button" onClick={() => void reload()} className={`${BTN_GHOST} mt-3`}>{tt('retry')}</button>
        </div>
      ) : null}
      <p className="mt-3 font-mono text-xs text-muted">{loading && !data ? tc('loading') : tc('total', { count: data?.total ?? 0 })}</p>

      <DataTable cols={cols} rows={data?.items ?? []} keyOf={(r) => r.id} empty={ta('feedEmpty')} loading={loading} onRow={setOpen} />
      {pager ? <Pager page={cur} pages={pages} onPage={go} /> : null}

      <Drawer open={!!open} title={open ? actionText(open.action, open.meta) : ''} onClose={() => setOpen(null)}>
        {open ? (
          <dl className="space-y-3 text-sm">
            <div><dt className={H}>{ta('when')}</dt><dd className="font-mono">{uzDateTime(open.createdAt, locale)}</dd></div>
            <div>
              <dt className={H}>{ta('actor')}</dt>
              <dd>{open.actor ? <>{open.actor.fullName || open.actor.phone} <span className="font-mono text-xs text-muted">{open.actor.phone}</span></> : <span className="text-muted">{ta('system')}</span>}</dd>
            </div>
            <div><dt className={H}>{ta('action')}</dt><dd>{actionText(open.action, open.meta)} <span className="font-mono text-[11px] text-muted">{open.action}</span></dd></div>
            <div>
              <dt className={H}>{ta('entity')}</dt>
              <dd>{open.entity ? (ta.has(`ent.${open.entity}`) ? ta(`ent.${open.entity}`) : open.entity) : tc('none')}</dd>
              {open.entityId ? <dd className="font-mono text-[11px] text-muted">{open.entityId}</dd> : null}
            </div>
            {open.ip ? <div><dt className={H}>{ta('ip')}</dt><dd className="font-mono text-xs">{open.ip}</dd></div> : null}
            <div>
              <dt className={H}>{ta('meta')}</dt>
              <dd>
                {open.meta == null
                  ? <span className="text-muted">{tc('none')}</span>
                  : <pre className="mt-1 overflow-x-auto rounded-xl border border-line bg-white p-3 font-mono text-xs">{JSON.stringify(open.meta, null, 2)}</pre>}
              </dd>
            </div>
          </dl>
        ) : null}
      </Drawer>
    </div>
  );
}
