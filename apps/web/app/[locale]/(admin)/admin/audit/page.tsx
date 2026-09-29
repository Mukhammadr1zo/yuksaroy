'use client';
// Audit jurnali: ilgari faqat yozilardi, hech kim o'qiy olmasdi. "Buni kim qildi" ga javob shu yerda.
// Filtrlar URL da (useListQuery): orqaga tugmasi filtrni qaytaradi, havola ulashiladi.
// Obyekt turi va ID bo'yicha qo'lda katak yo'q: ular baza modelining inglizcha nomini
// harfma-harf yozishni talab qilardi va bir harf xato jimgina nol natija berardi.
// Havola bilan kelgan ?entity= va ?entityId= (qatordagi "Tarix") esa ishlaydi va
// filtr sifatida ko'rinib turadi, bir bosishda olib tashlanadi.
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { BTN, BTN_GHOST, INPUT, Labeled, PageHead, Pill, Toolbar, useActionText, useListQuery } from '@/components/admin/kit';
import { AuditFeed } from '@/components/admin/AuditFeed';

type ActionCount = { action: string; count: number };

const F0 = { action: '', entity: '', entityId: '', actor: '', from: '', to: '', page: 1 };
type Draft = Pick<typeof F0, 'action' | 'actor' | 'from' | 'to'>;
const pick = (f: typeof F0): Draft => ({ action: f.action, actor: f.actor, from: f.from, to: f.to });

export default function AuditPage() {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const ta = useTranslations('admin.audit');
  const { f, set, reset } = useListQuery(F0);
  // draft = kataklardagi matn, f = qo'llangan filtr (URL): har harfda so'rov ketmasin
  const [draft, setDraft] = useState<Draft>(() => pick(f));
  useEffect(() => { setDraft(pick(f)); }, [f]);
  const [actions, setActions] = useState<ActionCount[]>([]);
  const actionText = useActionText();

  useEffect(() => { api<ActionCount[]>('/admin/audit/actions').then(setActions).catch(() => {}); }, []);

  const edit = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const entityLabel = f.entity ? (ta.has(`ent.${f.entity}`) ? ta(`ent.${f.entity}`) : f.entity) : '';

  return (
    <>
      <PageHead title={t('nav.audit')} lead={ta('lead')} />

      <Toolbar onSubmit={() => set({ ...draft })}>
        <Labeled label={ta('action')} className="w-full sm:w-56">
          <select className={INPUT} value={draft.action} onChange={edit('action')}>
            <option value="">{ta('allActions')}</option>
            {actions.map((a) => <option key={a.action} value={a.action}>{actionText(a.action, null)} ({a.count})</option>)}
          </select>
        </Labeled>
        <Labeled label={ta('actor')} className="w-full sm:w-56">
          <input className={`${INPUT} font-mono`} value={draft.actor} onChange={edit('actor')} data-search="1" />
        </Labeled>
        <Labeled label={ta('from')} className="w-full sm:w-40">
          <input type="date" className={INPUT} value={draft.from} onChange={edit('from')} />
        </Labeled>
        <Labeled label={ta('to')} className="w-full sm:w-40">
          <input type="date" className={INPUT} value={draft.to} onChange={edit('to')} />
        </Labeled>
        <button type="submit" className={BTN}>{tc('apply')}</button>
        <button type="button" className={BTN_GHOST} onClick={reset}>{tc('reset')}</button>
      </Toolbar>

      {/* Havoladan kelgan obyekt filtri: ko'rinib tursin va olib tashlash mumkin bo'lsin */}
      {f.entity || f.entityId ? (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <Pill>{entityLabel} <span className="font-mono">{f.entityId}</span></Pill>
          <button type="button" onClick={() => set({ entity: '', entityId: '' })} className="font-semibold text-teal-ink hover:underline">{tc('reset')}</button>
        </p>
      ) : null}

      <AuditFeed entity={f.entity || undefined} entityId={f.entityId || undefined} actor={f.actor || undefined} action={f.action || undefined}
        from={f.from || undefined} to={f.to || undefined} limit={50} page={f.page} onPage={(page) => set({ page })} />
    </>
  );
}
