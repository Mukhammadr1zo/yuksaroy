'use client';
// Ro'yxat: 1 telefon (yoki Google) -> 2 parol -> 3 profil (niyat, keyin kerak bo'lsa yuridik shakl) -> 4 tayyor.
// Google (telefonsiz) yoki parolli foydalanuvchi 2-qadamni o'tkazib yuboradi; kirgan foydalanuvchi telefon qadamini ko'rmaydi.
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRightIcon, BuildingsIcon, CheckCircleIcon, CheckIcon, MagnifyingGlassIcon, StorefrontIcon, TruckIcon, type Icon } from '@phosphor-icons/react';
import { ORG_KINDS, REGIONS, type OrgKind } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { ApiError, api, clearAuthedCache, post } from '@/lib/api';
import type { LoginResponse, Me, OrgRecord } from '@/lib/types-auth';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { PasswordFields } from '@/components/auth/PasswordFields';
import { PhoneOtp } from '@/components/auth/PhoneOtp';
import { input, primary } from '@/components/auth/styles';
import { stripLocale } from '../login/LoginCard';

const KINDS = ORG_KINDS.filter((k) => k !== 'PLATFORM');
const STEPS = ['phone', 'password', 'profile', 'done'] as const;
// Birinchi savol niyat bo'yicha, yuridik shakl bo'yicha emas: mijozning ko'pchiligi yuridik shaxs,
// shuning uchun "Tashkilot" varianti uni provayder yo'liga tortib ketardi. Yuridik shakl faqat
// xizmat ko'rsatuvchidan so'raladi; mijozga tashkilot birinchi buyurtmada avtomatik ochiladi.
const INTENT = [{ key: 'need', Icon: MagnifyingGlassIcon }, { key: 'offer', Icon: StorefrontIcon }] as const;
const OFFER = [{ key: 'driver', Icon: TruckIcon }, { key: 'org', Icon: BuildingsIcon }] as const;
type Who = 'shipper' | 'driver' | 'org';
const ORG_ERR: Record<string, string> = { STIR_TAKEN: 'stirTaken', INVALID_STIR: 'invalidStir', KIND_REQUIRED: 'kindRequired' };

