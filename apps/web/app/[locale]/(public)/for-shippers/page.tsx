import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CalendarCheckIcon, FilesIcon, ListChecksIcon, PathIcon, TagIcon } from '@phosphor-icons/react/dist/ssr';
import { sapi } from '@/lib/server-api';
import type { Stats } from '@/lib/types';
import { CtaBand, Faq, Hero, ValueCards } from '@/components/marketing/bits';
import { ShipperRoi } from '@/components/marketing/Roi';
import { Explainer } from '@/components/landing/Explainer';
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
  const [t, th, stats] = await Promise.all([getTranslations('marketing.shippers'), getTranslations('how'), sapi<Stats>('/stats', 60).catch(() => null)]);
  // Egasi qarori (2026-10-07): nol sanoq chizilmaydi, 1 va undan ko'pi asl soni bilan (bosh sahifadagi Numbers kabi)
  const facts = stats ? ([['terminals', stats.terminals], ['freeSlots', stats.freeSlotsToday ?? 0]] as const).filter(([, v]) => v > 0).map(([k, v]) => t(`facts.${k}`, { count: v })) : [];
  return (
    <>
      <Hero side="shippers" facts={facts} primary="/terminals" secondary="/quote" />
      <ValueCards side="shippers" items={VALUES} />
      {/* Kartalar nima berilishini aytadi, hisoblagich esa pulni sanaydi. Ko'rgazma ikkisining
          o'rtasida turadi: avval nima borligi, keyin qanday olinishi, keyin qanchaga tushishi. */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-16">
          <h2 className="font-display text-2xl font-bold text-navy md:text-3xl">{th('heading')}</h2>
          <div className="mt-8"><Explainer /></div>
        </div>
      </section>
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
