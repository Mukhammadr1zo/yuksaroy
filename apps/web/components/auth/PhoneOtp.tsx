'use client';
// Telefon -> kod qadamlari. Kirish, ro'yxat, telefon bog'lash (attach) va parol tiklash rejimlarida bir xil: cookie bo'lsa API o'zi bog'laydi.
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { TelegramLogoIcon } from '@phosphor-icons/react';
import { ApiError, post } from '@/lib/api';
import type { LoginResponse, OtpRequestResponse } from '@/lib/types-auth';
import { inputMono, primary } from './styles';

type Step = { kind: 'phone' } | { kind: 'code'; botUrl?: string };
type Props = {
  submitLabel: string;
  onDone: (r: LoginResponse) => void;
  /** Parol tiklash: kod so'rash yo'li va tasdiq chaqiruvi boshqa, qadamlar bir xil. */
  requestPath?: string;
  verify?: (phone: string, code: string) => Promise<LoginResponse>;
  /** Kod maydonidan keyingi qo'shimcha maydonlar (yangi parol); tayyor bo'lmaguncha tugma o'chiq. */
  extra?: React.ReactNode;
  extraReady?: boolean;
  initialPhone?: string;
};

const BOT = process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'yuksaroy_bot';
const ERR: Record<string, string> = {
  INVALID_PHONE: 'auth.err.invalidPhone', TOO_MANY_REQUESTS: 'auth.err.tooManyRequests', OTP_WRONG: 'auth.err.otpWrong',
  OTP_EXPIRED: 'auth.err.otpExpired', OTP_LOCKED: 'auth.err.otpLocked', OTP_NOT_FOUND: 'auth.err.otpNotFound', PHONE_TAKEN: 'auth2.err.phoneTaken',
};
const verifyOtp = (phone: string, code: string) => post<LoginResponse>('/auth/otp/verify', { phone, code });

export function PhoneOtp({ submitLabel, onDone, requestPath = '/auth/otp/request', verify = verifyOtp, extra, extraReady = true, initialPhone = '' }: Props) {
  const t = useTranslations('auth');
  const root = useTranslations();
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState('');
  const [step, setStep] = useState<Step>({ kind: 'phone' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = (e: unknown) => setErr(root(ERR[(e instanceof ApiError && e.body?.code) || ''] ?? 'auth.err.generic'));

  async function requestCode() {
    setBusy(true); setErr(null);
    try {
      const r = await post<OtpRequestResponse>(requestPath, { phone });
      setCode('');
      setStep({ kind: 'code', botUrl: r.status === 'LINK_REQUIRED' ? r.botUrl : undefined });
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  async function submit() {
    setBusy(true); setErr(null);
    try { onDone(await verify(phone, code)); }
    catch (e) { fail(e); setBusy(false); }
  }

  return (
    <div>
      {step.kind === 'phone' ? (
        <form key="phone" className="ys-step space-y-4" onSubmit={(e) => { e.preventDefault(); void requestCode(); }}>
          <label className="block text-sm font-semibold">{t('phone.label')}
            <input className={inputMono} placeholder={t('phone.placeholder')} value={phone} onChange={(e) => setPhone(e.target.value)}
              type="tel" inputMode="tel" autoComplete="tel" autoFocus required />
          </label>
          <button disabled={busy} className={primary}>{t('requestCode')}</button>
          <p className="flex items-center gap-2 text-xs text-muted">
            <TelegramLogoIcon size={16} weight="fill" className="text-teal" aria-hidden="true" />
            <a href={`https://t.me/${BOT}`} target="_blank" rel="noreferrer" className="hover:text-navy">@{BOT}</a>
          </p>
        </form>
      ) : (
        <form key="code" className="ys-step space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          {step.botUrl ? (
            <div className="rounded-xl bg-amber-soft p-4 text-sm">
              <p className="font-semibold text-amber-ink">{t('link.title')}</p>
              <p className="mt-1">{t('link.body')}</p>
              <a href={step.botUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2 font-semibold text-white transition duration-150 hover:bg-navy-2">
                <TelegramLogoIcon size={18} weight="fill" aria-hidden="true" />{t('link.openBot')}
              </a>
            </div>
          ) : (
            <p className="rounded-xl bg-teal-soft p-4 text-sm text-teal-ink">{t('code.sent')} <span className="font-mono">{phone}</span></p>
          )}
          <label className="block text-sm font-semibold">{t('code.label')}
            <input className={`${inputMono} text-lg tracking-[0.3em]`} maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric" autoComplete="one-time-code" autoFocus required />
          </label>
          {extra}
          <button disabled={busy || code.length !== 6 || !extraReady} className={primary}>{submitLabel}</button>
          <button type="button" onClick={() => { setStep({ kind: 'phone' }); setErr(null); }} className="w-full text-sm text-muted hover:text-navy">{t('changeNumber')}</button>
        </form>
      )}
      {err && <p role="alert" className="mt-4 text-sm text-red-700">{err}</p>}
    </div>
  );
}
