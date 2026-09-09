import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { SITE } from '@/lib/seo';

// /robots.txt. NOINDEX=1 (dev, preview) bo'lsa butun sayt yopiladi.
const PRIVATE = ['/dashboard', '/tg', '/status', '/login', '/signup'];

export default function robots(): MetadataRoute.Robots {
  if (process.env.NOINDEX === '1') return { rules: [{ userAgent: '*', disallow: '/' }] };
  // Til prefikslari alohida yo'l: /ru/dashboard ham yopilsin
  const prefixes = ['', ...routing.locales.filter((l) => l !== routing.defaultLocale).map((l) => `/${l}`)];
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: prefixes.flatMap((p) => PRIVATE.map((x) => `${p}${x}`)) }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
