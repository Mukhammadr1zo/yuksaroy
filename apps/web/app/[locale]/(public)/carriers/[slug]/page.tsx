import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ListingDetailView, listingMetadata } from '@/components/catalog/ListingDetailView';
import { Ld, alt, breadcrumbs, listingLd } from '@/lib/seo';

type Params = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Params) {
  const { locale, slug } = await params;
  return { ...(await listingMetadata(slug)), ...alt(locale, `/carriers/${slug}`) };
}

export default async function AvtoDetailPage({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  // JSON-LD: Product + Offer va yo'l zanjiri. Ikkinchi fetch yo'q, Next bir renderdagi bir xil so'rovni birlashtiradi.
  const [ld, tn] = await Promise.all([listingLd(locale, 'carriers', slug), getTranslations('nav2')]);
  return (
    <>
      {ld ? <Ld data={ld} /> : null}
      <Ld data={breadcrumbs(locale, [{ name: tn('carriers'), path: '/carriers' }, { name: ld?.name ?? slug, path: `/carriers/${slug}` }])} />
      <ListingDetailView slug={slug} section="carriers" />
    </>
  );
}
