import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { RequestForm } from '@/components/market/RequestForm';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'cargo.new' });
  return { title: `${t('title')} · YukSaroy`, robots: { index: false } };
}

/** Yuk e'lon qilish: forma mijozda kirishni tekshiradi, mehmon kirish havolasini ko'radi. */
export default async function CargoNewPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('cargo');
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/cargo" className="text-sm font-semibold text-teal-ink hover:text-navy">{t('detail.back')}</Link>
      <h1 className="font-display mt-4 text-3xl font-bold text-navy">{t('new.title')}</h1>
      <p className="mt-2 max-w-[62ch] text-muted">{t('new.lead')}</p>
      <div className="mt-8 rounded-card border border-line bg-white p-5 md:p-6">
        <RequestForm board="CARGO" next="/cargo/new" />
      </div>
    </div>
  );
}
