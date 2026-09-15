import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CalendarCheckIcon, FilesIcon, ListChecksIcon, PathIcon, TagIcon } from '@phosphor-icons/react/dist/ssr';
import { sapi } from '@/lib/server-api';
import type { Stats } from '@/lib/types';
import { CtaBand, Faq, Hero, ValueCards } from '@/components/marketing/bits';
import { ShipperRoi } from '@/components/marketing/Roi';
import { alt } from '@/lib/seo';

export const revalidate = 300;
type Params = { params: Promise<{ locale: string }> };
const VALUES = [
  { key: 'tariffs', Icon: TagIcon }, { key: 'slots', Icon: CalendarCheckIcon }, { key: 'frozen', Icon: FilesIcon }, { key: 'chain', Icon: ListChecksIcon }, { key: 'registry', Icon: PathIcon },
] as const;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.shippers.meta' });
  return { ...{ title: t('title'), description: t('description') }, ...alt(locale, '/for-shippers') };
}

/** Yuk egalariga: qiymat kartalari, tejam hisoblagichi (brauzerda), FAQ, CTA. Sanoqlar /stats dan, bezak raqam yo'q. */
export default async function ForShippersPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, stats] = await Promise.all([getTranslations('marketing.shippers'), sapi<Stats>('/stats', 60).catch(() => null)]);
  const facts = stats ? [t('facts.terminals', { count: stats.terminals }), t('facts.freeSlots', { count: stats.freeSlotsToday ?? 0 })] : [];
  return (
    <>
      <Hero side="shippers" facts={facts} primary="/terminals" secondary="/quote" />
      <ValueCards side="shippers" items={VALUES} />
      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-16">
          <h2 className="font-display text-2xl font-bold text-navy md:text-3xl">{t('roi.heading')}</h2>
          <p className="mt-2 max-w-[62ch] text-muted">{t('roi.lead')}</p>
          <div className="mt-8"><ShipperRoi /></div>
        </div>
      </section>
      <Faq side="shippers" />
      <CtaBand title={t('band.title')} body={t('band.body')} primary={{ href: '/terminals?bookable=1', label: t('band.primary') }} secondary={{ href: '/signup', label: t('band.secondary') }} />
    </>
  );
}
