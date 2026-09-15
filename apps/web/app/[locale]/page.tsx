import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { sapi } from '@/lib/server-api';
import type { Stats } from '@/lib/types';
import { Header } from '@/components/site/Header';
import { MapHero } from '@/components/landing/MapHero';
import { CategoryGrid } from '@/components/landing/CategoryGrid';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Footer } from '@/components/site/Footer';
import { Ld, alt, url } from '@/lib/seo';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return alt((await params).locale);
}

// Landing: standardrail.com (SIDINGS) modeli. Xarita hero, ustida qidiruv, tagida real reestr sanoqlari.
// Narx va tarif bu yerda ko'rsatilmaydi: shartlarni obyekt egasi o'z sahifasida yozadi.
export default async function Landing({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, stats] = await Promise.all([
    getTranslations('landing'),
    // API javob bermasa nol emas, null: "0 shaxsiy yo'l" mahsulot bo'sh degan taassurot qoldirardi
    sapi<Stats>('/stats', 60).catch(() => null),
  ]);

  return (
    <>
      <Ld data={{
        '@context': 'https://schema.org', '@type': 'Organization', name: 'YukSaroy', url: url(locale),
        address: { '@type': 'PostalAddress', addressCountry: 'UZ' },
      }} />
      <Ld data={{
        '@context': 'https://schema.org', '@type': 'WebSite', name: 'YukSaroy', url: url(locale), inLanguage: locale,
        potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${url(locale, '/terminals')}?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
      }} />
      <Header />
      <main className="bg-sand">
        <MapHero terminals={stats?.terminals ?? null} />

        <div className="border-t border-line bg-white">
          <CategoryGrid />
        </div>

        <HowItWorks stats={stats} />

        <section className="bg-navy">
          <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
            <div className="grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-center">
              <div>
                <h2 className="font-display text-2xl font-bold text-white md:text-3xl">{t('owner.title')}</h2>
                <p className="mt-3 max-w-[52ch] text-white/70">{t('owner.body')}</p>
              </div>
              <div className="flex flex-wrap gap-3 md:justify-end">
                <Link href="/login?next=/dashboard" className="rounded-full bg-teal px-6 py-3 font-semibold text-white transition duration-200 hover:bg-teal-ink active:scale-[0.98]">
                  {t('cta.addObject')}
                </Link>
                <Link href="/terminals" className="rounded-full border border-white/25 px-6 py-3 font-semibold text-white transition duration-200 hover:bg-white/10">
                  {t('owner.ctaCatalog')}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