/** Tanlov kartalari: niyat uchun ham, yuridik shakl uchun ham bir xil ko'rinish. */
function Cards({ list, value, label, onPick }: {
  list: readonly { key: string; Icon: Icon }[];
  value: string | null;
  label: (key: string, part: 'title' | 'body') => string;
  onPick: (key: string) => void;
}) {
  return (
    <div className="mt-2 grid gap-3 sm:grid-cols-2">
      {list.map(({ key, Icon }) => {
        const on = value === key;
        return (
          <button key={key} type="button" role="radio" aria-checked={on} onClick={() => onPick(key)}
            className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors duration-150 ${on ? 'border-navy bg-navy text-white' : 'border-line bg-white hover:border-teal'}`}>
            <Icon size={26} weight="duotone" className={`shrink-0 ${on ? 'text-teal-lit' : 'text-teal'}`} aria-hidden="true" />
            <span className="min-w-0">
              <span className="block font-semibold">{label(key, 'title')}</span>
              <span className={`mt-0.5 block text-sm ${on ? 'text-white/70' : 'text-muted'}`}>{label(key, 'body')}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function RegisterFlow({ next }: { next: string | null }) {
  const t = useTranslations('auth2.register');
  const tk = useTranslations('orgKind');
  const tr = useTranslations('region');
  // 0 = kirganmi tekshirilmoqda
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [pw, setPw] = useState<string | null>(null);
  const [intent, setIntent] = useState<'need' | 'offer' | null>(null);
  const [who, setWho] = useState<Who | null>(null);
  const [form, setForm] = useState({ fullName: '', kinds: [] as OrgKind[], name: '', stir: '', regionCode: '' });
  const [org, setOrg] = useState<OrgRecord | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loggedIn = (u: Me) => { clearAuthedCache(); setForm((f) => ({ ...f, fullName: u.fullName ?? '' })); setStep(u.hasPassword || !u.phone ? 3 : 2); };
  useEffect(() => { api<Me>('/auth/me').then(loggedIn).catch(() => setStep(1)); }, []);

  const run = async (fn: () => Promise<void>, fail: (code: string | null) => string) => {
    setErr(null); setBusy(true);
    try { await fn(); }
    catch (e) { setErr(fail(e instanceof ApiError ? e.body?.code ?? null : null)); }
    finally { setBusy(false); }
  };

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => { await post('/auth/password/set', { password: pw }); setStep(3); }, () => t('password.err'));
  };

  const patchMe = (extra: object = {}) => api('/auth/me', { method: 'PATCH', body: JSON.stringify({ fullName: form.fullName.trim(), ...extra }) });

  const submitShipper = (e: React.FormEvent) => {
    e.preventDefault();
    // Tashkilot so'ralmaydi: birinchi buyurtmada ism bilan avtomatik ochiladi (STIR keyin, hujjat kerak bo'lganda)
    void run(async () => { await patchMe(); setStep(4); }, () => t('profile.err.generic'));
  };

  const submitDriver = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => { await patchMe({ personalRoles: ['DRIVER'] }); setStep(4); }, () => t('profile.err.generic'));
  };

  const submitOrg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.kinds.length) { setErr(t('profile.err.kindRequired')); return; }
    void run(async () => {
      await patchMe();
      setOrg(await post<OrgRecord>('/orgs', { kinds: form.kinds, name: form.name.trim(), stir: form.stir || undefined, regionCode: form.regionCode || undefined }));
      setStep(4);
    }, (code) => t(`profile.err.${ORG_ERR[code ?? ''] ?? 'generic'}`));
  };

  const toggleKind = (k: OrgKind) => setForm((f) => ({ ...f, kinds: f.kinds.includes(k) ? f.kinds.filter((x) => x !== k) : [...f.kinds, k] }));

  const fullNameField = (
    <label className="block text-sm font-semibold">{t('profile.fullName')}
      <input className={input} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} autoComplete="name" required minLength={2} maxLength={120} autoFocus />
    </label>
  );

  // Tayyor qadam: haydovchi uchun e'lon va kabinet, tashkilot uchun kabinet, e'lon, terminal
  const actions = org
    ? [{ key: 'cabinet', href: next ? stripLocale(next) : '/dashboard' }, { key: 'listing', href: '/dashboard/listings/new' }, { key: 'terminal', href: '/dashboard/orders?tab=incoming' }]
    : who === 'shipper'
      ? [{ key: 'findTerminal', href: '/terminals' }, { key: 'cabinet', href: next ? stripLocale(next) : '/dashboard' }]
      : [{ key: 'driverListing', href: { pathname: '/dashboard/listings/new', query: { kind: 'TRUCK' } } }, { key: 'cabinet', href: next ? stripLocale(next) : '/dashboard' }];

  return (
    <div className="rounded-card border border-line bg-white p-4 sm:p-8">
      <h1 className="font-display text-2xl font-bold text-navy">{t('title')}</h1>
      <p className="mt-2 text-sm text-muted">{t('lead')}</p>

      {/* Stepper: o'tilgan teal + belgi, joriy navy, keyingisi chiziqli */}
      <ol className="mt-6 flex items-center gap-1.5 sm:gap-2" aria-label={t('lead')}>
        {STEPS.map((s, i) => {
          const n = i + 1;
          const state = step > n ? 'done' : step === n ? 'now' : 'todo';
          return (
            <li key={s} className="flex min-w-0 flex-1 items-center gap-2 last:flex-none" aria-current={state === 'now' ? 'step' : undefined}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold transition-colors duration-200 ${
                state === 'done' ? 'bg-teal text-white' : state === 'now' ? 'bg-navy text-white' : 'border border-line text-muted'}`}>
                {state === 'done' ? <CheckIcon size={14} weight="bold" aria-hidden="true" /> : n}
              </span>
              {/* Tor ekranda faqat joriy qadam yozuvi ko'rinadi, qolganlari raqam bilan qoladi */}
              <span className={`min-w-0 truncate text-xs font-semibold ${state === 'todo' ? 'text-muted' : 'text-ink'} ${state === 'now' ? '' : 'hidden sm:inline'}`}>{t(`steps.${s}`)}</span>
              {i < STEPS.length - 1 && <span className={`h-px min-w-3 flex-1 transition-colors duration-200 ${state === 'done' ? 'bg-teal' : 'bg-line'}`} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>

      {step === 0 && <p className="mt-8 text-sm text-muted">{t('checking')}</p>}

      {step === 1 && (
        <div key="s1" className="ys-step mt-6">
          <PhoneOtp submitLabel={t('continue')} onDone={(r: LoginResponse) => loggedIn(r.user)} />
          <GoogleButton onLogin={(r) => loggedIn(r.user)} />
          <p className="mt-6 border-t border-line pt-5 text-center text-sm text-muted">
            {t('hasAccount')}{' '}
            <Link href={next ? { pathname: '/login', query: { next } } : '/login'} className="font-semibold text-teal-ink hover:underline">{t('login')}</Link>
          </p>
        </div>
      )}

      {step === 2 && (
        <form key="s2" className="ys-step mt-6 space-y-4" onSubmit={submitPassword}>
          <div>
            <h2 className="font-semibold">{t('password.title')}</h2>
            <p className="text-sm text-muted">{t('password.lead')}</p>
          </div>
          <PasswordFields onChange={setPw} autoFocus />
          <button disabled={busy || !pw} className={primary}>{t('password.submit')}</button>
          <button type="button" onClick={() => { setErr(null); setStep(3); }} className="w-full text-sm text-muted hover:text-navy">{t('password.skip')}</button>
          {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
        </form>
      )}

      {step === 3 && (
        <div key="s3" className="ys-step mt-6 space-y-4">
          <h2 className="font-semibold">{t('profile.title')}</h2>
          <fieldset>
            <legend className="text-sm text-muted">{t('profile.intent.title')}</legend>
            <Cards list={INTENT} value={intent} label={(k, part) => t(`profile.intent.${k}.${part}`)}
              onPick={(k) => { setIntent(k as 'need' | 'offer'); setWho(k === 'need' ? 'shipper' : null); setErr(null); }} />
          </fieldset>

          {intent === 'offer' && (
            <fieldset key="offer" className="ys-step">
              <legend className="text-sm text-muted">{t('profile.who.title')}</legend>
              <Cards list={OFFER} value={who} label={(k, part) => t(`profile.who.${k}.${part}`)}
                onPick={(k) => { setWho(k as Who); setErr(null); }} />
            </fieldset>
          )}

          {who === 'shipper' && (
            <form key="shipper" className="ys-step space-y-4 border-t border-line pt-4" onSubmit={submitShipper}>
              <p className="text-sm text-muted">{t('profile.shipperLead')}</p>
              {fullNameField}
              <button disabled={busy} className={primary}>{t('profile.shipperSubmit')}</button>
              {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
            </form>
          )}

          {who === 'driver' && (
            <form key="driver" className="ys-step space-y-4 border-t border-line pt-4" onSubmit={submitDriver}>
              <p className="text-sm text-muted">{t('profile.driverLead')}</p>
              {fullNameField}
              <button disabled={busy} className={primary}>{t('profile.driverSubmit')}</button>
              {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
            </form>
          )}

          {who === 'org' && (
            <form key="org" className="ys-step space-y-4 border-t border-line pt-4" onSubmit={submitOrg}>
              <p className="text-sm text-muted">{t('profile.lead')}</p>
              {fullNameField}
              <fieldset>
                <legend className="text-sm font-semibold">{t('profile.kinds')} <span className="font-normal text-muted">({t('profile.kindsHint')})</span></legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {KINDS.map((k) => {
                    const on = form.kinds.includes(k);
                    return (
                      <button key={k} type="button" aria-pressed={on} onClick={() => toggleKind(k)}
                        className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors duration-150 ${on ? 'border-navy bg-navy text-white' : 'border-line bg-white text-ink hover:border-teal'}`}>
                        {tk(k)}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <label className="block text-sm font-semibold">{t('profile.orgName')}
                <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="organization" required minLength={2} maxLength={120} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold">{t('profile.stir')}
                  <input className={`${input} font-mono`} value={form.stir} inputMode="numeric" placeholder="123456789"
                    onChange={(e) => setForm({ ...form, stir: e.target.value.replace(/\D/g, '').slice(0, 9) })} />
                  <span className="mt-1 block text-xs font-normal text-muted">{t('profile.stirHint')}</span>
                </label>
                <label className="block text-sm font-semibold">{t('profile.region')}
                  <select className={input} value={form.regionCode} onChange={(e) => setForm({ ...form, regionCode: e.target.value })}>
                    <option value="">{t('profile.regionAny')}</option>
                    {REGIONS.map((r) => <option key={r} value={r}>{tr(r)}</option>)}
                  </select>
                </label>
              </div>
              <button disabled={busy} className={primary}>{t('profile.submit')}</button>
              {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
            </form>
          )}
        </div>
      )}

      {step === 4 && (
        <div key="s4" className="ys-step mt-6">
          <div className="flex items-center gap-3">
            <CheckCircleIcon size={36} weight="fill" className="shrink-0 text-teal" aria-hidden="true" />
            <div>
              <h2 className="font-display text-xl font-bold text-navy">{t('done.title')}</h2>
              <p className="wrap-anywhere text-sm text-muted">{org ? t('done.lead', { org: org.name }) : who === 'shipper' ? t('done.shipperLead') : t('done.driverLead')}</p>
            </div>
          </div>
          <ul className="mt-6 space-y-2">
            {actions.map(({ key, href }) => (
              <li key={key}>
                <Link href={href} className="group flex items-center justify-between rounded-xl border border-line px-4 py-3 transition-colors duration-150 hover:border-teal">
                  <span>
                    <span className="block font-semibold">{t(`done.${key}.title`)}</span>
                    <span className="block text-sm text-muted">{t(`done.${key}.body`)}</span>
                  </span>
                  <ArrowRightIcon size={18} className="shrink-0 text-muted transition-colors duration-150 group-hover:text-teal" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-5 rounded-xl bg-amber-soft p-4 text-sm">
            {org ? (
              <>{t('done.kycHint')}{' '}<Link href="/dashboard/organization" className="font-semibold text-amber-ink hover:underline">{t('done.kycLink')}</Link></>
            ) : who === 'shipper' ? t('done.shipperHint') : t('done.driverHint')}
          </p>
        </div>
      )}
    </div>
  );
}
