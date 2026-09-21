import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { WagonSearch } from '@/components/wagon/WagonSearch';
import { alt } from '@/lib/seo';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'wagon.meta' });
  return { title: t('title'), description: t('description'), ...alt(locale, '/wagon') };
}

/** Vagon qidiruvi: bitta jumlali tushuntirish va forma; natija brauzerda (sessiya kerak). */
export default async function WagonPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('wagon');
  return (
    <section className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      <p className="font-mono text-xs uppercase tracking-wide text-teal-ink">{t('eyebrow')}</p>
      <h1 className="font-display mt-3 text-3xl font-bold text-navy md:text-4xl">{t('title')}</h1>
      <p className="mt-3 max-w-[60ch] text-lg text-muted">{t('lead')}</p>
      <div className="mt-8">
        <WagonSearch />
      </div>
    </section>
  );
}
