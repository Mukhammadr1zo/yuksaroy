'use client';
// Stansiya reestri. Asosiy ish: koordinatasi yo'q stansiyalarni topib, qiymatini kiritish.
// Ilgari bu bir martalik skriptlar bilan qilinardi; endi qator ichida yoziladi, varaq ochilmaydi.
import { useCallback, useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes } from 'react';
import { useTranslations } from 'next-intl';
import { RJUS, type Rju } from '@yuksaroy/domain';
import { api, post } from '@/lib/api';
import { BTN, BTN_GHOST, type Col, ConfirmButton, DataTable, Drawer, INPUT, Labeled, Notice, PageHead, Pager, Pill, Toolbar, errText, useAdminList } from '@/components/admin/kit';

type Row = {
  id: string; esrCode: string | null; nameUz: string; nameRu: string | null; nameEn: string | null; rju: Rju;
  isListed: boolean; lat: number | null; lng: number | null; _count: { terminals: number };
};
/** PATCH/POST javobi: stansiyaning o'zi, `_count` siz. */
type Saved = Omit<Row, '_count'>;

type Form = {
  nameUz: string; nameRu: string; nameEn: string; esrCode: string; rju: string;
  lat: string; lng: string; isListed: boolean;
};
const EMPTY: Form = { nameUz: '', nameRu: '', nameEn: '', esrCode: '', rju: '', lat: '', lng: '', isListed: true };
const toForm = (r: Row): Form => ({
  nameUz: r.nameUz, nameRu: r.nameRu ?? '', nameEn: r.nameEn ?? '', esrCode: r.esrCode ?? '', rju: r.rju,
  lat: r.lat == null ? '' : String(r.lat), lng: r.lng == null ? '' : String(r.lng), isListed: r.isListed,
});
const NUM = new Set<keyof Form>(['lat', 'lng']);
/** Tahrirda faqat o'zgargan kalitlar (bo'sh = null, ustun tozalanadi), yaratishda faqat to'ldirilganlari. */
function payload(form: Form, orig: Form | null) {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(form) as (keyof Form)[]) {
    const v = form[k];
    if (orig ? v === orig[k] : v === '') continue;
    out[k] = typeof v === 'boolean' ? v : v === '' ? null : NUM.has(k) ? Number(v) : v;
  }
  return out;
}

// Jadval ichidagi tugma va maydon: kit'dagi kattalari qator balandligini ikki baravar qilib yuboradi
const SM = 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold transition duration-150 active:scale-[0.98] disabled:opacity-60';
const BTN_SM = `${SM} bg-teal text-white hover:bg-teal-ink`;
const INPUT_SM = 'w-24 rounded-lg border border-line bg-white px-2 py-1 font-mono text-xs tabular-nums outline-none focus:border-teal focus:ring-2 focus:ring-teal/25';

