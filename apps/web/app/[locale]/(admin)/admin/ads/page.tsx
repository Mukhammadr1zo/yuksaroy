'use client';
/**
 * Yon tomondagi reklamalar: platformaning o'zi sotadi va shu yerdan joylaydi.
 *
 * Ko'rish operatorga ham ochiq (u matnni tekshiradi), yaratish va o'zgartirish faqat
 * egada: bu sotuv va pul. Server ham shunday, bu yerdagi yashirish faqat ishlamaydigan
 * tugmani ko'rsatmaslik uchun.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AD_PLACEMENTS, AD_STATUSES, type AdPlacement, type AdStatus } from '@yuksaroy/domain';
import { api, post } from '@/lib/api';
import { num, uzDate } from '@/lib/format';
import type { Me } from '@/lib/types-auth';
import { AuditLink, BTN, BTN_GHOST, type Col, ConfirmButton, DataTable, Drawer, INPUT, Labeled, Notice, PageHead, Pill, Toolbar, errText } from '@/components/admin/kit';

type Ad = {
  id: string; placement: AdPlacement; title: string; body: string | null; imageUrl: string | null; href: string;
  buyer: string | null; pricePaidSom: number; status: AdStatus; startsAt: string; endsAt: string;
};
type Draft = Omit<Ad, 'id'>;

const day = (d: Date) => d.toISOString().slice(0, 10);
const NEW = (): Draft => ({
  placement: 'terminal-aside', title: '', body: '', imageUrl: '', href: '',
  buyer: '', pricePaidSom: 0, status: 'DRAFT',
  startsAt: day(new Date()), endsAt: day(new Date(Date.now() + 30 * 86_400_000)),
});

export default function AdminAdsPage() {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const ta = useTranslations('admin.ads');
  const locale = useLocale();

  const [rows, setRows] = useState<Ad[] | null>(null);
  const [f, setF] = useState({ placement: '', status: '' });
  const [isOwner, setIsOwner] = useState(false);
  const [sheet, setSheet] = useState<{ id: string | null; d: Draft } | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]);
    api<Ad[]>(`/admin/ads?${qs}`).then(setRows).catch((e) => setNote({ tone: 'err', text: errText(e, t, t.has, tc('loadFailed')) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.placement, f.status]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api<Me>('/auth/me').then((m) => setIsOwner(!!m.isPlatformOwner)).catch(() => {}); }, []);

  const set = (p: Partial<Draft>) => setSheet((s) => (s ? { ...s, d: { ...s.d, ...p } } : s));

  async function save() {
    if (!sheet) return;
    setBusy(true);
    setNote(null);
    const d = sheet.d;
    // Bo'sh matnlar yuborilmaydi: bazada null qolsin, bo'sh qator emas
    const body = {
      placement: d.placement, title: d.title.trim(), href: d.href.trim(), status: d.status,
      startsAt: new Date(d.startsAt).toISOString(), endsAt: new Date(d.endsAt).toISOString(),
      body: d.body?.trim() || undefined, imageUrl: d.imageUrl?.trim() || undefined,
      buyer: d.buyer?.trim() || undefined, pricePaidSom: Number(d.pricePaidSom) || 0,
    };
    try {
      if (sheet.id) await api(`/admin/ads/${sheet.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await post('/admin/ads', body);
      setSheet(null);
      setNote({ tone: 'ok', text: tc('saved') });
      load();
    } catch (e) { setNote({ tone: 'err', text: errText(e, t, t.has, tc('saveFailed')) }); } finally { setBusy(false); }
  }

  async function remove() {
    if (!sheet?.id) return;
    try {
      await api(`/admin/ads/${sheet.id}`, { method: 'DELETE' });
      setSheet(null);
      setNote({ tone: 'ok', text: tc('deleted') });
      load();
    } catch (e) { setNote({ tone: 'err', text: errText(e, t, t.has, tc('deleteFailed')) }); }
  }

  const cols: Col<Ad>[] = [
    { key: 'title', head: ta('title'), cell: (r) => <><div className="font-semibold text-navy">{r.title}</div><div className="truncate font-mono text-[11px] text-muted">{r.href}</div></> },
    { key: 'placement', head: ta('placement'), cell: (r) => ta(`place.${r.placement}`) },
    { key: 'status', head: tc('status'), cell: (r) => <Pill tone={r.status === 'ACTIVE' ? 'ok' : 'neutral'}>{ta(`st.${r.status}`)}</Pill> },
    { key: 'range', head: ta('range'), cell: (r) => <span className="font-mono text-xs">{uzDate(r.startsAt, locale)} - {uzDate(r.endsAt, locale)}</span> },
    { key: 'buyer', head: ta('buyer'), cell: (r) => r.buyer ?? '' },
    { key: 'price', head: ta('price'), num: true, cell: (r) => (r.pricePaidSom ? num(r.pricePaidSom, locale) : '') },
  ];

  const opt = (v: string, label: string) => <option key={v} value={v}>{label}</option>;

  return (
    <div>
      <PageHead title={t('nav.ads')} lead={ta('lead')}>
        {isOwner ? <button type="button" className={BTN} onClick={() => { setNote(null); setSheet({ id: null, d: NEW() }); }}>{ta('new')}</button> : null}
      </PageHead>

      <Toolbar onSubmit={load}>
        <Labeled label={ta('placement')} className="w-full sm:w-52">
          <select className={INPUT} value={f.placement} onChange={(e) => setF({ ...f, placement: e.target.value })}>
            {opt('', tc('all'))}{AD_PLACEMENTS.map((p) => opt(p, ta(`place.${p}`)))}
          </select>
        </Labeled>
        <Labeled label={tc('status')} className="w-full sm:w-40">
          <select className={INPUT} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            {opt('', tc('all'))}{AD_STATUSES.map((s) => opt(s, ta(`st.${s}`)))}
          </select>
        </Labeled>
      </Toolbar>

      {note && !sheet ? <Notice tone={note.tone}>{note.text}</Notice> : null}
      <p className="mt-4 font-mono text-xs text-muted">{rows === null ? tc('loading') : tc('total', { count: rows.length })}</p>
      <p className="mt-1 text-xs text-muted">{ta('note')}</p>

      <DataTable cols={cols} rows={rows ?? []} keyOf={(r) => r.id} empty={tc('empty')} onRow={isOwner ? (r) => { setNote(null); setSheet({ id: r.id, d: { ...r } }); } : undefined} />

      <Drawer
        open={!!sheet}
        title={sheet?.id ? sheet.d.title : ta('new')}
        onClose={() => setSheet(null)}
        footer={sheet ? (
          <>
            {note ? <div className="w-full"><Notice tone={note.tone}>{note.text}</Notice></div> : null}
            {sheet.id ? (
              <div className="mr-auto flex flex-col items-start gap-1">
                <AuditLink entity="AdPlacement" id={sheet.id} />
                <ConfirmButton label={tc('delete')} confirm={tc('confirm')} onRun={remove} />
              </div>
            ) : null}
            <button type="button" className={BTN_GHOST} onClick={() => setSheet(null)}>{tc('cancel')}</button>
            <button type="button" className={BTN} disabled={busy || !sheet.d.title.trim() || !sheet.d.href.trim()} onClick={save}>{sheet.id ? tc('save') : tc('create')}</button>
          </>
        ) : null}
      >
        {sheet ? (
          <div className="space-y-3">
            <Labeled label={ta('placement')} className="block">
              <select className={INPUT} value={sheet.d.placement} onChange={(e) => set({ placement: e.target.value as AdPlacement })}>
                {AD_PLACEMENTS.map((p) => opt(p, ta(`place.${p}`)))}
              </select>
            </Labeled>
            <Labeled label={ta('title')} className="block">
              <input className={INPUT} value={sheet.d.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} />
            </Labeled>
            <Labeled label={ta('body')} className="block">
              <input className={INPUT} value={sheet.d.body ?? ''} maxLength={200} onChange={(e) => set({ body: e.target.value })} />
            </Labeled>
            <Labeled label={ta('href')} className="block">
              <input className={INPUT} value={sheet.d.href} maxLength={500} onChange={(e) => set({ href: e.target.value })} placeholder="https://" />
            </Labeled>
            <Labeled label={ta('imageUrl')} className="block">
              <input className={INPUT} value={sheet.d.imageUrl ?? ''} maxLength={500} onChange={(e) => set({ imageUrl: e.target.value })} />
            </Labeled>
            <div className="grid gap-3 sm:grid-cols-2">
              <Labeled label={ta('startsAt')} className="block">
                <input type="date" className={INPUT} value={sheet.d.startsAt.slice(0, 10)} onChange={(e) => set({ startsAt: e.target.value })} />
              </Labeled>
              <Labeled label={ta('endsAt')} className="block">
                <input type="date" className={INPUT} value={sheet.d.endsAt.slice(0, 10)} onChange={(e) => set({ endsAt: e.target.value })} />
              </Labeled>
            </div>
            <Labeled label={tc('status')} className="block">
              <select className={INPUT} value={sheet.d.status} onChange={(e) => set({ status: e.target.value as AdStatus })}>
                {AD_STATUSES.map((s) => opt(s, ta(`st.${s}`)))}
              </select>
            </Labeled>
            {/* Sotuv ma'lumoti faqat panelda: ommaviy javobda u yo'q */}
            <Labeled label={ta('buyer')} className="block">
              <input className={INPUT} value={sheet.d.buyer ?? ''} maxLength={200} onChange={(e) => set({ buyer: e.target.value })} />
            </Labeled>
            <Labeled label={ta('price')} className="block">
              <input type="number" min={0} className={INPUT} value={sheet.d.pricePaidSom} onChange={(e) => set({ pricePaidSom: Number(e.target.value) })} />
            </Labeled>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
