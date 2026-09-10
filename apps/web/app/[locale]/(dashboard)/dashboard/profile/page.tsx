'use client';
// Profil: avatar (POST /uploads + PATCH /auth/me), shaxsiy ma'lumotlar, platformadagi rol, telefon (OTP bilan almashtirish), parol, bog'langan hisoblar, hisobni o'chirish.
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { GoogleLogoIcon, TelegramLogoIcon } from '@phosphor-icons/react';
import { PASSWORD } from '@yuksaroy/domain';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { api, post } from '@/lib/api';
import { uzDate } from '@/lib/format';
import type { OtpRequestResponse } from '@/lib/types-auth';
import type { Me, Membership } from '@/lib/types-kabinet';
import { BTN_GHOST, BTN_NAVY, BTN_PRIMARY, Field, INPUT, Notice, errText } from '@/components/kabinet/bits';
import { uploadOne } from '@/components/kabinet/PhotoUpload';

const BOT = process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'yuksaroy_bot';
const LOCALE_LABEL: Record<Locale, string> = { uz: "O'zbekcha", ru: 'Русский', en: 'English' };
type Note = { tone: 'ok' | 'err'; text: string } | null;
type Props = { me: Me; onChange: (m: Me) => void };

/** Har bo'lim uchun bir xil: busy, xabar, API xatosini tarjima qilish. */
function useSection() {
  const t = useTranslations('kabinet.profile.err');
  const tc = useTranslations('kabinet.common');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const run = async (fn: () => Promise<void>, okText?: string) => {
    setBusy(true); setNote(null);
    try { await fn(); if (okText) setNote({ tone: 'ok', text: okText }); }
    catch (e) { setNote({ tone: 'err', text: errText(e, t, t.has, tc('failed')) }); }
    finally { setBusy(false); }
  };
  return { busy, note, setNote, run };
}

export default function ProfilePage() {
  const t = useTranslations('kabinet.profile');
  const tc = useTranslations('kabinet.common');
  const [me, setMe] = useState<Me | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { api<Me>('/auth/me').then(setMe).catch(() => setFailed(true)); }, []);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
      <p className="mt-1 text-muted">{t('lead')}</p>
      {failed ? <p role="alert" className="mt-6 text-sm text-red-700">{tc('loadFailed')}</p> : null}
      {!me && !failed ? <p className="mt-6 text-sm text-muted">{tc('loading')}</p> : null}
      {me ? (
        <div className="mt-6 space-y-5">
          <Head me={me} onChange={setMe} />
          <Personal me={me} onChange={setMe} />
          <Activity me={me} onChange={setMe} />
          <Phone me={me} onChange={setMe} />
          <Password me={me} onChange={setMe} />
          <Linked me={me} />
          <Danger me={me} />
        </div>
      ) : null}
    </main>
  );
}

function Head({ me, onChange }: Props) {
  const t = useTranslations('kabinet.profile');
  const te = useTranslations('kabinet.profile.err');
  const locale = useLocale();
  const file = useRef<HTMLInputElement>(null);
  const { busy, note, setNote, run } = useSection();

  const setAvatar = (avatarUrl: string | null) => run(async () => { onChange(await api<Me>('/auth/me', { method: 'PATCH', body: JSON.stringify({ avatarUrl }) })); });
  async function pick(f: File | undefined) {
    if (!f) return;
    const r = await uploadOne(f).catch((): { url?: string; code?: string } => ({ code: 'UPLOAD' }));
    if (file.current) file.current.value = '';
    if (r.url) await setAvatar(r.url);
    else setNote({ tone: 'err', text: te.has(r.code ?? '') ? te(r.code ?? '') : te('UPLOAD') });
  }
  const initials = (me.fullName ?? '').split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  // Brauzer ICU da o'zbekcha oy nomlari yo'q (M09 chiqadi), shuning uchun uz uchun o'z formatimiz
  const since = locale === 'uz' ? `${uzDate(me.createdAt)} ${new Date(me.createdAt).getFullYear()}` : new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'Asia/Tashkent' }).format(new Date(me.createdAt));

  return (
    <section className="flex flex-wrap items-center gap-5 rounded-card border border-line bg-white p-5">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-soft font-display text-2xl font-bold text-teal-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {me.avatarUrl ? <img src={me.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials || '?'}
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-bold">{me.fullName || t('noName')}</h2>
        <p className="truncate font-mono text-sm text-muted">{me.phone ?? t('phone.none')}{me.email ? ` · ${me.email}` : ''}</p>
        <p className="mt-1 text-xs text-muted">{t('since', { date: since })}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy} onClick={() => file.current?.click()} className={BTN_GHOST}>{busy ? t('avatar.uploading') : t('avatar.upload')}</button>
        {me.avatarUrl ? <button type="button" disabled={busy} onClick={() => void setAvatar(null)} className="text-sm text-red-700 underline disabled:opacity-60">{t('avatar.remove')}</button> : null}
      </div>
      <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => void pick(e.target.files?.[0])} />
      {note ? <div className="w-full"><Notice tone={note.tone}>{note.text}</Notice></div> : null}
    </section>
  );
}