/** Koordinatasi yo'q qator: ikki maydon va saqlash, varaqsiz. Enter ham saqlaydi. */
function CoordCell({ row, onSaved }: { row: Row; onSaved: (s: Saved) => void }) {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const ts = useTranslations('admin.stations');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Google Maps "41.3111, 69.2797" ko'rinishida nusxalaydi: vergul bo'lsa ikki maydonga o'zimiz bo'lamiz,
  // odam qo'lda kesib yurmasin. Shu sababli type="number" emas: u vergulli qatorni butunlay tashlab yuboradi.
  const onLat = (v: string) => {
    const [a, b] = v.split(',');
    if (b !== undefined) { setLat(a.trim()); setLng(b.trim()); } else setLat(v);
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const la = Number(lat), ln = Number(lng);
    if (!lat || !lng || !Number.isFinite(la) || !Number.isFinite(ln)) return;
    setBusy(true); setErr(null);
    try { onSaved(await api<Saved>(`/admin/catalog/stations/${row.id}`, { method: 'PATCH', body: JSON.stringify({ lat: la, lng: ln }) })); }
    catch (e) { setErr(errText(e, t, t.has, tc('saveFailed'))); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="flex flex-wrap items-center gap-1">
      <Pill tone="bad">{ts('noCoords')}</Pill>
      <input value={lat} onChange={(e) => onLat(e.target.value)} inputMode="decimal" placeholder={ts('lat')} aria-label={ts('lat')} className={INPUT_SM} />
      <input value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal" placeholder={ts('lng')} aria-label={ts('lng')} className={INPUT_SM} />
      <button type="submit" disabled={busy || !lat || !lng} className={BTN_SM}>{tc('save')}</button>
      {err ? <span className="text-xs text-red-700">{err}</span> : null}
    </form>
  );
}

export default function AdminStationsPage() {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const ts = useTranslations('admin.stations');
  const tr = useTranslations('rju');
  const [f, setF] = useState({ q: '', rju: '', listed: '', coords: '', page: 1 });
  const [q, setQ] = useState('');
  const { data, pages, loading, err, reload } = useAdminList<Row>('/admin/catalog/stations', { ...f, limit: 50 });
  // Mahalliy nusxa: qator ichida saqlangan koordinata shu yerda almashadi, ro'yxat qayta so'ralmaydi
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => setRows(data?.items ?? []), [data]);
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const flash = (tone: 'ok' | 'err', text: string) => {
    setNote({ tone, text });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(null), 3000);
  };

  const [dr, setDr] = useState<{ row: Row | null; form: Form } | null>(null);
  const [dMsg, setDMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const close = useCallback(() => { setDr(null); setDMsg(null); }, []);
  const open = (row: Row | null) => { setDMsg(null); setDr({ row, form: row ? toForm(row) : EMPTY }); };
  const set = (k: keyof Form, v: string | boolean) => setDr((d) => d && { ...d, form: { ...d.form, [k]: v } });

  const inlineSaved = (s: Saved) => {
    setRows((rs) => rs.map((r) => (r.id === s.id ? { ...r, ...s } : r)));
    flash('ok', tc('saved'));
  };

  async function save() {
    if (!dr) return;
    const body = payload(dr.form, dr.row ? toForm(dr.row) : null);
    setDMsg(null); setBusy(true);
    try {
      if (dr.row) {
        if (Object.keys(body).length) {
          const s = await api<Saved>(`/admin/catalog/stations/${dr.row.id}`, { method: 'PATCH', body: JSON.stringify(body) });
          setDr({ row: { ...dr.row, ...s }, form: dr.form });
          void reload();
        }
        setDMsg({ tone: 'ok', text: tc('saved') });
      } else {
        await post('/admin/catalog/stations', body);
        close();
        flash('ok', tc('created'));
        void reload();
      }
    } catch (e) { setDMsg({ tone: 'err', text: errText(e, t, t.has, tc('saveFailed')) }); } finally { setBusy(false); }
  }

  async function remove() {
    if (!dr?.row) return;
    try {
      await api(`/admin/catalog/stations/${dr.row.id}`, { method: 'DELETE' });
      close();
      flash('ok', tc('deleted'));
      void reload();
    } catch (e) { setDMsg({ tone: 'err', text: errText(e, t, t.has, tc('saveFailed')) }); }
  }

  const cols: Col<Row>[] = [
    { key: 'name', head: tc('name'), cell: (r) => (
      <div className="min-w-0">
        <div className="font-semibold text-navy">{r.nameUz}</div>
        {r.nameRu ? <div className="text-xs text-muted">{r.nameRu}</div> : null}
      </div>
    ) },
    { key: 'esr', head: ts('esr'), num: true, cell: (r) => r.esrCode ?? '' },
    { key: 'rju', head: ts('rju'), cell: (r) => tr(r.rju) },
    { key: 'coords', head: ts('coords'), width: '20rem', cell: (r) => (
      r.lat != null && r.lng != null
        ? <span className="font-mono tabular-nums">{r.lat.toFixed(4)}, {r.lng.toFixed(4)}</span>
        : <CoordCell row={r} onSaved={inlineSaved} />
    ) },
    { key: 'listed', head: ts('listed'), cell: (r) => (r.isListed ? <Pill tone="ok">{ts('listed')}</Pill> : null) },
    { key: 'terminals', head: ts('terminals'), num: true, cell: (r) => r._count.terminals },
  ];

  const F = dr?.form ?? EMPTY;
  const text = (k: 'nameUz' | 'nameRu' | 'nameEn' | 'esrCode', label: string, extra: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Labeled label={label}><input className={INPUT} value={F[k]} onChange={(e) => set(k, e.target.value)} {...extra} /></Labeled>
  );
  // Koordinatasi yo'q rejimida "necha qoldi" soni: qator ichida to'g'rilanganlari darrov ayiriladi
  const left = data ? data.total - (f.coords === '0' ? rows.filter((r) => r.lat != null).length : 0) : 0;

  return (
    <div>
      <PageHead title={t('nav.stations')} lead={ts('lead')}>
        <button type="button" className={BTN} onClick={() => open(null)}>{ts('new')}</button>
      </PageHead>

      <Toolbar onSubmit={() => setF({ ...f, q, page: 1 })}>
        <Labeled label={tc('search')} className="min-w-[200px] flex-1">
          <input className={INPUT} value={q} onChange={(e) => setQ(e.target.value)} />
        </Labeled>
        <Labeled label={ts('rju')}>
          <select className={INPUT} value={f.rju} onChange={(e) => setF({ ...f, rju: e.target.value, page: 1 })}>
            <option value="">{tc('all')}</option>
            {RJUS.map((r) => <option key={r} value={r}>{tr(r)}</option>)}
          </select>
        </Labeled>
        <Labeled label={ts('listed')}>
          <select className={INPUT} value={f.listed} onChange={(e) => setF({ ...f, listed: e.target.value, page: 1 })}>
            <option value="">{tc('all')}</option>
            <option value="1">{ts('listed')}</option>
            <option value="0">{ts('notListed')}</option>
          </select>
        </Labeled>
        <label className="flex items-center gap-2 py-2 text-sm font-semibold text-navy">
          <input type="checkbox" className="accent-teal" checked={f.coords === '0'} onChange={(e) => setF({ ...f, coords: e.target.checked ? '0' : '', page: 1 })} />
          {ts('noCoords')}
        </label>
        <button type="submit" className={BTN}>{tc('apply')}</button>
        <button type="button" className={BTN_GHOST} onClick={() => { setQ(''); setF({ q: '', rju: '', listed: '', coords: '', page: 1 }); }}>{tc('reset')}</button>
      </Toolbar>

      {loading ? <p className="mt-4 text-sm text-muted">{tc('loading')}</p>
        : err ? <Notice tone="err">{tc('loadFailed')}</Notice>
        : data && f.coords === '0'
          ? <p className="mt-4 font-display text-2xl font-bold text-navy">{tc('total', { count: left })} <span className="text-sm font-normal text-muted">{ts('noCoords')}</span></p>
          : data ? <p className="mt-4 font-mono text-xs text-muted">{tc('total', { count: data.total })}</p> : null}
      {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}

      <DataTable cols={cols} rows={rows} keyOf={(r) => r.id} empty={tc('empty')} onRow={open} />
      <Pager page={f.page} pages={pages} onPage={(p) => setF({ ...f, page: p })} />

      <Drawer open={!!dr} title={dr?.row ? dr.row.nameUz : ts('new')} onClose={close}
        footer={dr ? (
          <>
            {dr.row ? (
              <div className="mr-auto flex flex-col items-start gap-1">
                <span className="text-xs text-muted">{ts('deleteWarn')}</span>
                <ConfirmButton label={tc('delete')} confirm={tc('confirm')} onRun={remove} />
              </div>
            ) : null}
            <button type="button" className={BTN_GHOST} onClick={close}>{tc('cancel')}</button>
            <button type="submit" form="station-form" className={BTN} disabled={busy}>{dr.row ? tc('save') : tc('create')}</button>
          </>
        ) : null}>
        {dr ? (
          <form id="station-form" onSubmit={(e) => { e.preventDefault(); void save(); }} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {text('nameUz', ts('nameUz'), { required: true, minLength: 2 })}
            {text('nameRu', ts('nameRu'))}
            {text('nameEn', ts('nameEn'))}
            {text('esrCode', ts('esr'), { pattern: '\\d{5,6}', inputMode: 'numeric', className: `${INPUT} font-mono` })}
            <Labeled label={ts('rju')}>
              <select className={INPUT} value={F.rju} required onChange={(e) => set('rju', e.target.value)}>
                <option value="">-</option>
                {RJUS.map((r) => <option key={r} value={r}>{tr(r)}</option>)}
              </select>
            </Labeled>
            <Labeled label={ts('lat')}><input type="number" step="any" className={`${INPUT} font-mono`} value={F.lat} onChange={(e) => set('lat', e.target.value)} /></Labeled>
            <Labeled label={ts('lng')}><input type="number" step="any" className={`${INPUT} font-mono`} value={F.lng} onChange={(e) => set('lng', e.target.value)} /></Labeled>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-teal" checked={F.isListed} onChange={(e) => set('isListed', e.target.checked)} />{ts('listed')}
            </label>
            {dMsg ? <div className="sm:col-span-2"><Notice tone={dMsg.tone}>{dMsg.text}</Notice></div> : null}
          </form>
        ) : null}
      </Drawer>
    </div>
  );
}
