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
import { AD_BOTTOM, AD_BOTTOM_DEFAULTS, AD_LOCALES, AD_PLACEMENTS, AD_STATUSES, type AdPlacement, type AdStatus } from '@yuksaroy/domain';
import { usePathname, useRouter } from '@/i18n/navigation';
import { api, authHeaders, post } from '@/lib/api';
import { num, uzDate } from '@/lib/format';
import { AuditLink, BTN, BTN_GHOST, type Col, ConfirmButton, DataTable, Drawer, INPUT, Labeled, Notice, PageHead, Pill, Toolbar, errText } from '@/components/admin/kit';
import { useAdminMe } from '@/components/admin/context';
// isVideo shu yerdan: ko'rsatish va kichik nusxa bitta qoidadan yursin, ikki joyda yozilmasin
import { AdPreview } from '@/components/admin/AdPreview';
import { isVideo } from '@/components/site/AdSlot';

type Ad = {
  id: string; placement: AdPlacement; title: string; body: string | null; imageUrl: string | null; href: string;
  buyer: string | null; pricePaidSom: number; status: AdStatus; startsAt: string; endsAt: string;
  /**
   * Bu to'rttasi faqat pastki banner uchun ishlaydi: u o'zi chiqib, o'zi ketadigan yagona joy.
   * locale bo'sh bo'lsa hamma tilda chiqadi; banner yozuvi rasm ichida bo'lgani uchun
   * aks holda o'zbekcha banner ruscha sahifada ham chiqib qolardi.
   */
  delaySec: number; showSec: number; quietHours: number; locale: string | null;
};
/** Sanoq serverdan keladi: 30 kunlik va butun davr uchun ko'rildi/bosildi/yopildi. */
type Stats = { views: number; clicks: number; views30: number; clicks30: number; closes: number; closes30: number };
type Row = Ad & { stats?: Stats };
type Draft = Omit<Ad, 'id'>;

const ZERO: Stats = { views: 0, clicks: 0, views30: 0, clicks30: 0, closes: 0, closes30: 0 };
/**
 * Bosish ulushi: 30 kunlik bosish 30 kunlik ko'rishga nisbatan, bitta kasr.
 * Ko'rish bo'lmasa foiz ham yo'q (nolga bo'lish emas, chiziqcha).
 */
const ctr = (s: Stats) => (s.views30 ? `${((s.clicks30 / s.views30) * 100).toFixed(1)} %` : '-');

/** Banner fayli: rasm, harakatlanuvchi rasm va ovozsiz video. Server ham shu ro'yxatni tekshiradi. */
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm';

/** Fayl yonidagi qoidalar: shu tartibda ko'rinadi, matni tarjimada. */
const RULES = ['fakeClose', 'fakeUi', 'lookAlike', 'sound', 'flash', 'harm', 'http'] as const;

/** Til nomi o'z tilida: profil sahifasidagidek, tarjima kaliti kerak emas. */
const LOCALE_LABEL: Record<string, string> = { uz: "O'zbekcha", ru: 'Русский', en: 'English' };

