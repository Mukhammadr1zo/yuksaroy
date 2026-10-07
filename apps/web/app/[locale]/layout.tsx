import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { OG_LOCALE, SITE } from '@/lib/seo';
import '../globals.css';
// Shriftlar (qaysi og'irlik, nima preload qilinadi va nega) shu faylda; 404 sahifasi ham shuni oladi
import { fontVars } from '../fonts';
import { SkipLink } from '@/components/site/SkipLink';
import { VisitBeacon } from '@/components/site/VisitBeacon';
import { CookieConsent } from '@/components/site/CookieConsent';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// alternates bu yerda yo'q: aks holda har bir sahifa "/" ga canonical bo'lib qolardi.
// og:url ham yo'q, xuddi shu sababdan: Next metadata'ni maydon bo'yicha almashtiradi,
// shuning uchun o'z openGraph'ini bermagan ichki sahifa bosh sahifaning og:url ini
// ko'rsatib turardi. To'g'ri og:url kerak bo'lgan sahifa lib/seo dagi pageMeta ni ishlatadi.

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const [t, ts] = await Promise.all([getTranslations({ locale, namespace: 'meta.site' }), getTranslations({ locale, namespace: 'seo2' })]);
  return {
    metadataBase: new URL(SITE),
    title: t('title'),
    description: t('description'),
    openGraph: { type: 'website', siteName: ts('siteName'), title: t('title'), description: t('description'), locale: OG_LOCALE[locale] },
    twitter: { card: 'summary_large_image', title: t('title'), description: t('description') },
    // Search Console va Yandex Webmaster egalikni shu teg bilan tasdiqlaydi.
    // Kod o'zgartirmasdan .env ga qo'yiladi; bo'sh bo'lsa teg umuman chiqmaydi.
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
      yandex: process.env.YANDEX_VERIFICATION || undefined,
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} className={fontVars}>
      <body>
        <NextIntlClientProvider>
          {/* Hamma narsadan oldin: birinchi Tab aynan shu havolaga tushsin */}
          <SkipLink />
          {children}
          <VisitBeacon />
          {/* Rozilik chizig'i aynan mayoqning yonida: mayoq shu javobga bog'liq, ya'ni
              so'rov ham u yurgan hamma yo'lda chiqishi kerak. Ilgari chiziq faqat (public)
              guruhida va bosh sahifada edi, /k/[slug] yoki /map ga kelgan odam esa umuman
              so'ralmay, tashrifi ham sanalmay qolardi. */}
          <CookieConsent />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
