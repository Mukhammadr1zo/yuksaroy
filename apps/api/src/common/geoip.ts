import { open, type Reader, type CityResponse } from 'maxmind';
import { env } from './env';
import { regionOfPoint } from '../modules/catalog/domain/region-of-point';

/**
 * IP manzilidan davlat va viloyat.
 *
 * Viloyat MaxMind ning o'z bo'linma kodidan emas, koordinatadan olinadi: loyihada
 * koordinatani viloyatga aylantiradigan tekshirilgan funksiya allaqachon bor va u
 * viloyat kodlarini loyihaning o'z ro'yxati bilan bir xil beradi. Bo'linma kodlarini
 * moslashtirish esa yana bitta jadval va yana bitta yangilanadigan manba degani.
 *
 * DIQQAT: O'zbekiston ichida IP bo'yicha viloyat ishonchsiz. Mobil operatorlar va
 * Uztelecom trafikni Toshkentdagi manzil bloklaridan chiqaradi, ya'ni raqamlarning
 * katta qismi Toshkentga tushadi. Davlat darajasi ishonchli.
 *
 * Baza fayli bo'lmasa yoki ochilmasa xizmat yiqilmaydi: tashrif "ZZ" bo'lib yoziladi.
 */
export type Geo = { country: string; region: string };
const UNKNOWN: Geo = { country: 'ZZ', region: '' };

// Promise keshlanadi, o'quvchining o'zi emas: sovuq startda bir vaqtda kelgan bir necha
// so'rov faylni bir necha marta xotiraga olib, konteynerni o'ldirib qo'yardi
let reading: Promise<Reader<CityResponse> | null> | undefined;

function reader(): Promise<Reader<CityResponse> | null> {
  return (reading ??= open<CityResponse>(env.GEOIP_DB!).catch((e: unknown) => {
    // Bir marta yoziladi: keyingi chaqiruvlar shu promise ni oladi
    console.warn(`joy bazasi ochilmadi (${(e as Error).message}), tashriflar ZZ bo'lib yoziladi`);
    return null;
  }));
}

/**
 * Ichki tarmoq manzili. Bunday manzil kelishi proksi zanjiri haqiqiy IP ni
 * uzatmayotganini bildiradi: o'shanda joy bazasi bo'lsa ham hamma tashrif
 * "ZZ" bo'lib yoziladi va xarita bo'sh qoladi, sababi esa hech qayerda ko'rinmaydi.
 */
const PRIVATE = /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::1$|f[cd])/i;
let warned = false;

export async function locate(ip: string | null | undefined): Promise<Geo> {
  if (!env.GEOIP_DB || !ip) return UNKNOWN;
  if (PRIVATE.test(ip)) {
    if (!warned) {
      warned = true;
      console.warn(`tashrif ichki manzildan keldi (${ip}): nginx yoki web konteyneri haqiqiy IP ni uzatmayapti, xarita bo'sh qoladi`);
    }
    return UNKNOWN;
  }
  const r = await reader();
  if (!r) return UNKNOWN;
  const rec = r.get(ip);
  if (!rec) return UNKNOWN;
  const country = rec.country?.iso_code ?? rec.registered_country?.iso_code ?? 'ZZ';
  const lat = rec.location?.latitude;
  const lng = rec.location?.longitude;
  const region = country === 'UZ' && lat != null && lng != null ? (regionOfPoint(lat, lng) ?? '') : '';
  return { country, region };
}
