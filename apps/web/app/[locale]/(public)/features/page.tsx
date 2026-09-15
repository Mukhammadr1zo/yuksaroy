import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Icon } from '@phosphor-icons/react';
import {
  ArrowRightIcon, ArticleIcon, BuildingsIcon, CalendarCheckIcon, ChartBarIcon, ColumnsIcon, FilesIcon, ListChecksIcon, MagnifyingGlassIcon,
  MapPinIcon, MapTrifoldIcon, PathIcon, SirenIcon, SparkleIcon, StarIcon, TagIcon, TrainIcon, WarehouseIcon, CalculatorIcon,
} from '@phosphor-icons/react/dist/ssr';
import { Link } from '@/i18n/navigation';
import { DashLink } from '@/components/site/DashLink';
import { Steps } from '@/components/landing/HowItWorks';
import { alt } from '@/lib/seo';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'features.meta' });
  return { ...{ title: t('title'), description: t('description') }, ...alt(locale, '/features') };
}

/** To'rt guruh, har birida real imkoniyat va uning sahifasi. "Tez kunda" yo'q: bu yerda faqat ishlayotgan narsa. */
type Item = { key: string; href: string; Icon: Icon };
const GROUPS: { key: 'find' | 'list' | 'book' | 'data'; items: Item[] }[] = [
  { key: 'find', items: [
    { key: 'catalog', href: '/terminals', Icon: MagnifyingGlassIcon },
    { key: 'map', href: '/map', Icon: MapTrifoldIcon },
    { key: 'assistant', href: '/features/assistant', Icon: SparkleIcon },
    { key: 'compare', href: '/terminals/compare', Icon: ColumnsIcon },
    { key: 'hubs', href: '/terminals/region/UZ-TK', Icon: MapPinIcon },
  ] },
  { key: 'list', items: [
    { key: 'listing', href: '/dashboard/listings/new', Icon: TrainIcon },
    { key: 'terminal', href: '/dashboard/terminals/new', Icon: WarehouseIcon },
    { key: 'siding', href: '/dashboard/sidings', Icon: PathIcon },
    { key: 'premium', href: '/pricing', Icon: TagIcon },
    { key: 'analytics', href: '/dashboard/listings', Icon: ChartBarIcon },
  ] },
  { key: 'book', items: [
    { key: 'quote', href: '/quote', Icon: CalculatorIcon },
    { key: 'booking', href: '/booking', Icon: CalendarCheckIcon },
    { key: 'frozen', href: '/for-shippers', Icon: FilesIcon },
    { key: 'reviews', href: '/terminals', Icon: StarIcon },
    { key: 'urgent', href: '/urgent', Icon: SirenIcon },
  ] },
  { key: 'data', items: [
    { key: 'registry', href: '/terminals?kind=RAIL', Icon: PathIcon },
    { key: 'standards', href: '/standards', Icon: ListChecksIcon },
    { key: 'companies', href: '/companies', Icon: BuildingsIcon },
    { key: 'blog', href: '/blog', Icon: ArticleIcon },
  ] },
];

export default async function FeaturesPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('features');
  return (
    <>
      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-teal-ink">{t('eyebrow')}</p>
          <h1 className="mt-3 max-w-[22ch] font-display text-3xl font-bold leading-[1.08] text-navy md:text-5xl">{t('title')}</h1>
          <p className="mt-4 max-w-[58ch] text-lg text-muted">{t('lead')}</p>
        </div>
      </section>

      {GROUPS.map((g, gi) => (
        <section key={g.key} className={gi % 2 ? 'border-y border-line bg-white' : ''}>
          <div className="mx-auto max-w-6xl px-6 py-12 md:py-14">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-xs font-semibold text-teal-ink">0{gi + 1}</span>
              <h2 className="font-display text-2xl font-bold text-navy md:text-3xl">{t(`groups.${g.key}.title`)}</h2>
            </div>
            <p className="mt-2 max-w-[62ch] text-muted">{t(`groups.${g.key}.lead`)}</p>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map(({ key, href, Icon }) => (
                <li key={key}>
                  <DashLink href={href} className="group flex h-full gap-4 rounded-card border border-line bg-white p-5 transition duration-200 hover:border-teal/60">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-soft text-teal-ink"><Icon size={22} aria-hidden="true" /></span>
                    <span className="flex-1">
                      <span className="flex items-center justify-between gap-2 font-semibold text-ink">
                        {t(`items.${key}.title`)}
                        <ArrowRightIcon size={16} className="shrink-0 text-muted transition duration-200 group-hover:translate-x-1 group-hover:text-teal-ink" aria-hidden="true" />
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-muted">{t(`items.${key}.body`)}</span>
                    </span>
                  </DashLink>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      <Steps />
    </>
  );
}
