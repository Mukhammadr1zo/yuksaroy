import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ChatCircleTextIcon, ClipboardTextIcon, KanbanIcon, ReceiptIcon, SealCheckIcon } from '@phosphor-icons/react/dist/ssr';
import { sapi } from '@/lib/server-api';
import { subscriptionPrice } from '@/lib/subscription-price';
import type { Stats } from '@/lib/types';
import { CtaBand, Faq, Hero, ValueCards } from '@/components/marketing/bits';
import { ProviderRoi } from '@/components/marketing/Roi';
import { alt } from '@/lib/seo';
import { Link } from '@/i18n/navigation';

export const revalidate = 300;
type Params = { params: Promise<{ locale: string }> };
const VALUES = [
  { key: 'catalog', Icon: ClipboardTextIcon }, { key: 'inquiries', Icon: ChatCircleTextIcon }, { key: 'terminal', Icon: KanbanIcon }, { key: 'documents', Icon: ReceiptIcon }, { key: 'claim', Icon: SealCheckIcon },
] as const;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.providers.meta' });
  return { ...{ title: t('title'), description: t('description') }, ...alt(locale, '/for-providers') };
}

// Ikkinchi tugma ochiq /pricing: mehmonga ikkala kabinet havolasi bir xil "Ro'yxatdan o'tish" bo'lib qolardi (2026-11-02)
/** Xizmat ko'rsatuvchilarga: qiymat kartalari, daromad hisoblagichi (obuna narxi sozlamadan), FAQ, CTA. Kabinet havolalari proxy orqali /login?next= ga tushadi. */
export default async function ForProvidersPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, stats, sub] = await Promise.all([getTranslations('marketing.providers'), sapi<Stats>('/stats', 60).catch(() => null), subscriptionPrice()]);
  // Egasi qarori (2026-10-07): nol sanoq chizilmaydi, 1 va undan ko'pi asl soni bilan (/for-shippers kabi).
  // /stats endi namunasiz: kompaniya va e'lon soni haqiqiy, ya'ni hozircha juda kichik
  const facts = stats
    ? ([['companies', stats.companies ?? 0], ['listings', stats.listings ?? 0], ['terminals', stats.terminals]] as const).filter(([, v]) => v > 0).map(([k, v]) => t(`facts.${k}`, { count: v }))
    : [];
  return (
    <>
      <Hero side="providers" facts={facts} primary="/dashboard/listings/new" secondary="/pricing" />
      <ValueCards side="providers" items={VALUES} />
      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <h2 className="font-display text-2xl font-bold text-navy">{t('board.title')}</h2>
          <p className="mt-2 max-w-[70ch] text-muted">{t('board.body')}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {(['cargo', 'services', 'urgent'] as const).map((k) => (
              // Xizmat so'rovlari ijrochiga kabinetda keladi; /services esa buyurtmachi sahifasi
              <Link key={k} href={k === 'services' ? '/dashboard/market' : `/${k}`} className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-navy transition-colors hover:border-teal">{t(`board.${k === 'services' ? 'requests' : k}`)}</Link>
            ))}
          </div>
        </div>
      </section>
      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-16">
          <h2 className="font-display text-2xl font-bold text-navy md:text-3xl">{t('roi.heading')}</h2>
          <p className="mt-2 max-w-[62ch] text-muted">{t('roi.lead')}</p>
          <div className="mt-8"><ProviderRoi pricePerMonthSom={sub.pricePerMonthSom} /></div>
        </div>
      </section>
      <Faq side="providers" />
      <CtaBand title={t('band.title')} body={t('band.body')} primary={{ href: '/dashboard/listings/new', label: t('band.primary') }} secondary={{ href: '/signup', label: t('band.secondary') }} />
    </>
  );
}
