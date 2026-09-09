import { getTranslations } from 'next-intl/server';
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr';
import { Link } from '@/i18n/navigation';
import type { Stats } from '@/lib/types';
import { num } from '@/lib/format';

/** To'rt qadam: Toping, Solishtiring, Bog'laning, Bron qiling. Har biri real sahifaga olib boradi. */
const STEPS = [
  { key: 's1', href: '/terminals' },
  { key: 's2', href: '/map' },
  { key: 's3', href: '/companies' },
  { key: 's4', href: '/booking' },
] as const;

export async function Steps() {
  const t = await getTranslations('features.how');
  return (
    <section className="border-y border-line bg-white">
      <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
        <h2 className="font-display text-2xl font-bold text-navy md:text-3xl">{t('heading')}</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.key}>
              <Link href={s.href} className="group flex h-full flex-col rounded-card border border-line bg-sand p-5 transition duration-200 hover:border-teal/60">
                <span className="font-mono text-xs font-semibold text-teal-ink">0{i + 1}</span>
                <span className="mt-2 font-display text-lg font-bold text-navy">{t(`${s.key}.title`)}</span>
                <span className="mt-1 flex-1 text-sm leading-relaxed text-muted">{t(`${s.key}.body`)}</span>
                <ArrowRightIcon size={18} className="mt-4 text-muted transition duration-200 group-hover:translate-x-1 group-hover:text-teal-ink" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const COUNTS = ['terminals', 'sidings', 'listings', 'companies', 'freeSlotsToday'] as const;

/** Platforma raqamlari: faqat /stats dagi real sanoqlar, nol bo'lganlari chizilmaydi. Hammasi nol bo'lsa bo'lim yo'q. */
export async function Numbers({ stats }: { stats: Stats | null }) {
  const t = await getTranslations('features.numbers');
  const items = stats ? COUNTS.map((k) => [k, stats[k] ?? 0] as const).filter(([, v]) => v > 0) : [];
  if (!items.length) return null;
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-teal-ink">{t('heading')}</h2>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
          {items.map(([k, v]) => (
            <div key={k} className="border-l border-line pl-4">
              <dd className="font-display text-3xl font-bold tabular-nums text-navy md:text-4xl">{num(v)}</dd>
              <dt className="mt-1 text-sm text-muted">{t(k)}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export async function HowItWorks({ stats }: { stats: Stats | null }) {
  return (
    <>
      <Steps />
      <Numbers stats={stats} />
    </>
  );
}
