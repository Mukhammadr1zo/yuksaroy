import { getTranslations } from 'next-intl/server';
import type { Icon } from '@phosphor-icons/react';
import { CaretDownIcon } from '@phosphor-icons/react/dist/ssr';
import { Link } from '@/i18n/navigation';

// Marketing sahifalari (for-shippers, for-providers, booking) uchun umumiy bo'laklar. Matnlar marketing.<side> nomfazosidan.
export type Side = 'shippers' | 'providers';
export const BTN = {
  primary: 'rounded-full bg-teal px-6 py-3 text-center font-semibold text-white transition duration-200 hover:bg-teal-ink active:scale-[0.98]',
  outline: 'rounded-full border border-navy px-6 py-3 text-center font-semibold text-navy transition duration-200 hover:bg-sand',
} as const;

/** Sarlavha bloki: eyebrow, h1, lead, real sanoqlar (/stats), ikki CTA. facts bo'sh bo'lsa qator chizilmaydi. */
export async function Hero({ side, facts, primary, secondary }: { side: Side; facts: string[]; primary: string; secondary: string }) {
  const t = await getTranslations(`marketing.${side}`);
  return (
    <section className="border-b border-line bg-white">
      <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-teal-ink">{t('eyebrow')}</p>
        <h1 className="mt-3 max-w-[24ch] font-display text-3xl font-bold leading-[1.08] text-navy md:text-5xl">{t('title')}</h1>
        <p className="mt-4 max-w-[58ch] text-lg text-muted">{t('lead')}</p>
        {facts.length ? <p className="mt-6 font-mono text-sm text-navy tabular-nums">{facts.join(' · ')}</p> : null}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={primary} className={BTN.primary}>{t('cta.primary')}</Link>
          <Link href={secondary} className={BTN.outline}>{t('cta.secondary')}</Link>
        </div>
      </div>
    </section>
  );
}

/** Besh qiymat kartasi: birinchisi keng (2 ustun), qolgan to'rttasi oddiy. */
export async function ValueCards({ side, items }: { side: Side; items: readonly { key: string; Icon: Icon }[] }) {
  const [t, tc] = await Promise.all([getTranslations(`marketing.${side}.values`), getTranslations('marketing.common')]);
  return (
    <section className="mx-auto max-w-6xl px-6 py-14 md:py-16">
      <h2 className="font-display text-2xl font-bold text-navy md:text-3xl">{tc('values')}</h2>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ key, Icon }, i) => (
          <li key={key} className={`flex gap-4 rounded-card border border-line bg-white p-5 transition duration-200 hover:border-teal/50 ${i === 0 ? 'lg:col-span-2' : ''}`}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-soft text-teal-ink"><Icon size={22} aria-hidden="true" /></span>
            <div>
              <h3 className="font-semibold text-ink">{t(`${key}.title`)}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t(`${key}.body`)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Savollar, native details: JS yo'q, klaviatura bilan ochiladi. ns berilsa shu nomfazo (masalan pricing.faq), count ta savol. */
export async function Faq({ side, ns, count = 5 }: { side?: Side; ns?: string; count?: number }) {
  const [t, tc] = await Promise.all([getTranslations(ns ?? `marketing.${side}.faq`), getTranslations('marketing.common')]);
  return (
    <section className="border-t border-line bg-white">
      <div className="mx-auto max-w-6xl px-6 py-14 md:py-16">
        <h2 className="font-display text-2xl font-bold text-navy md:text-3xl">{tc('faq')}</h2>
        <div className="mt-6 divide-y divide-line rounded-card border border-line">
          {Array.from({ length: count }, (_, i) => i + 1).map((i) => (
            <details key={i} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {t(`q${i}`)}
                <CaretDownIcon size={18} className="shrink-0 text-muted transition duration-200 group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="mt-3 max-w-[70ch] text-sm leading-relaxed text-muted">{t(`a${i}`)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

type Cta = { href: string; label: string };
/** To'q ko'k CTA tasmasi (landing bilan bir xil). Matnlar tayyor holda keladi. */
export function CtaBand({ title, body, primary, secondary }: { title: string; body: string; primary: Cta; secondary: Cta }) {
  return (
    <section className="bg-navy">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 md:grid-cols-[1.4fr_1fr] md:items-center md:py-20">
        <div>
          <h2 className="font-display text-2xl font-bold text-white md:text-3xl">{title}</h2>
          <p className="mt-3 max-w-[52ch] text-white/70">{body}</p>
        </div>
        <div className="flex flex-wrap gap-3 md:justify-end">
          <Link href={primary.href} className={BTN.primary}>{primary.label}</Link>
          <Link href={secondary.href} className="rounded-full border border-white/25 px-6 py-3 text-center font-semibold text-white transition duration-200 hover:bg-white/10">{secondary.label}</Link>
        </div>
      </div>
    </section>
  );
}
