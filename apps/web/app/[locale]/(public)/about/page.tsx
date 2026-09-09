import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { InfoIcon, ScalesIcon, TagIcon, UserCircleIcon } from '@phosphor-icons/react/dist/ssr';
import { Link } from '@/i18n/navigation';
import { BTN } from '@/components/marketing/bits';
import { alt } from '@/lib/seo';

type Params = { params: Promise<{ locale: string }> };
const PRINCIPLES = [{ key: 'open', Icon: TagIcon }, { key: 'fair', Icon: ScalesIcon }, { key: 'owners', Icon: UserCircleIcon }] as const;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about.meta' });
  return { ...{ title: t('title'), description: t('description') }, ...alt(locale, '/about') };
}

/** Biz haqimizda: xususiy kompaniya, davlat temir yo'liga aloqasi yo'q; platforma nima qiladi; uch tamoyil; bog'lanish. Statik. */
export default async function AboutPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('about');
  return (
    <>
      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-teal-ink">{t('eyebrow')}</p>
          <h1 className="mt-3 max-w-[22ch] font-display text-3xl font-bold leading-[1.08] text-navy md:text-5xl">{t('title')}</h1>
          <p className="mt-4 max-w-[58ch] text-lg text-muted">{t('lead')}</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-2 md:py-16">
        <div>
          <h2 className="font-display text-2xl font-bold text-navy">{t('who.heading')}</h2>
          <p className="mt-3 max-w-[58ch] leading-relaxed text-ink/85">{t('who.body')}</p>
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold text-navy">{t('what.heading')}</h2>
          <ul className="mt-3 space-y-2.5">
            {([1, 2, 3, 4] as const).map((i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-[1.5] text-ink/85">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" aria-hidden="true" />{t(`what.i${i}`)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-16">
          <h2 className="font-display text-2xl font-bold text-navy md:text-3xl">{t('principles.heading')}</h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {PRINCIPLES.map(({ key, Icon }) => (
              <li key={key} className="rounded-card border border-line bg-sand p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-teal-ink"><Icon size={22} aria-hidden="true" /></span>
                <h3 className="mt-4 font-display text-lg font-bold text-navy">{t(`principles.${key}.title`)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{t(`principles.${key}.body`)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex max-w-[80ch] items-start gap-3 rounded-card border border-amber/40 bg-amber-soft px-5 py-4">
            <InfoIcon size={20} className="mt-0.5 shrink-0 text-amber-ink" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-ink">{t('notRailway.heading')}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink/85">{t('notRailway.body')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-navy">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 md:grid-cols-[1.4fr_1fr] md:items-center md:py-20">
          <div>
            <h2 className="font-display text-2xl font-bold text-white md:text-3xl">{t('contact.heading')}</h2>
            <p className="mt-3 max-w-[52ch] text-white/70">{t('contact.body')}</p>
          </div>
          <div className="flex flex-wrap gap-3 md:justify-end">
            <Link href="/contact" className={BTN.primary}>{t('contact.cta')}</Link>
            <a href="https://t.me/yuksaroy_bot" target="_blank" rel="noreferrer" className="rounded-full border border-white/25 px-6 py-3 text-center font-semibold text-white transition duration-200 hover:bg-white/10">{t('contact.telegram')}</a>
          </div>
        </div>
      </section>
    </>
  );
}
