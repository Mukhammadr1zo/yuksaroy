import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { JetBrains_Mono, Manrope, Unbounded } from 'next/font/google';
import { routing } from '@/i18n/routing';
import { OG_LOCALE, SITE } from '@/lib/seo';
import '../globals.css';
import { VisitBeacon } from '@/components/site/VisitBeacon';

// next/font: build vaqtida yuklanadi, self-host, layout shift yo'q (CLS ≤ .05)
// Kirill subseti uchala shriftda ham bor, ya'ni rus tili qo'shimcha fayl talab qilmaydi.
const display = Unbounded({ subsets: ['latin', 'cyrillic'], weight: ['600', '700'], variable: '--font-unbounded', display: 'swap' });
const body = Manrope({ subsets: ['latin', 'cyrillic'], weight: ['400', '500', '600', '700', '800'], variable: '--font-manrope', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin', 'cyrillic'], weight: ['400', '600'], variable: '--font-jetbrains', display: 'swap' });

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
    <html lang={locale} className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <NextIntlClientProvider>
          {children}
          <VisitBeacon />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
