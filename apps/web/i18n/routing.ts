import { defineRouting } from 'next-intl/routing';

/**
 * Uch til: o'zbek asosiy, shuning uchun uning URL'i prefiksiz qoladi (/terminals).
 * Rus va ingliz /ru/ va /en/ ostida. Tanlov NEXT_LOCALE cookie'sida bir yil saqlanadi.
 */
export const routing = defineRouting({
  locales: ['uz', 'ru', 'en'],
  defaultLocale: 'uz',
  localePrefix: 'as-needed',
  localeCookie: { maxAge: 60 * 60 * 24 * 365 },
});

export type Locale = (typeof routing.locales)[number];
