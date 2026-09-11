'use client';
// Kirish: asosiy forma telefon + parol, ikkinchi yo'l kod (OTP), Google. ?reset=1 parol tiklash (kod + yangi parol), ?attach=1 telefon bog'lash.
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PASSWORD } from '@yuksaroy/domain';
import { Link, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { ApiError, clearAuthedCache, post } from '@/lib/api';
import type { LoginResponse } from '@/lib/types-auth';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { PasswordFields } from '@/components/auth/PasswordFields';
import { PhoneOtp } from '@/components/auth/PhoneOtp';
import { input, inputMono, primary } from '@/components/auth/styles';
import { PasswordField, PhoneField } from '@/components/ui/fields';

/** ?next til prefiksi bilan keladi (/ru/dashboard); i18n router o'zi prefiks qo'shadi, shuning uchun olib tashlanadi. */
export const stripLocale = (p: string) => {
  const s = p.replace(new RegExp(`^/(${routing.locales.join('|')})(?=/|$)`), '') || '/';
  // Faqat ichki yo'l qaytadi: // yoki /\ (protokol-nisbiy) va tashqi URL tashqi saytga
  // yo'naltirishni ochib qo'yardi (?next=//evil.com) - bunday holda kabinetga tushadi.
  return s[0] === '/' && s[1] !== '/' && s[1] !== '\\' ? s : '/dashboard';
};

const MODES = ['password', 'code'] as const;
const card = 'rounded-card border border-line bg-white p-6 sm:p-8';

export function LoginCard({ next, attach, reset }: { next: string | null; attach: boolean; reset: boolean }) {
  const router = useRouter();
  const t = useTranslations('auth');
  const t2 = useTranslations('auth2');
  const [mode, setMode] = useState<(typeof MODES)[number]>('password');
  const [phone, setPhone] = useState('');
  const [pw, setPw] = useState('');
  const [newPw, setNewPw] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [noPassword, setNoPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  // Mehmon keshi ('men kirmaganman') qolib ketmasin: sarlavha darhol yangi holatga o'tsin
  const done = () => { clearAuthedCache(); router.push(next ? stripLocale(next) : '/dashboard'); };
  const href = (pathname: '/login' | '/signup', query: Record<string, string> = {}) => ({ pathname, query: next ? { ...query, next } : query });
  const switchMode = (m: (typeof MODES)[number]) => { setMode(m); setErr(null); setNoPassword(false); };

  async function login(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null); setNoPassword(false);
    try { await post<LoginResponse>('/auth/login', { phone, password: pw }); done(); }
    catch (e) {
      const body = e instanceof ApiError ? e.body : null;
      const code = body?.code ?? (e instanceof ApiError && e.status === 400 ? 'INVALID_PHONE' : '');
      if (code === 'NO_PASSWORD') setNoPassword(true);
      else if (code === 'BAD_CREDENTIALS') setErr(t2('login.err.badCredentials'));
      else if (code === 'LOGIN_LOCKED') setErr(t2('login.err.locked', { min: Math.ceil((body.retryAfter ?? PASSWORD.lockMinutes * 60) / 60) }));
      else if (code === 'INVALID_PHONE') setErr(t('err.invalidPhone'));
      else setErr(t('err.generic'));
      setBusy(false);
    }
  }

  if (attach) return (
    <div className={card}>
      <h1 className="font-display text-2xl font-bold text-navy">{t2('attach.title')}</h1>
      <p className="mt-2 text-sm text-muted">{t2('attach.lead')}</p>
      <div className="mt-6"><PhoneOtp submitLabel={t2('attach.submit')} onDone={done} /></div>
    </div>
  );

  if (reset) return (
    <div className={card}>
      <h1 className="font-display text-2xl font-bold text-navy">{t2('reset.title')}</h1>
      <p className="mt-2 text-sm text-muted">{t2('reset.lead')}</p>
      <div className="mt-6">
        <PhoneOtp submitLabel={t2('reset.submit')} onDone={done} requestPath="/auth/password/reset/request"
          verify={(phone, code) => post<LoginResponse>('/auth/password/reset', { phone, code, password: newPw })}
          extra={<PasswordFields onChange={setNewPw} />} extraReady={newPw !== null} />
      </div>
      <p className="mt-6 border-t border-line pt-5 text-center text-sm text-muted">
        <Link href={href('/login')} className="font-semibold text-teal-ink hover:underline">{t2('reset.back')}</Link>
      </p>
    </div>
  );

  return (
    <div className={card}>
      <h1 className="font-display text-2xl font-bold text-navy">{t('title')}</h1>
      <p className="mt-2 text-sm text-muted">{mode === 'code' ? t('lead') : t2('login.lead')}</p>

      {/* Ikki yo'l: parol (asosiy) yoki kod. Tanlangan navy, qolgani chiziqsiz */}
      <div role="tablist" className="mt-6 grid grid-cols-2 rounded-full border border-line p-1 text-sm font-semibold">
        {MODES.map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => switchMode(m)}
            className={`rounded-full py-2 transition-colors duration-150 ${mode === m ? 'bg-navy text-white' : 'text-muted hover:text-navy'}`}>
            {t2(`login.tabs.${m}`)}
          </button>
        ))}
      </div>

      {mode === 'password' ? (
        <form key="password" className="ys-step mt-6 space-y-4" onSubmit={login}>
          <label className="block text-sm font-semibold">{t('phone.label')}
            <PhoneField className={inputMono} placeholder={t('phone.placeholder')} value={phone} onChange={setPhone} autoFocus required />
          </label>
          <div>
            <div className="flex items-center justify-between text-sm font-semibold">
              <label htmlFor="login-password">{t2('password.label')}</label>
              <Link href={href('/login', { reset: '1' })} className="text-xs text-teal-ink hover:underline">{t2('login.forgot')}</Link>
            </div>
            <PasswordField id="login-password" className={input} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required />
          </div>
          <button disabled={busy} className={primary}>{t2('login.submit')}</button>
          {noPassword && (
            <p role="status" className="rounded-xl bg-amber-soft p-4 text-sm">
              {t2('login.err.noPassword')}{' '}
              <button type="button" onClick={() => switchMode('code')} className="font-semibold text-amber-ink underline">{t2('login.err.noPasswordCode')}</button>
              {' '}{t2('login.err.noPasswordOr')}{' '}
              <Link href={href('/login', { reset: '1' })} className="font-semibold text-amber-ink underline">{t2('login.err.noPasswordSet')}</Link>.
            </p>
          )}
          {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
        </form>
      ) : (
        <div key="code" className="ys-step mt-6"><PhoneOtp submitLabel={t2('login.verify')} onDone={done} initialPhone={phone} /></div>
      )}

      <GoogleButton onLogin={done} />
      <p className="mt-6 border-t border-line pt-5 text-center text-sm text-muted">
        {t2('login.noAccount')}{' '}
        <Link href={href('/signup')} className="font-semibold text-teal-ink hover:underline">{t2('login.register')}</Link>
      </p>
    </div>
  );
}
