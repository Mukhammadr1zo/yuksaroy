import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { RequestForm } from '@/components/market/RequestForm';

type Params = { params: Promise<{ locale: string }>; searchParams: Promise<{ type?: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'services.ask' });
  return { title: `${t('title')} · YukSaroy`, robots: { index: false } };
}

/** Xizmat so'rovi: ?type= profil sahifasidan keladi va forma shu tur bilan ochiladi. */
export default async function ServiceAskPage({ params, searchParams }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [{ type }, t] = await Promise.all([searchParams, getTranslations('services')]);
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/services" className="text-sm font-semibold text-teal-ink hover:text-navy">{t('detail.back')}</Link>
      <h1 className="font-display mt-4 text-3xl font-bold text-navy">{t('ask.title')}</h1>
      <p className="mt-2 max-w-[62ch] text-muted">{t('ask.lead')}</p>
      <div className="mt-8 rounded-card border border-line bg-white p-5 md:p-6">
        <RequestForm board="SERVICE" serviceType={type} />
      </div>
    </div>
  );
}
