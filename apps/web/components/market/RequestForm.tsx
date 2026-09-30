'use client';
/**
 * So'rov formasi: yuk (yo'nalish, yuk, og'irlik, sana, kuzov) yoki xizmat (tur, viloyat).
 * Xatolar maydon ostida oddiy so'z bilan.
 *
 * Mehmon ham to'liq formani ko'radi. Ilgari kirmagan odamga forma o'rniga "avval kiring"
 * havolasi chiqardi: platformadagi eng qimmat harakat eng baland devor ortida turardi.
 * Endi tartib teskari: odam yozadi, yuborishni bosadi, va faqat shundan keyin raqamini
 * tasdiqlaydi; kod tasdiqlangan zahoti so'rov o'zi ketadi va sahifa almashmaydi.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PAYMENT_TERMS, REGIONS, SERVICE_TYPES, TRUCK_TYPES, validateRequest, type MarketBoard, type ServiceType } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { ApiError, clearAuthedCache, hasSession, post } from '@/lib/api';
import { uzToday } from '@/lib/format';
import type { FieldErrors, MarketRequest } from '@/lib/types-market';
import { PhoneField } from '@/components/ui/fields';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { PhoneOtp } from '@/components/auth/PhoneOtp';
import { BTN_GHOST, BTN_PRIMARY, Field, INPUT, Notice } from '@/components/kabinet/bits';
import { PhotoUpload } from '@/components/kabinet/PhotoUpload';
import { useMarketLabels } from './bits';
import { CopyLink } from './CopyLink';

const BOT = process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'yuksaroy_bot';

type Draft = {
  title: string; description: string; serviceType: string; regionCode: string;
  fromRegion: string; toRegion: string; fromText: string; toText: string; cargoName: string; weightT: string; loadDate: string; truckType: string;
  volumeM3: string; trucksCount: string; paymentTerm: string; contactPhone: string; photos: string[];
};
const EMPTY: Draft = {
  title: '', description: '', serviceType: '', regionCode: '', fromRegion: '', toRegion: '', fromText: '', toText: '',
  cargoName: '', weightT: '', loadDate: '', truckType: '', volumeM3: '', trucksCount: '', paymentTerm: '', contactPhone: '', photos: [],
};

/**
 * Yozilgan qoralama brauzer yorlig'ida saqlanadi. Hisobi yo'q odamga kod Telegram orqali
 * keladi, ya'ni u brauzerdan chiqib ketadi; telefonda yorliq o'chib qolsa faqat xotirada
 * turgan matn yo'qolardi va aynan birinchi marta kelgan odam ketib qolardi.
 * Kalit taxta bo'yicha ajraydi: ikki forma bir-birini bosmasin.
 */
const DRAFT_KEY = (board: MarketBoard) => `ys-req-${board}`;
const readDraft = (board: MarketBoard): Partial<Draft> => {
  try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY(board)) || '{}') as Partial<Draft>; } catch { return {}; }
};

