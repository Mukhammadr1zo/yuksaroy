'use client';
/**
 * Yon tomondagi reklamalar: platformaning o'zi sotadi va shu yerdan joylaydi.
 *
 * Ko'rish operatorga ham ochiq (u matnni tekshiradi), yaratish va o'zgartirish faqat
 * egada: bu sotuv va pul. Server ham shunday, bu yerdagi yashirish faqat ishlamaydigan
 * tugmani ko'rsatmaslik uchun.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { AD_PLACEMENTS, AD_STATUSES, type AdPlacement, type AdStatus } from '@yuksaroy/domain';
import { usePathname, useRouter } from '@/i18n/navigation';
import { api, authHeaders, post } from '@/lib/api';
import { num, uzDate } from '@/lib/format';
import { AuditLink, BTN, BTN_GHOST, type Col, ConfirmButton, DataTable, Drawer, INPUT, Labeled, Notice, PageHead, Pill, Toolbar, errText } from '@/components/admin/kit';
import { useAdminMe } from '@/components/admin/context';

type Ad = {
  id: string; placement: AdPlacement; title: string; body: string | null; imageUrl: string | null; href: string;
  buyer: string | null; pricePaidSom: number; status: AdStatus; startsAt: string; endsAt: string;
};
/** Sanoq serverdan keladi: 30 kunlik va butun davr uchun ko'rildi/bosildi. */
type Stats = { views: number; clicks: number; views30: number; clicks30: number };
type Row = Ad & { stats?: Stats };
type Draft = Omit<Ad, 'id'>;

const ZERO: Stats = { views: 0, clicks: 0, views30: 0, clicks30: 0 };
/**
 * Bosish ulushi: 30 kunlik bosish 30 kunlik ko'rishga nisbatan, bitta kasr.
 * Ko'rish bo'lmasa foiz ham yo'q (nolga bo'lish emas, chiziqcha).
 */
const ctr = (s: Stats) => (s.views30 ? `${((s.clicks30 / s.views30) * 100).toFixed(1)} %` : '-');

