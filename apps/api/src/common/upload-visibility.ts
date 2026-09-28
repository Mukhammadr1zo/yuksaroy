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
