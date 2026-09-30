'use client';
import { useTranslations } from 'next-intl';

/**
 * Klaviatura bilan yuradigan odam har sahifada sarlavha va menyu havolalarini birma-bir bosib
 * o'tmasin: birinchi Tab shu havolani chiqaradi va u to'g'ri <main id="main"> ga tashlaydi.
 *
 * Sichqoncha bilan ko'rinmasligi kerak, shuning uchun sr-only; fokus tushganda not-sr-only uni
 * qaytaradi. Tailwind da "fixed" qoidasi "not-sr-only" dan keyin chiqadi, ya'ni uning
 * position: static ini bosadi va havola chap yuqorida suzib turadi. Shu sabab yangi CSS kerak emas.
 */
export function SkipLink() {
  const t = useTranslations('a11y');
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-navy focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
    >
      {t('skip')}
    </a>
  );
}
