import { defineRouting } from 'next-intl/routing';

/**
 * Uch til: o'zbek asosiy, shuning uchun uning URL'i prefiksiz qoladi (/terminals).
 * Rus va ingliz /ru/ va /en/ ostida. Tanlov NEXT_LOCALE cookie'sida bir yil saqlanadi.
 *
 * localeDetection: false - brauzer tili qaror qilmaydi. O'zbekistonda tizim tili
 * ko'pincha ruscha bo'ladi, shuning uchun accept-language foydalanuvchi xohishini
 * emas, kompyuter sozlamasini ko'rsatadi va sayt o'zbekcha kutgan odamga ruscha
 * ochilardi. Endi standart doim o'zbekcha; foydalanuvchining o'z tanlovi
 * (NEXT_LOCALE cookie) proxy.ts da hisobga olinadi.
 */
export const routing = defineRouting({
  locales: ['uz', 'ru', 'en'],
  defaultLocale: 'uz',
  localePrefix: 'as-needed',
  localeDetection: false,
  localeCookie: { maxAge: 60 * 60 * 24 * 365 },
});

export type Locale = (typeof routing.locales)[number];
