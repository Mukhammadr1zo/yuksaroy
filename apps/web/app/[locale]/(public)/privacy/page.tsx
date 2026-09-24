import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { LegalPage, legalDoc } from '@/components/site/LegalPage';
import { alt } from '@/lib/seo';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const m = legalDoc(locale).privacy.meta;
  return { title: m.title, description: m.description, ...alt(locale, '/privacy') };
}

/** Maxfiylik: statik matn, shartlar bilan bitta komponentdan. */
export default async function PrivacyPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage locale={locale} doc="privacy" />;
}
