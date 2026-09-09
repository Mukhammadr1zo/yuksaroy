import { uzDate } from '@/lib/format';

/** "8-sentabr 2026" (uz, Intl oy nomlari uz uchun ishlamaydi) yoki Intl (ru, en). */
export const postDate = (iso: string, locale: string) =>
  locale === 'uz' ? `${uzDate(iso)} ${iso.slice(0, 4)}` : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