/** Banner fayli: rasm, harakatlanuvchi rasm va ovozsiz video. Server ham shu ro'yxatni tekshiradi. */
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm';
const isVideo = (url: string) => /\.(mp4|webm)(\?|#|$)/i.test(url);

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

  const [rows, setRows] = useState<Row[] | null>(null);
  const [f, setF] = useState({ placement: '', status: '' });
  // Qobiqdan: /auth/me qayta so'ralmaydi
  const { isOwner } = useAdminMe();
  const [sheet, setSheet] = useState<{ id: string | null; d: Draft; s?: Stats } | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [upBusy, setUpBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]);
    api<Row[]>(`/admin/ads?${qs}`).then(setRows).catch((e) => setNote({ tone: 'err', text: errText(e, t, t.has, tc('loadFailed')) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.placement, f.status]);

  useEffect(() => { load(); }, [load]);

  // ?new=1 (tez amallar, paleta, bosh sahifa) yaratish varag'ini ochadi, faqat egaga (operatorda tugma ham yo'q);
  // param darhol olib tashlanadi, aks holda yopib qayta yuklaganda varaq yana ochilardi
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (sp.get('new') !== '1') return;
    if (isOwner) { setNote(null); setSheet({ id: null, d: NEW() }); }
    router.replace(pathname, { scroll: false });
  }, [sp, pathname, router, isOwner]);

  const set = (p: Partial<Draft>) => setSheet((s) => (s ? { ...s, d: { ...s.d, ...p } } : s));

  /**
   * Banner faylini yuklash: brend rasm yoki qisqa video beradi, havola emas.
   *
   * To'g'ridan-to'g'ri fetch: api() JSON yuboradi, bu yerda esa multipart kerak.
   */
  async function upload(f: File | undefined) {
    if (!f) return;
    setUpBusy(true);
    setNote(null);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await fetch('/api/v1/admin/ads/media', { method: 'POST', body: fd, credentials: 'include', headers: authHeaders() });
      const b = await res.json().catch(() => null);
      if (!res.ok) throw Object.assign(new Error('upload'), { code: b?.code });
      set({ imageUrl: b.url });
    } catch (e) { setNote({ tone: 'err', text: errText(e, t, t.has, tc('saveFailed')) }); } finally {
      setUpBusy(false);
      if (file.current) file.current.value = '';
    }
  }

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

  /**
   * Sanoq katagi: katta son 30 kunlik (sotuvda gap shu haqda ketadi), ostida jami.
   * Ikkalasi bitta elementda: telefonda katak flex bo'lib, ikki bola yonma yon tushardi.
   *
   * Oyna nomi sarlavhada emas, shu yerda: sarlavha nowrap va "Ko'rildi, 30 kun" uchta
   * ustunda jadvalni 1280 px oynadan chiqarib yuborardi (karta xl da aylanmaydi, ya'ni
   * butun sahifa yon tomonga surilardi). Bu qator esa sondan tor.
   *
   * ponytail: 1280 px da ruscha sarlavhalar va juda uzun havola bilan jadval yana bir
   * necha piksel oshib ketishi mumkin; chiqish yo'li Ustunlar menyusi (screen="ads").
   * Muammo takrorlansa "Muddati" ustunini sukut bo'yicha yashirin qilish kerak.
   */
  const statCell = (big: number, all: number) => (
    <span className="block">
      <span className="block font-semibold text-navy">{num(big, locale)}</span>
      <span className="block text-[11px] text-muted">{ta('total30')}</span>
      <span className="block text-[11px] text-muted">{ta('totalAll')} {num(all, locale)}</span>
    </span>
  );

  /**
   * Nega hozir ko'rinmayapti. null bo'lsa ko'rinadi.
   * Joyning o'zi ham sabab bo'ladi: yon ustun tor ekranda umuman chizilmaydi, buni
   * panelda aytmasa operator "reklama ishlamayapti" deb o'ylaydi.
   */
  const why = (r: Row): 'draft' | 'soon' | 'over' | null => {
    if (r.status !== 'ACTIVE') return 'draft';
    const now = Date.now();
    if (new Date(r.startsAt).getTime() > now) return 'soon';
    if (new Date(r.endsAt).getTime() <= now) return 'over';
    return null;
  };

  const cols: Col<Row>[] = [
    { key: 'title', head: ta('title'), cell: (r) => <><div className="font-semibold text-navy">{r.title}</div><div className="truncate font-mono text-[11px] text-muted">{r.href}</div></> },
    { key: 'placement', head: ta('placement'), cell: (r) => ta(`place.${r.placement}`) },
    // Holat yonida sabab: "faol" deb turgan reklama muddati boshlanmagani uchun
    // ko'rinmasligi mumkin edi va buni panelda bilib bo'lmasdi
    { key: 'status', head: tc('status'), cell: (r) => {
      const w = why(r);
      return (
        <div className="min-w-0">
          <Pill tone={w ? 'warn' : 'ok'}>{w ? ta(`why.${w}`) : ta('why.live')}</Pill>
          {r.status !== 'ACTIVE' ? null : w === 'soon' ? <div className="mt-0.5 text-[11px] text-muted">{uzDate(r.startsAt, locale)}</div> : null}
        </div>
      );
    } },
    { key: 'views', head: ta('views'), num: true, cell: (r) => statCell((r.stats ?? ZERO).views30, (r.stats ?? ZERO).views) },
    { key: 'clicks', head: ta('clicks'), num: true, cell: (r) => statCell((r.stats ?? ZERO).clicks30, (r.stats ?? ZERO).clicks) },
    { key: 'ctr', head: ta('ctr'), num: true, cell: (r) => ctr(r.stats ?? ZERO) },
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
      {/* Obuna qoidasi eslatma sifatida: egasi o'z hisobida ko'rmay "reklama ishlamayapti" deb o'ylagan edi */}
      <p className="mt-1 text-xs text-muted">{ta('subNote')}</p>

      {/* screen: boshqa keng jadvallar kabi Ustunlar menyusi chiqsin, operator keraksiz ustunni yashira olsin */}
      <DataTable cols={cols} rows={rows ?? []} keyOf={(r) => r.id} empty={tc('empty')} screen="ads" onRow={isOwner ? (r) => { setNote(null); setSheet({ id: r.id, d: { ...r }, s: r.stats ?? ZERO }); } : undefined} />

      {/* Har son yonida qaror: bu uch ustun nimani hal qilishini aytadi, aks holda son bezak bo'lib qoladi */}
      <p className="mt-2 text-xs text-muted">{ta('decision.views')} {ta('decision.clicks')} {ta('decision.ctr')}</p>

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
            {/* Sanoq faqat tahrirda: yangi reklamada hali ko'rilgan ham, bosilgan ham yo'q */}
            {sheet.id && sheet.s ? (
              <div className="rounded-xl border border-line p-3">
                {sheet.s.views || sheet.s.clicks ? (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        [`${ta('views')}, ${ta('total30')}`, num(sheet.s.views30, locale), `${ta('totalAll')} ${num(sheet.s.views, locale)}`],
                        [`${ta('clicks')}, ${ta('total30')}`, num(sheet.s.clicks30, locale), `${ta('totalAll')} ${num(sheet.s.clicks, locale)}`],
                        [ta('ctr'), ctr(sheet.s), ta('total30')],
                      ].map(([head, big, small]) => (
                        <div key={head}>
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{head}</div>
                          <div className="font-mono text-lg font-semibold tabular-nums text-navy">{big}</div>
                          <div className="font-mono text-[11px] text-muted">{small}</div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted">{ta('decision.views')} {ta('decision.clicks')} {ta('decision.ctr')}</p>
                  </>
                ) : <p className="text-xs text-muted">{ta('noData')}</p>}
              </div>
            ) : null}
            <Labeled label={ta('placement')} className="block">
              <select className={INPUT} value={sheet.d.placement} onChange={(e) => set({ placement: e.target.value as AdPlacement })}>
                {AD_PLACEMENTS.map((p) => opt(p, ta(`place.${p}`)))}
              </select>
            </Labeled>
            {/* Joy tanlangach darhol: qaysi sahifada va qaysi ekranda chiqadi.
                Egasi bannerni qo'yib, boshqa sahifaga qarab "chiqmadi" degan edi. */}
            <p className="-mt-1 text-xs text-muted">{ta(`placeHint.${sheet.d.placement}`)}</p>
            <Labeled label={ta('title')} className="block">
              <input className={INPUT} value={sheet.d.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} />
            </Labeled>
            <Labeled label={ta('body')} className="block">
              <input className={INPUT} value={sheet.d.body ?? ''} maxLength={200} onChange={(e) => set({ body: e.target.value })} />
            </Labeled>
            <Labeled label={ta('href')} className="block">
              <input className={INPUT} value={sheet.d.href} maxLength={500} onChange={(e) => set({ href: e.target.value })} placeholder="https://" />
            </Labeled>
            <Labeled label={ta('media')} className="block">
              <input ref={file} type="file" accept={ACCEPT} className={INPUT} disabled={upBusy} onChange={(e) => upload(e.target.files?.[0])} />
            </Labeled>
            <p className="text-xs text-muted">{ta('mediaHint')}</p>
            {upBusy ? <p className="text-xs text-muted">{tc('loading')}</p> : null}
            {sheet.d.imageUrl ? (
              <div className="flex items-start gap-3 rounded-xl border border-line p-3">
                {isVideo(sheet.d.imageUrl)
                  ? <video src={sheet.d.imageUrl} muted playsInline loop autoPlay className="h-24 w-24 rounded-lg object-cover" />
                  // eslint-disable-next-line @next/next/no-img-element
                  : <img src={sheet.d.imageUrl} alt="" className="h-24 w-24 rounded-lg object-cover" />}
                <button type="button" className={BTN_GHOST} onClick={() => set({ imageUrl: '' })}>{ta('mediaRemove')}</button>
              </div>
            ) : null}
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
