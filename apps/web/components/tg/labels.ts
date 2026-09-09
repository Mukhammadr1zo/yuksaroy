// Server va mijoz komponentlari uchun umumiy sof yordamchilar ('use client' emas: server sahifalar to'g'ridan-to'g'ri chaqiradi).
import { LISTING_LABELS, SEARCH_LABELS, formatSom, type PriceUnit, type RegionCode, type SearchLang } from '@yuksaroy/domain';

export const regionName = (code: string | null | undefined, lang: SearchLang) => (code ? SEARCH_LABELS[lang].region[code as RegionCode] ?? code : '');
/** "18 500 000 so'm oyiga"; SALE (TOTAL) da birlik yozilmaydi. */
export const listingPrice = (tiyin: number, unit: PriceUnit | null, lang: SearchLang) =>
  unit && unit !== 'TOTAL' ? `${formatSom(tiyin)} ${LISTING_LABELS[lang].priceUnit[unit]}` : formatSom(tiyin);
export const tgListingHref = (l: { kind: string; slug: string }) => `/tg/${l.kind === 'TRUCK' ? 'carriers' : 'equipment'}/${l.slug}`;