function Personal({ me, onChange }: Props) {
  const t = useTranslations('kabinet.profile.personal');
  const tc = useTranslations('kabinet.common');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { busy, note, run } = useSection();
  const [d, setD] = useState({ fullName: me.fullName ?? '', email: me.email ?? '', locale: (me.locale ?? locale) as Locale });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      // Google hisobida email o'zgarmaydi (EMAIL_LOCKED), shuning uchun yuborilmaydi
      const body = { fullName: d.fullName.trim(), locale: d.locale, ...(me.googleLinked ? {} : { email: d.email.trim() || null }) };
      onChange(await api<Me>('/auth/me', { method: 'PATCH', body: JSON.stringify(body) }));
      if (d.locale !== locale) router.replace(pathname, { locale: d.locale });
    }, tc('saved'));
  };

  return (
    <form onSubmit={save} className="space-y-4 rounded-card border border-line bg-white p-5">
      <h2 className="font-semibold">{t('title')}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('fullName')}>
          <input className={INPUT} value={d.fullName} maxLength={120} autoComplete="name" onChange={(e) => setD({ ...d, fullName: e.target.value })} />
        </Field>
        <Field label={t('email')} hint={me.googleLinked ? t('emailLocked') : undefined}>
          <input className={`${INPUT} font-mono`} type="email" value={d.email} maxLength={160} autoComplete="email" disabled={me.googleLinked} onChange={(e) => setD({ ...d, email: e.target.value })} />
        </Field>
        <Field label={t('locale')}>
          <select className={INPUT} value={d.locale} onChange={(e) => setD({ ...d, locale: e.target.value as Locale })}>
            {routing.locales.map((l) => <option key={l} value={l}>{LOCALE_LABEL[l]}</option>)}
          </select>
        </Field>
      </div>
      {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}
      <button type="submit" disabled={busy} className={BTN_NAVY}>{busy ? tc('saving') : tc('save')}</button>
    </form>
  );
}

/** Platformada nima qilaman: ro'yxatdan o'tishdagi niyat tanlovi shu yerda o'zgaradi.
 *  Tashkiloti bori uchun almashtirgich yo'q: tashkilotni o'z bo'limida boshqaradi. */
function Activity({ me, onChange }: Props) {
  const t = useTranslations('kabinet.profile.activity');
  const tc = useTranslations('kabinet.common');
  const { busy, note, run } = useSection();
  const [orgs, setOrgs] = useState<Membership[] | null>(null);
  useEffect(() => { api<Membership[]>('/orgs/mine').then(setOrgs).catch(() => setOrgs([])); }, []);

  const isDriver = me.personalRoles.includes('DRIVER');
  const hasOrg = !!orgs?.length;
  const setRoles = (roles: string[]) => run(async () => {
    onChange(await api<Me>('/auth/me', { method: 'PATCH', body: JSON.stringify({ personalRoles: roles }) }));
  }, tc('saved'));

  const card = (on: boolean, title: string, body: string, onClick: () => void) => (
    <button type="button" role="radio" aria-checked={on} disabled={busy} onClick={onClick}
      className={`flex-1 rounded-xl border p-4 text-left transition-colors duration-150 disabled:opacity-60 ${on ? 'border-navy bg-navy text-white' : 'border-line bg-white hover:border-teal'}`}>
      <span className="block font-semibold">{title}</span>
      <span className={`mt-0.5 block text-sm ${on ? 'text-white/70' : 'text-muted'}`}>{body}</span>
    </button>
  );

  return (
    <section className="space-y-3 rounded-card border border-line bg-white p-5">
      <h2 className="font-semibold">{t('title')}</h2>
      {hasOrg ? (
        <p className="text-sm">{t('orgHas', { name: orgs![0]!.org.name })}{' '}
          <Link href="/dashboard/organization" className="font-semibold text-teal-ink hover:underline">{t('orgManage')}</Link>
        </p>
      ) : (
        <>
          <div role="radiogroup" aria-label={t('title')} className="flex flex-col gap-3 sm:flex-row">
            {card(!isDriver, t('need'), t('needBody'), () => void setRoles([]))}
            {card(isDriver, t('offer'), t('offerBody'), () => void setRoles(['DRIVER']))}
          </div>
          <p className="text-sm text-muted">{t('orgLead')}{' '}
            <Link href="/dashboard/organization" className="font-semibold text-teal-ink hover:underline">{t('orgOpen')}</Link>
          </p>
        </>
      )}
      {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}
    </section>
  );
}

