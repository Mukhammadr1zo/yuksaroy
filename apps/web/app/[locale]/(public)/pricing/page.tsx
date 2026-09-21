import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CheckIcon } from '@phosphor-icons/react/dist/ssr';
import { PLATFORM_DEFAULTS, PRICING } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { DashLink } from '@/components/site/DashLink';
import { num } from '@/lib/format';
import { sapi } from '@/lib/server-api';
import { BTN, Faq } from '@/components/marketing/bits';
import { alt } from '@/lib/seo';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pricing.meta' });
  return { ...{ title: t('title'), description: t('description') }, ...alt(locale, '/pricing') };
}

/** Uch reja: Bepul, Premium (PRICING dan narx), Kelishuv. Komissiya qatori va 6 savol. Har tugma real sahifaga boradi. */
const PLANS = [
  { key: 'free', n: 4, href: '/dashboard/listings/new', hot: false },
  { key: 'premium', n: 5, href: '/dashboard/listings?premium=1', hot: true },
  { key: 'deal', n: 3, href: '/contact?topic=partner', hot: false },
] as const;

/** Obuna narxi admin panelida turadi; chaqiruv ishlamasa sahifa yiqilmasin, sukut narx ko'rsatiladi. */
type SubPrice = { pricePerMonthSom: number; phoneRevealDaily: number; wagonSearchFree: number };
const SUB_FALLBACK: SubPrice = {
  pricePerMonthSom: PLATFORM_DEFAULTS.subscriptionMonthSom,
  phoneRevealDaily: PLATFORM_DEFAULTS.phoneRevealDaily,
  wagonSearchFree: PLATFORM_DEFAULTS.wagonSearchFree,
};

export default async function PricingPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('pricing');
  const sub = await sapi<SubPrice>('/subscription/price').catch(() => SUB_FALLBACK);
  return (
    <>
      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-teal-ink">{t('eyebrow')}</p>
          <h1 className="mt-3 max-w-[22ch] font-display text-3xl font-bold leading-[1.08] text-navy md:text-5xl">{t('title')}</h1>
          <p className="mt-4 max-w-[58ch] text-lg text-muted">{t('lead')}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14 md:py-16">
        <ul className="grid gap-4 lg:grid-cols-3">
          {PLANS.map((p) => (
            <li key={p.key} className={`relative flex flex-col rounded-card border bg-white p-6 ${p.hot ? 'border-navy' : 'border-line'}`}>
              {p.hot ? <span className="absolute -top-3 left-6 rounded-full bg-navy px-3 py-1 font-mono text-[11px] font-semibold text-white">{t('premium.badge')}</span> : null}
              <h2 className="font-display text-lg font-bold text-navy">{t(`${p.key}.name`)}</h2>
              <p className="mt-3 font-display text-3xl font-bold tabular-nums text-navy">
                {p.key === 'premium' ? <>{num(PRICING.premiumPerListingPerMonthSom, locale)} <span className="font-mono text-base font-normal text-muted">{t('perMonth')}</span></> : t(`${p.key}.price`)}
              </p>
              <p className="mt-1 text-sm text-muted">{t(`${p.key}.note`)}</p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {Array.from({ length: p.n }, (_, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-ink/85">
                    <CheckIcon size={16} weight="bold" className="mt-0.5 shrink-0 text-teal-ink" aria-hidden="true" />{t(`${p.key}.f${i + 1}`)}
                  </li>
                ))}
              </ul>
              <DashLink href={p.href} className={`mt-6 ${p.hot ? BTN.primary : BTN.outline}`}>{t(`${p.key}.cta`)}</DashLink>
              {p.key === 'premium' ? <p className="mt-3 text-xs leading-relaxed text-muted">{t('premium.hint')}</p> : null}
            </li>
          ))}
        </ul>

        <div className="mt-8 grid gap-6 rounded-card border border-teal/40 bg-teal-soft p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-8">
          <div className="min-w-0">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-teal-ink">{t('subscription.heading')}</h2>
            <p className="mt-2 max-w-[52ch] text-lg font-semibold text-navy">{t('subscription.line')}</p>
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
              <li className="flex gap-2.5 text-sm text-ink/85">
                <CheckIcon size={16} weight="bold" className="mt-0.5 shrink-0 text-teal-ink" aria-hidden="true" />{t('subscription.f1', { phones: sub.phoneRevealDaily })}
              </li>
              <li className="flex gap-2.5 text-sm text-ink/85">
                <CheckIcon size={16} weight="bold" className="mt-0.5 shrink-0 text-teal-ink" aria-hidden="true" />{t('subscription.f2', { free: sub.wagonSearchFree })}
              </li>
              <li className="flex gap-2.5 text-sm text-ink/85">
                <CheckIcon size={16} weight="bold" className="mt-0.5 shrink-0 text-teal-ink" aria-hidden="true" />{t('subscription.f3')}
              </li>
            </ul>
            <p className="mt-4 max-w-[70ch] text-sm text-muted">{t('subscription.note')}</p>
          </div>
          <div className="shrink-0 md:text-right">
            <p className="font-display text-3xl font-bold tabular-nums text-navy">
              {num(sub.pricePerMonthSom, locale)} <span className="font-mono text-base font-normal text-muted">{t('perMonth')}</span>
            </p>
            <DashLink href="/dashboard/subscription" className={`mt-4 ${BTN.primary}`}>{t('subscription.cta')}</DashLink>
          </div>
        </div>

        <div className="mt-8 rounded-card border border-line bg-sand p-6">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-teal-ink">{t('commission.heading')}</h2>
          <p className="mt-2 max-w-[70ch] text-lg font-semibold text-navy">{t('commission.line')}</p>
          <p className="mt-2 max-w-[70ch] text-sm text-muted">{t('commission.note')}</p>
        </div>
      </section>

      <Faq ns="pricing.faq" count={6} />
    </>
  );
}
