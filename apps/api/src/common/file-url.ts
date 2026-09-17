import { env } from './env';
import { FILE_EXT, PHOTO_EXT, fileUrlPattern } from './security';

/**
 * Yuklangan fayl manzillari uchun tayyor shablonlar.
 *
 * Alohida fayl, chunki security.ts sof funksiyalar joyi va u sozlamani o'qimaydi.
 * Asos uploads.controller fayl manzilini yasaganda ishlatadigan qiymat bilan bir xil:
 * ikkalasi bir manbadan olinsa, yasalgan manzil har doim tekshiruvdan o'tadi.
 */
const BASE = (env.API_PUBLIC_URL ?? 'http://localhost:4000').replace(/\/+$/, '');

export const PHOTO_URL = fileUrlPattern(BASE, PHOTO_EXT);
export const FILE_URL = fileUrlPattern(BASE, FILE_EXT);