/** Telefon almashtirish: kod YANGI raqamga (bot orqali), keyin /auth/phone/change. Telefonsiz (Google) hisob ham shu yerda bog'laydi. */
function Phone({ me, onChange }: Props) {
  const t = useTranslations('kabinet.profile.phone');
  const tc = useTranslations('kabinet.common');
  const { busy, note, run } = useSection();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [botUrl, setBotUrl] = useState<string | null | undefined>(undefined); // undefined = kod hali so'ralmagan

  const request = () => run(async () => {
    const r = await post<OtpRequestResponse>('/auth/phone/change/request', { phone });
    setCode(''); setBotUrl(r.status === 'LINK_REQUIRED' ? (r.botUrl ?? null) : null);
  });
  const confirm = () => run(async () => {
    onChange(await post<Me>('/auth/phone/change', { phone, code }));
    setOpen(false); setPhone(''); setCode(''); setBotUrl(undefined);
  }, t('changed'));
  const cancel = () => { setOpen(false); setPhone(''); setCode(''); setBotUrl(undefined); };

  return (
    <section className="space-y-4 rounded-card border border-line bg-white p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-semibold">{t('title')}</h2>
        <span className="font-mono text-sm text-muted">{me.phone ?? t('none')}</span>
        {!open ? <button type="button" onClick={() => setOpen(true)} className={`${BTN_GHOST} ml-auto`}>{me.phone ? t('change') : t('add')}</button> : null}
      </div>
      {open && botUrl === undefined ? (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void request(); }}>
          <Field label={t('new')} hint={t('hint')}>
            <input className={`${INPUT} font-mono`} type="tel" inputMode="tel" autoComplete="tel" placeholder="+998 90 123 45 67" value={phone} required autoFocus onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={BTN_NAVY}>{busy ? tc('saving') : t('request')}</button>
            <button type="button" onClick={cancel} className={BTN_GHOST}>{tc('cancel')}</button>
          </div>
        </form>
      ) : open ? (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void confirm(); }}>
          {botUrl ? (
            <div className="rounded-xl bg-amber-soft p-4 text-sm">
              <p className="font-semibold text-amber-ink">{t('link.title')}</p>
              <p className="mt-1">{t('link.body')}</p>
              <a href={botUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2 font-semibold text-white transition hover:bg-navy-2">
                <TelegramLogoIcon size={18} weight="fill" aria-hidden="true" />{t('link.open')}
              </a>
            </div>
          ) : (
            <p className="rounded-xl bg-teal-soft p-3 text-sm text-teal-ink">{t('sent')} <span className="font-mono">{phone}</span></p>
          )}
          <Field label={t('code')}>
            <input className={`${INPUT} font-mono text-lg tracking-[0.3em] sm:max-w-xs`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} autoFocus onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={busy || code.length !== 6} className={BTN_PRIMARY}>{busy ? tc('saving') : t('confirm')}</button>
            <button type="button" onClick={() => setBotUrl(undefined)} className={BTN_GHOST}>{t('back')}</button>
            <button type="button" onClick={cancel} className="text-sm text-muted underline hover:text-ink">{tc('cancel')}</button>
          </div>
        </form>
      ) : null}
      {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}
    </section>
  );
}

