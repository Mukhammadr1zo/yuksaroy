import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { SearchLang } from '@yuksaroy/domain';
import { parseIds } from '@/lib/compare';
import { ListingCompare } from '@/components/compare/ListingCompare';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: 'compare.title' });
  return { title: `${t('carriers')} · YukSaroy`, robots: { index: false } };
}

/** Avtotransportni solishtirish: ?ids=slug,slug (ko'pi bilan 3). */
export default async function CarriersComparePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const slugs = parseIds(one((await searchParams).ids));
  return <ListingCompare cat="carriers" slugs={slugs} lang={locale as SearchLang} />;
}
