import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CraneIcon, TrainIcon, WrenchIcon } from '@phosphor-icons/react/dist/ssr';
import { URGENT_KIND_LABELS, type SearchLang, type UrgentKind } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { CtaBand } from '@/components/marketing/bits';
import { alt } from '@/lib/seo';
import { DashLink } from '@/components/site/DashLink';

type Params = { params: Promise<{ locale: string }> };
const KINDS: { kind: UrgentKind; Icon: typeof TrainIcon }[] = [{ kind: 'LOCO_CALL', Icon: TrainIcon }, { kind: 'WAGON_REPAIR', Icon: WrenchIcon }, { kind: 'CRANE', Icon: CraneIcon }];

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'urgent.meta' });
  return { ...{ title: t('title'), description: t('description') }, ...alt(locale, '/urgent') };
}

/** Shoshilinch xizmat tushuntiruvchisi: uch tur, uch qadam, CTA kabinetga (kirmagan bo'lsa proxy /login?next= ga yuboradi). */
export default async function UrgentPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, td] = await Promise.all([getTranslations('urgent.public'), getTranslations('urgent.kindDesc')]);
  const labels = URGENT_KIND_LABELS[locale as SearchLang] ?? URGENT_KIND_LABELS.uz;
  return (
    <>
      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
          <p className="font-mono text-xs uppercase tracking-wide text-teal-ink">{t('eyebrow')}</p>
          <h1 className="font-display mt-3 max-w-[20ch] text-3xl font-bold text-navy md:text-5xl">{t('title')}</h1>
          <p className="mt-4 max-w-[62ch] text-lg text-muted">{t('lead')}</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <DashLink href="/dashboard/urgent" className="rounded-full bg-teal px-7 py-3 font-semibold text-white transition hover:bg-teal-ink active:scale-[0.98]">{t('cta')}</DashLink>
            <span className="text-sm text-muted">{t('ctaNote')}</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="font-display text-2xl font-bold text-navy">{t('kindsTitle')}</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {KINDS.map(({ kind, Icon }) => (
            <article key={kind} className="rounded-card border border-line bg-white p-6 transition hover:border-teal">
              <Icon size={32} weight="duotone" className="text-teal" aria-hidden="true" />
              <h3 className="mt-4 text-lg font-bold">{labels[kind]}</h3>
              <p className="mt-2 text-sm text-muted">{td(kind)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="font-display text-2xl font-bold text-navy">{t('howTitle')}</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {(['s1', 's2', 's3'] as const).map((s, i) => (
              <li key={s} className="rounded-card border border-line bg-sand p-6">
                <span className="font-display text-3xl font-bold text-teal">{i + 1}</span>
                <h3 className="mt-2 font-bold">{t(`steps.${s}.title`)}</h3>
                <p className="mt-1 text-sm text-muted">{t(`steps.${s}.body`)}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 rounded-card border border-amber/30 bg-amber-soft px-4 py-3 text-sm text-amber-ink">{t('noPrice')}</p>
        </div>
      </section>

      <CtaBand title={t('band.title')} body={t('band.body')} primary={{ href: '/dashboard/urgent/offers', label: t('band.primary') }} secondary={{ href: '/for-providers', label: t('band.secondary') }} />
    </>
  );
}
