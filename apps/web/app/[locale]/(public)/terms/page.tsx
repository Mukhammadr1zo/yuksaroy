import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { LegalPage, legalDoc } from '@/components/site/LegalPage';
import { alt } from '@/lib/seo';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  // Matn next-intl lug'atida emas, shuning uchun getTranslations emas: to'g'ridan-to'g'ri o'qiladi
  const m = legalDoc(locale).terms.meta;
  return { title: m.title, description: m.description, ...alt(locale, '/terms') };
}

/** Foydalanish shartlari: statik matn, maxfiylik bilan bitta komponentdan. */
export default async function TermsPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage locale={locale} doc="terms" />;
}
