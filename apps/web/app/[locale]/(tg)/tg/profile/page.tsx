'use client';
// Profil: ism va avatar, telefon (requestContact orqali bog'lash), til (PATCH /auth/me + URL prefiksi), to'liq sayt havolalari, chiqish (tg token tozalanadi).
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRightIcon, ArrowSquareOutIcon } from '@phosphor-icons/react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { api } from '@/lib/api';
import type { Me } from '@/lib/types-auth';
import { haptic, useTg } from '@/components/tg/TgProvider';
import { BTN_GHOST, CARD, CHIP, PhoneCard } from '@/components/tg/bits';

const LOCALE_LABEL: Record<Locale, string> = { uz: "O'zbekcha", ru: 'Русский', en: 'English' };
const SITE = [['dashboard', '/dashboard'], ['terminals', '/terminals'], ['listings', '/equipment']] as const;

export default function TgProfilePage() {
  const t = useTranslations('tg.profile');
  const { tg, me, needsPhone, setMe, logout } = useTg();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  if (!me) return null;
  const initials = (me.fullName ?? '').split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const username = tg?.initDataUnsafe.user?.username;

  async function setLocale(l: Locale) {
    if (l === locale || busy) return;
    haptic(); setBusy(true);
    try { setMe(await api<Me>('/auth/me', { method: 'PATCH', body: JSON.stringify({ locale: l }) })); } catch { /* til faqat URL da o'zgaradi */ }
    setBusy(false);
    router.replace(pathname, { locale: l });
  }
  const open = (path: string) => { haptic(); tg?.openLink(`${window.location.origin}${locale === 'uz' ? '' : `/${locale}`}${path}`); };
  const out = async () => { haptic('medium'); await logout(); tg?.close(); };

  return (
    <main className="mx-auto max-w-md px-4 pb-8 pt-4">
      <h1 className="font-display text-xl font-bold">{t('title')}</h1>
      <section className={`${CARD} mt-4 flex items-center gap-4 p-4`}>
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-soft font-display text-lg font-bold text-teal-ink">
          {me.avatarUrl ? <img src={me.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials || '?'}
        </div>
        <div className="min-w-0">
          <p className="truncate font-bold">{me.fullName || t('noName')}</p>
          <p className="truncate font-mono text-sm text-muted">{me.phone ?? t('noPhone')}</p>
          {username ? <p className="truncate text-xs text-muted">{t('telegram', { username })}</p> : null}
        </div>
      </section>
      {needsPhone ? <div className="mt-3"><PhoneCard /></div> : null}

      <section className="mt-5">
        <h2 className="text-sm font-bold">{t('locale')}</h2>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {routing.locales.map((l) => <button key={l} type="button" aria-pressed={l === locale} disabled={busy} onClick={() => void setLocale(l)} className={CHIP(l === locale)}>{LOCALE_LABEL[l]}</button>)}
        </div>
      </section>

      <section className="mt-5">
        <Link href="/tg/subscription" onClick={() => haptic()} className={`${CARD} flex min-h-12 items-center justify-between px-4 text-sm font-semibold active:bg-sand`}>
          <span>{t('subscription')}</span><ArrowRightIcon size={16} className="text-muted" aria-hidden="true" />
        </Link>
      </section>

      <section className="mt-5">
        <h2 className="text-sm font-bold">{t('site')}</h2>
        <ul className={`${CARD} mt-2 divide-y divide-line`}>
          {SITE.map(([k, p]) => (
            <li key={k}><button type="button" onClick={() => open(p)} className="flex min-h-12 w-full items-center justify-between px-4 text-left text-sm font-semibold"><span>{t(`siteLinks.${k}`)}</span><ArrowSquareOutIcon size={16} className="text-muted" aria-hidden="true" /></button></li>
          ))}
        </ul>
      </section>

      <button type="button" onClick={out} className={`${BTN_GHOST} mt-8 text-red-700`}>{t('logout')}</button>
    </main>
  );
}