const day = (d: Date) => d.toISOString().slice(0, 10);
const NEW = (): Draft => ({
  placement: 'terminal-aside', title: '', body: '', imageUrl: '', href: '',
  buyer: '', pricePaidSom: 0, status: 'DRAFT',
  startsAt: day(new Date()), endsAt: day(new Date(Date.now() + 30 * 86_400_000)),
  // Sukut qiymat domain dan: panel, server va sahifa bitta sondan yursin, uchta joyda yozilmasin
  ...AD_BOTTOM_DEFAULTS, locale: '',
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
  const [preview, setPreview] = useState(false);
  /*
   * Varaq yopilganda ko'rsatish ham to'xtaydi: aks holda varaqni keyin ochganda banner
   * so'ralmagan holda o'zi chiqib kelardi.
   * Bog'liqlikda sheet emas, ochiqligi: sheet har harfda yangi obyekt bo'ladi va u yerda
   * turganda sarlavhani tahrirlash ko'rsatishni yarim yo'lda uzib qo'yardi.
   */
  const sheetOpen = !!sheet;
  useEffect(() => { if (!sheetOpen) setPreview(false); }, [sheetOpen]);

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
  // Varaqdagi to'rtta maydon va ikkita eslatma faqat pastki bannerda ma'noli
  const bottom = sheet?.d.placement === AD_BOTTOM;
  // Ko'rsatish uchun media shart: tugma ham, AdPreview ham shu bitta qiymatdan yuradi
  const media = sheet?.d.imageUrl?.trim() ?? '';

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
      // Uchtasi har doim yuboriladi: joyni keyin pastki bannerga o'zgartirganda son yo'q bo'lib
      // qolmasin. Kechikish va turish muddatida 0 haqiqiy qiymat (darhol chiqadi, o'zi
      // yopilmaydi), jim vaqtda esa yo'q: maydon bo'shatilsa server qaytarib yuborardi,
      // shuning uchun u sukut qiymatga tushadi.
      delaySec: Number(d.delaySec) || 0, showSec: Number(d.showSec) || 0,
      quietHours: Number(d.quietHours) || AD_BOTTOM_DEFAULTS.quietHours,
      // Bo'sh til - hamma til. undefined emas, null: undefined bo'lsa maydon so'rovdan
      // tushib qolardi va ilgari tanlangan til bazada o'chmay qolardi.
      locale: d.locale?.trim() || null,
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
    // Yopildi faqat pastki bannerda bor: boshqa joylarda yopish tugmasi yo'q, nol son yolg'on bo'lardi
    { key: 'closes', head: ta('closes'), num: true, cell: (r) => (r.placement === AD_BOTTOM ? statCell((r.stats ?? ZERO).closes30, (r.stats ?? ZERO).closes) : '') },
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

      {/* Har son yonida qaror: bu ustunlar nimani hal qilishini aytadi, aks holda son bezak bo'lib qoladi */}
      <p className="mt-2 text-xs text-muted">{ta('decision.views')} {ta('decision.clicks')} {ta('decision.ctr')} {ta('decision.closes')}</p>

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
            {/* Pastki bannerda fayl ham, matn ham shart: ekranda faqat rasm ko'rinadi, matn esa
                ekran o'quvchi uchun yagona tavsif. Bittasi bo'sh banner foydasiz chiqardi. */}
            <button type="button" className={BTN} disabled={busy || !sheet.d.title.trim() || !sheet.d.href.trim() || (bottom && (!sheet.d.body?.trim() || !sheet.d.imageUrl?.trim()))} onClick={save}>{sheet.id ? tc('save') : tc('create')}</button>
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
                    {/* To'rtinchi katak qo'shilganda uchta ustun telefonda juda torayardi */}
                    <div className={`grid gap-3 ${bottom ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                      {[
                        [`${ta('views')}, ${ta('total30')}`, num(sheet.s.views30, locale), `${ta('totalAll')} ${num(sheet.s.views, locale)}`],
                        [`${ta('clicks')}, ${ta('total30')}`, num(sheet.s.clicks30, locale), `${ta('totalAll')} ${num(sheet.s.clicks, locale)}`],
                        [ta('ctr'), ctr(sheet.s), ta('total30')],
                        // Yopildi faqat pastki bannerda: boshqa joylarda yopish tugmasining o'zi yo'q
                        ...(bottom ? [[`${ta('closes')}, ${ta('total30')}`, num(sheet.s.closes30, locale), `${ta('totalAll')} ${num(sheet.s.closes, locale)}`]] : []),
                      ].map(([head, big, small]) => (
                        <div key={head}>
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{head}</div>
                          <div className="font-mono text-lg font-semibold tabular-nums text-navy">{big}</div>
                          <div className="font-mono text-[11px] text-muted">{small}</div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted">{ta('decision.views')} {ta('decision.clicks')} {ta('decision.ctr')}{bottom ? ` ${ta('decision.closes')}` : ''}</p>
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
            {/* Yorliq o'zgarmaydi (boshqa joylarda bu ikkisi ko'rinadigan matn), faqat pastki
                banner uchun ostiga bir qator: u yerda ikkisi ham ekranda chizilmaydi */}
            {bottom ? <p className="-mt-1 text-xs text-muted">{ta('bottomTitleHint')}</p> : null}
            <Labeled label={ta('body')} className="block">
              <input className={INPUT} value={sheet.d.body ?? ''} maxLength={200} onChange={(e) => set({ body: e.target.value })} />
            </Labeled>
            {bottom ? <p className="-mt-1 text-xs text-muted">{ta('bottomBodyHint')}</p> : null}
            <Labeled label={ta('href')} className="block">
              <input className={INPUT} value={sheet.d.href} maxLength={500} onChange={(e) => set({ href: e.target.value })} placeholder="https://" />
            </Labeled>
            <Labeled label={ta('media')} className="block">
              <input ref={file} type="file" accept={ACCEPT} className={INPUT} disabled={upBusy} onChange={(e) => upload(e.target.files?.[0])} />
            </Labeled>
            <p className="text-xs text-muted">{ta('mediaHint')}</p>
            {/* Qoidalar fayl tanlash yonida va har doim ochiq: yig'ilgan ro'yxat o'qilmaydi,
                bu yerda esa fayl tanlashdan oldin o'qilishi kerak. Oxirgi qator ogohlantirish:
                chaqnashni kod tekshira olmaydi. bg-white: varaqning o'zi bg-sand, ya'ni sand
                quti ko'rinmay ketardi. */}
            <div className="rounded-xl border border-line bg-white p-3">
              <p className="text-xs font-semibold text-navy">{ta('rules.head')}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted">
                {RULES.map((k) => <li key={k}>{ta(`rules.${k}`)}</li>)}
              </ul>
              <p className="mt-2 text-xs font-semibold text-navy">{ta('rules.tail')}</p>
            </div>
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
            {/* Faqat pastki banner uchun: yon ustun doim ko'rinib turadi, u yerda "necha
                soniyada chiqadi" degan son yolg'on bo'lardi. Eslatmalar Labeled ichida emas,
                yonida: label ichidagi matn maydonning ekran o'quvchidagi nomiga qo'shilib ketardi. */}
            {bottom ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    {/* Chegaralar server tekshiruvi bilan bitta: aks holda panel qabul qilgan
                        son saqlashda xato bo'lib qaytardi */}
                    <Labeled label={ta('delaySec')} className="block">
                      <input type="number" min={0} max={120} className={INPUT} value={sheet.d.delaySec} onChange={(e) => set({ delaySec: Number(e.target.value) })} />
                    </Labeled>
                    <p className="mt-1 text-xs text-muted">{ta('delayHint')}</p>
                  </div>
                  <div>
                    <Labeled label={ta('showSec')} className="block">
                      <input type="number" min={0} max={300} className={INPUT} value={sheet.d.showSec} onChange={(e) => set({ showSec: Number(e.target.value) })} />
                    </Labeled>
                    <p className="mt-1 text-xs text-muted">{ta('showHint')}</p>
                  </div>
                  <div>
                    <Labeled label={ta('quietHours')} className="block">
                      <input type="number" min={1} max={168} className={INPUT} value={sheet.d.quietHours} onChange={(e) => set({ quietHours: Number(e.target.value) })} />
                    </Labeled>
                    <p className="mt-1 text-xs text-muted">{ta('quietHint')}</p>
                  </div>
                </div>
                <div>
                  <Labeled label={ta('locale')} className="block">
                    <select className={INPUT} value={sheet.d.locale ?? ''} onChange={(e) => set({ locale: e.target.value })}>
                      {opt('', ta('localeAll'))}{AD_LOCALES.map((l) => opt(l, LOCALE_LABEL[l] ?? l))}
                    </select>
                  </Labeled>
                  <p className="mt-1 text-xs text-muted">{ta('localeHint')}</p>
                </div>
                {/* Uch sonning tagida: egasi sonni o'zgartirib, shu yerda his qiladi.
                    Media bo'lmasa tugma o'chirilgan: ko'rsatadigan narsa yo'q. */}
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className={BTN_GHOST} disabled={!media} onClick={() => setPreview(!preview)}>
                    {preview ? ta('previewStop') : ta('preview')}
                  </button>
                  {!media
                    ? <span className="text-xs text-muted">{ta('previewNeedMedia')}</span>
                    : preview
                      ? <AdPreview url={media} delaySec={sheet.d.delaySec} showSec={sheet.d.showSec} onDone={() => setPreview(false)} />
                      : <span className="text-xs text-muted">{ta('previewNote')}</span>}
                </div>
              </>
            ) : null}
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