/** Parol: bor bo'lsa joriy parol /auth/login orqali tekshiriladi (alohida endpoint yo'q; xato urinishlar qulflanadi), keyin /auth/password/set. */
function Password({ me, onChange }: Props) {
  const t = useTranslations('kabinet.profile.password');
  const tc = useTranslations('kabinet.common');
  const { busy, note, setNote, run } = useSection();
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const needCurrent = me.hasPassword && !!me.phone;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) { setNote({ tone: 'err', text: t('mismatch') }); return; }
    void run(async () => {
      if (needCurrent) await post('/auth/login', { phone: me.phone, password: cur });
      onChange(await post<Me>('/auth/password/set', { password: pw }));
      setCur(''); setPw(''); setPw2('');
    }, t('done'));
  };

  return (
    <form onSubmit={save} className="space-y-4 rounded-card border border-line bg-white p-5">
      <h2 className="font-semibold">{t('title')}</h2>
      <p className="text-sm text-muted">{me.hasPassword ? t('has') : t('none')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {needCurrent ? (
          <Field label={t('current')} className="sm:col-span-2">
            <input className={`${INPUT} sm:max-w-sm`} type="password" autoComplete="current-password" value={cur} required onChange={(e) => setCur(e.target.value)} />
          </Field>
        ) : null}
        <Field label={t('new')} hint={t('hint', { min: PASSWORD.minLength })}>
          <input className={INPUT} type="password" autoComplete="new-password" minLength={PASSWORD.minLength} maxLength={200} value={pw} required onChange={(e) => setPw(e.target.value)} />
        </Field>
        <Field label={t('confirm')} error={pw2 && pw !== pw2 ? t('mismatch') : undefined}>
          <input className={INPUT} type="password" autoComplete="new-password" minLength={PASSWORD.minLength} maxLength={200} value={pw2} required onChange={(e) => setPw2(e.target.value)} />
        </Field>
      </div>
      {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}
      <button type="submit" disabled={busy || pw.length < PASSWORD.minLength || pw !== pw2} className={BTN_NAVY}>{busy ? tc('saving') : me.hasPassword ? t('change') : t('set')}</button>
    </form>
  );
}

function Linked({ me }: { me: Me }) {
  const t = useTranslations('kabinet.profile.linked');
  const pill = (on: boolean) => <span className={`rounded-full px-3 py-1 text-xs font-semibold ${on ? 'bg-teal text-white' : 'bg-line text-ink/70'}`}>{on ? t('yes') : t('no')}</span>;
  return (
    <section className="space-y-3 rounded-card border border-line bg-white p-5">
      <h2 className="font-semibold">{t('title')}</h2>
      <ul className="divide-y divide-line text-sm">
        <li className="flex flex-wrap items-center gap-3 py-3">
          <TelegramLogoIcon size={20} weight="fill" className="text-teal" aria-hidden="true" />
          <span className="font-semibold">Telegram</span>
          {pill(me.telegramLinked)}
          <span className="text-muted">{t('telegramHint')}</span>
          <a href={`https://t.me/${BOT}`} target="_blank" rel="noreferrer" className="ml-auto font-semibold text-teal-ink hover:underline">@{BOT}</a>
        </li>
        <li className="flex flex-wrap items-center gap-3 py-3">
          <GoogleLogoIcon size={20} weight="bold" className="text-navy" aria-hidden="true" />
          <span className="font-semibold">Google</span>
          {pill(me.googleLinked)}
          <span className="text-muted">{me.googleLinked ? <span className="font-mono">{me.email}</span> : t('googleNo')}</span>
        </li>
      </ul>
    </section>
  );
}

/** Hisobni o'chirish: tasdiq DELETE yoki o'z telefoni; API cookie'larni tozalaydi, keyin bosh sahifaga to'liq yuklanish. */
function Danger({ me }: { me: Me }) {
  const t = useTranslations('kabinet.profile.danger');
  const { busy, note, run } = useSection();
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const ready = confirm.trim() === 'DELETE' || (!!me.phone && confirm.replace(/\D/g, '').length >= 9);

  const del = (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm(t('lead'))) return;
    void run(async () => {
      await post('/auth/me/delete', { confirm: confirm.trim() });
      setDone(true);
      window.setTimeout(() => window.location.assign('/'), 2500);
    });
  };

  if (done) return <Notice tone="ok">{t('done')}</Notice>;
  return (
    <form onSubmit={del} className="space-y-4 rounded-card border border-red-200 bg-white p-5">
      <h2 className="font-semibold text-red-700">{t('title')}</h2>
      <p className="text-sm text-muted">{t('removed')}</p>
      <p className="text-sm text-muted">{t('kept')}</p>
      <Field label={t('confirmLabel')}>
        <input className={`${INPUT} font-mono sm:max-w-sm`} value={confirm} autoComplete="off" onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}
      <button type="submit" disabled={busy || !ready} className="rounded-full bg-red-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-60">{busy ? t('busy') : t('button')}</button>
    </form>
  );
}
