/**
 * Yuklangan fayl ommaviymi yoki maxfiy: nomning boshidagi belgidan bilinadi.
 *
 * Nega nomdan: yuklashlar bitta papkada, tasodifiy nom bilan turadi va ularning
 * maqsadi hech qayerda yozilmagan. E'lon fotosi ham, pasport nusxasi ham .jpg
 * bo'ladi, ya'ni kengaytma hech narsa aytmaydi. Nomga belgi qo'yish esa qo'shimcha
 * jadval, qo'shimcha so'rov va URL o'zgarishisiz ishlaydi: statik yo'lning oldidagi
 * qorovul faqat nomga qarab qaror qiladi.
 *
 * Nega belgi MAXFIYda, ommaviyda emas: belgisiz eski fayllar ommaviy bo'lib qoladi,
 * ya'ni katalogdagi mavjud suratlar buzilmaydi. Teskarisi qilinsa, eski hamma surat
 * birdaniga kirish talab qilardi va mehmon uchun katalog bo'sh ko'rinardi.
 *
 * DIQQAT: bu o'zgarishdan OLDIN yuklangan maxfiy fayllar (KYC hujjatlari, da'vo
 * dalillari, yozishma fayllari) belgisiz nom bilan turadi va ochiq qolaveradi.
 * Ularni himoyalash uchun diskda qayta nomlash va bazadagi URL ni yangilash kerak.
 */
export const PRIVATE_PREFIX = 'd_';

/**
 * Yo'l maxfiy faylga tegishlimi. Faqat oxirgi bo'lakning boshiga qaraydi:
 * papka nomida yoki nomning o'rtasida uchragan "d_" hisobga olinmaydi.
 */
export function isPrivateFilePath(pathname: string): boolean {
  const clean = pathname.split('?')[0]!.split('#')[0]!;
  const name = clean.split('/').pop() ?? '';
  return name.startsWith(PRIVATE_PREFIX);
}

/**
 * Kelgan so'rov maxfiy faylgami: statik yo'lning oldidagi qorovul shunga qaraydi (main.ts).
 *
 * Xom manzil emas, bir marta ochilgani (decode) tekshiriladi, chunki yo'naltirgich (find-my-way)
 * ham yo'lni ochib, faylni ochilgan nom bo'yicha beradi. Ilgari xom manzil tekshirilardi va
 * "%64_..." (d harfi), "d%5F...", "10%2Fd_..." yoki "/v1/%66iles/..." qorovuldan o'tib, maxfiy
 * faylni sessiyasiz berardi (2026-10-07 da takrorlab ko'rildi). nginx ning /v1/ yo'li manzilni
 * xom holda uzatadi, ya'ni bu tashqaridan ham ishlardi.
 *
 * Ochib bo'lmaydigan (buzuq %) manzil maxfiy deb olinadi: yo'naltirgich uni baribir 400 bilan rad
 * etadi, shubhali so'rov esa hech qachon faylga yetmasin.
 */
export function isPrivateFileRequest(rawUrl: string): boolean {
  let path: string;
  try { path = decodeURIComponent(rawUrl.split('?')[0]!); } catch { return true; }
  return path.startsWith('/v1/files/') && isPrivateFilePath(path);
}
