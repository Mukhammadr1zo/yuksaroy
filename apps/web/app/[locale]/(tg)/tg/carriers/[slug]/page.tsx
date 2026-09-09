import { setRequestLocale } from 'next-intl/server';
import { TgListingView } from '@/components/tg/ListingView';

export const revalidate = 60;

export default async function TgCarrierPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <TgListingView slug={slug} section="carriers" />;
}