export function RequestForm({ board, serviceType }: { board: MarketBoard; serviceType?: string }) {
  const t = useTranslations('market.form');
  const te = useTranslations('market.err');
  const L = useMarketLabels();
  const cargo = board === 'CARGO';
  const picked = (SERVICE_TYPES as readonly string[]).includes(serviceType ?? '') ? serviceType! : '';
  const [d, setD] = useState<Draft>(() => {
    const saved = readDraft(board);
    return { ...EMPTY, ...saved, serviceType: picked || saved.serviceType || '' };
  });
  const [needAuth, setNeedAuth] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [top, setTop] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<MarketRequest | null>(null);
  // Har muvaffaqiyatsiz yuborishda oshadi: xatolar to'plami bir xil bo'lsa ham
  // fokus qayta ko'chsin, aks holda ikkinchi urinishda effekt ishlamasdi.
  const [badTry, setBadTry] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  // Fokus xatolar CHIZILGANDAN keyin ko'chadi: setState darhol DOM ga tushmaydi,
  // shu sababli qidiruv effekt ichida, ya'ni aria-invalid allaqachon turgan paytda.
  useEffect(() => {
    if (!badTry) return;
    const f = formRef.current;
    // Rasm yuklagichi guruh bo'lgani uchun unda aria-invalid yo'q: o'sha holatda
    // xato matnidan o'rab turgan yorliqqa chiqib, birinchi boshqaruv olinadi.
    const el = f?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?? f?.querySelector('p[role="alert"]')?.closest('label,[role="group"]')?.querySelector<HTMLElement>('input,select,textarea,button');
    el?.focus();
  }, [badTry]);

  const set = (p: Partial<Draft>) => setD((x) => {
    const v = { ...x, ...p };
    try { sessionStorage.setItem(DRAFT_KEY(board), JSON.stringify(v)); } catch { /* xususiy oynada yozib bo'lmaydi, forma baribir ishlaydi */ }
    return v;
  });
  const err = (k: keyof Draft) => (errors[k] ? te(errors[k]!) : undefined);

  // Yuk e'lonida sarlavha yuborilmaydi: server uni yuk nomi va og'irligidan tuzadi
  const body = () => (cargo
    ? {
        board, description: d.description || undefined,
        fromRegion: d.fromRegion, toRegion: d.toRegion, fromText: d.fromText, toText: d.toText,
        cargoName: d.cargoName, weightT: d.weightT ? Number(d.weightT) : undefined, loadDate: d.loadDate,
        truckType: d.truckType || undefined,
        volumeM3: d.volumeM3 ? Number(d.volumeM3) : undefined,
        trucksCount: d.trucksCount ? Number(d.trucksCount) : undefined,
        paymentTerm: d.paymentTerm || undefined,
        contactPhone: d.contactPhone,
        photos: d.photos,
      }
    : { board, title: d.title, description: d.description, serviceType: d.serviceType, regionCode: d.regionCode, contactPhone: d.contactPhone });

  async function send() {
    setBusy(true); setTop(null);
    try {
      const r = await post<MarketRequest>('/market/requests', body());
      try { sessionStorage.removeItem(DRAFT_KEY(board)); } catch { /* yuborildi, qoralama endi kerak emas */ }
      setDone(r);
    } catch (e) {
      // Ikkinchi marta 401 kelsa kirish qadami ochiq qoladi va sabab yoziladi:
      // odam nega to'xtaganini bilmay qolmasin
      if (e instanceof ApiError && e.status === 401) { if (needAuth) setTop(te('generic')); else setNeedAuth(true); return; }
      setNeedAuth(false);
      // Server ham maydon xatosi qaytarsa fokus xuddi mijoz tekshiruvidagidek ko'chadi
      if (e instanceof ApiError && e.status === 400 && e.body?.errors) { setErrors(e.body.errors as FieldErrors); setBadTry((x) => x + 1); }
      else setTop(e instanceof ApiError && e.status === 429 ? te('RATE_LIMITED') : te('generic'));
    } finally { setBusy(false); }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTop(null);
    // Avval mijozda tekshiriladi: maydonini to'ldirmagan odamdan raqam so'rash ma'nosiz
    const errs = validateRequest(body()) as FieldErrors;
    setErrors(errs);
    // Nechta maydon qolganini yuqorida bitta jumla aytadi: yigirmata inline xato
    // orasidan odam umumiy holatni ko'rmasdi
    const left = Object.keys(errs).length;
    if (left) { setTop(t('errCount', { count: left })); setBadTry((x) => x + 1); return; }
    if (!hasSession()) { setNeedAuth(true); return; }
    void send();
  }

  if (needAuth) {
    return (
      <div className="grid gap-4">
        <Notice tone="warn"><span className="font-semibold">{t('authTitle')}</span> {t('authLead')}</Notice>
        <PhoneOtp submitLabel={t('authSubmit')} initialPhone={d.contactPhone} onDone={() => { clearAuthedCache(); void send(); }} />
        <GoogleButton onLogin={() => { clearAuthedCache(); void send(); }} />
        {busy ? <p className="text-sm text-muted">{t('sending')}</p> : null}
        {top ? <Notice tone="err">{top}</Notice> : null}
        <div><button type="button" disabled={busy} onClick={() => setNeedAuth(false)} className={BTN_GHOST}>{t('authBack')}</button></div>
      </div>
    );
  }
  if (done) {
    const publicHref = cargo ? `/cargo/${done.no}` : `/services/requests/${done.no}`;
    return (
      <div className="grid gap-4">
        <Notice tone="ok"><span className="font-semibold">{t('done', { no: done.no })}</span> {t('doneBody')}</Notice>
        {/* Havola shu yerda: odam uni haydovchiga yuborsa, u kirmasdan holatni ko'radi */}
        {done.statusUrl ? <CopyLink url={done.statusUrl} /> : null}
        {/* Taklif xabari Telegramga boradi: bog'lanmagan odam uni umuman ko'rmay qolardi */}
        {done.telegramLinked === false ? (
          <Notice tone="warn">
            {t('tgHint')}{' '}
            <a href={`https://t.me/${BOT}`} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-4">{t('tgCta')}</a>
          </Notice>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/market?tab=requests&id=${done.id}`} className={BTN_PRIMARY}>{t('viewMine')}</Link>
          <Link href={publicHref} className={BTN_GHOST}>{t('viewPublic')}</Link>
        </div>
      </div>
    );
  }

  const regionOptions = (empty: string) => (
    <>
      <option value="">{empty}</option>
      {REGIONS.map((r) => <option key={r} value={r}>{L.region(r)}</option>)}
    </>
  );

  return (
    <form ref={formRef} onSubmit={submit} className="grid gap-4">
      {cargo ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('fromRegion')} required error={err('fromRegion')}>
              <select className={INPUT} value={d.fromRegion} onChange={(e) => set({ fromRegion: e.target.value })}>{regionOptions(t('regionPick'))}</select>
            </Field>
            <Field label={t('toRegion')} required error={err('toRegion')}>
              <select className={INPUT} value={d.toRegion} onChange={(e) => set({ toRegion: e.target.value })}>{regionOptions(t('regionPick'))}</select>
            </Field>
            <Field label={t('fromText')} error={err('fromText')}><input className={INPUT} maxLength={200} placeholder={t('fromTextPh')} value={d.fromText} onChange={(e) => set({ fromText: e.target.value })} /></Field>
            <Field label={t('toText')} error={err('toText')}><input className={INPUT} maxLength={200} placeholder={t('toTextPh')} value={d.toText} onChange={(e) => set({ toText: e.target.value })} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t('cargoName')} required error={err('cargoName')} className="lg:col-span-2"><input className={INPUT} maxLength={120} placeholder={t('cargoNamePh')} value={d.cargoName} onChange={(e) => set({ cargoName: e.target.value })} /></Field>
            <Field label={t('weightT')} required error={err('weightT')}><input className={`${INPUT} font-mono`} type="number" min={0.1} max={10000} step={0.1} inputMode="decimal" value={d.weightT} onChange={(e) => set({ weightT: e.target.value })} /></Field>
            <Field label={t('loadDate')} required error={err('loadDate')}><input className={`${INPUT} font-mono`} type="date" min={uzToday()} value={d.loadDate} onChange={(e) => set({ loadDate: e.target.value })} /></Field>
          </div>
          {/* Narx aytishga yordam beradigan uch maydon: ularsiz tashuvchi telefonda
              aynan shu uchtasini so'raydi. Hammasi ixtiyoriy, forma og'irlashmasin. */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t('volumeM3')} error={err('volumeM3')}>
              <input className={`${INPUT} font-mono`} type="number" min={0.1} max={1000} step={0.1} inputMode="decimal" value={d.volumeM3} onChange={(e) => set({ volumeM3: e.target.value })} />
            </Field>
            <Field label={t('trucksCount')} error={err('trucksCount')}>
              <input className={`${INPUT} font-mono`} type="number" min={1} max={100} step={1} inputMode="numeric" value={d.trucksCount} onChange={(e) => set({ trucksCount: e.target.value })} />
            </Field>
            <Field label={t('paymentTerm')} error={err('paymentTerm')}>
              <select className={INPUT} value={d.paymentTerm} onChange={(e) => set({ paymentTerm: e.target.value })}>
                <option value="">{t('paymentAny')}</option>
                {PAYMENT_TERMS.map((x) => <option key={x} value={x}>{L.payment(x)}</option>)}
              </select>
            </Field>
          </div>
          <Field label={t('truckType')} error={err('truckType')}>
            <select className={INPUT} value={d.truckType} onChange={(e) => set({ truckType: e.target.value })}>
              <option value="">{t('truckAny')}</option>
              {TRUCK_TYPES.map((x) => <option key={x} value={x}>{L.truck(x)}</option>)}
            </select>
          </Field>
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('serviceType')} required error={err('serviceType')}>
            <select className={INPUT} value={d.serviceType} onChange={(e) => set({ serviceType: e.target.value })}>
              <option value="">{t('typePick')}</option>
              {SERVICE_TYPES.map((x) => <option key={x} value={x}>{L.service[x as ServiceType]}</option>)}
            </select>
          </Field>
          <Field label={t('region')} required error={err('regionCode')}>
            <select className={INPUT} value={d.regionCode} onChange={(e) => set({ regionCode: e.target.value })}>{regionOptions(t('regionPick'))}</select>
          </Field>
        </div>
      )}
      {/* Yuk e'lonida sarlavha so'ralmaydi: u yuk nomi va og'irligidan o'zi tuziladi */}
      {cargo ? null : (
        <Field label={t('title')} required error={err('title')}>
          <input className={INPUT} maxLength={120} placeholder={t('titlePhService')} value={d.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
      )}
      <Field label={cargo ? t('descriptionOptional') : t('description')} required={!cargo} error={err('description')}>
        <textarea className={INPUT} rows={cargo ? 3 : 4} maxLength={2000} placeholder={cargo ? t('descriptionPhCargoShort') : t('descriptionPhService')} value={d.description} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      <Field label={t('phone')} hint={t('phoneHint')} error={err('contactPhone')}>
        <PhoneField className={`${INPUT} font-mono`} value={d.contactPhone} onChange={(contactPhone) => set({ contactPhone })} />
      </Field>
      {/* Yukning surati: ijrochi nimani olib ketishini ko'rib taklif beradi, ko'r-ko'rona emas */}
      {cargo ? (
        <Field label={t('photos')} hint={t('photosHint')} error={err('photos')} group>
          <PhotoUpload photos={d.photos} onChange={(photos) => set({ photos })} />
        </Field>
      ) : null}
      {top ? <Notice tone="err">{top}</Notice> : null}
      <div><button type="submit" disabled={busy} className={BTN_PRIMARY}>{busy ? t('sending') : t('submit')}</button></div>
    </form>
  );
}
