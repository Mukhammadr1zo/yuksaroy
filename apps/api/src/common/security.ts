/** Xavfsizlik yordamchilari: sarlavhalar, proksi ishonchi, fayl imzosi. Sof funksiyalar (test qilinadi). */

/**
 * Har javobga qo'yiladigan sarlavhalar (helmet o'rniga qo'lda, yangi paketsiz).
 * API JSON qaytaradi, shuning uchun CSP faqat /docs (Swagger UI) uchun; HSTS faqat prodda.
 */
export function securityHeaders(url: string, isProd: boolean): Record<string, string> {
  const h: Record<string, string> = {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  };
  if (isProd) h['strict-transport-security'] = 'max-age=15552000; includeSubDomains';
  if (url.startsWith('/docs')) {
    h['content-security-policy'] = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'";
  }
  return h;
}

/** TRUST_PROXY: bo'sh/false = o'chiq, true = yoqilgan, raqam = hop soni, qolgani = CIDR ro'yxati. */
export function parseTrustProxy(v: string | undefined): boolean | number | string {
  const s = v?.trim();
  if (!s || s === 'false') return false;
  if (s === 'true') return true;
  return /^\d+$/.test(s) ? Number(s) : s;
}

/** Yuklangan foto URL shakli: uploads controller aynan shunday chiqaradi
 * (<host>/v1/files/YYYY/MM/<24hex>.<ext>). Boshqa har qanday satr rad etiladi:
 * begona URL, data: yoki javascript: <img src> ga tushmaydi. */
export const PHOTO_EXT = 'jpg|png|webp';
/** Yozishmaga biriktiriladigan fayl: rasmlardan tashqari hujjat ham bo'ladi. */
export const FILE_EXT = 'jpg|png|webp|pdf|docx|xlsx';

/**
 * Manzil shakli, o'z domenimizga bog'langan holda.
 *
 * Ilgari host qismi har qanday satrga mos kelardi, ya'ni mijoz begona serverdagi
 * manzilni ham "bizning fayl" deb yuborishi mumkin edi. Yozishmada u ikkinchi
 * tomonning brauzerida <img src> bo'lib ochilardi va yozuvchi o'qilgan vaqtni,
 * IP va brauzerni bilib olardi. Endi faqat o'zimiz bergan manzil o'tadi.
 */
export function fileUrlPattern(base: string, exts: string): RegExp {
  const host = base.replace(/\/+$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${host}/v1/files/\\d{4}/\\d{2}/[0-9a-f]{24}\\.(?:${exts})$`);
}

/** Fayl mazmuni bo'yicha tur (magic bytes). Mijoz e'lon qilgan mimetype ga ishonilmaydi. */
export function detectImageExt(buf: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 8 && buf.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return 'png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

/**
 * Hujjat imzosi. docx/xlsx ichida ZIP yotadi, shuning uchun ularni bir-biridan
 * mazmun bo'yicha ajratib bo'lmaydi: ZIP ekani tasdiqlanadi, aniq turni esa mijoz
 * aytgan mimetype belgilaydi. Bu xavfsiz, chunki fayl brauzerda bajarilmaydi
 * (nosniff sarlavhasi bor) va nomi tasodifiy beriladi.
 */
export function detectDocExt(buf: Buffer, mimetype: string): 'pdf' | 'docx' | 'xlsx' | null {
  if (buf.length >= 5 && buf.toString('ascii', 0, 5) === '%PDF-') return mimetype === 'application/pdf' ? 'pdf' : null;
  const zip = buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
  if (!zip) return null;
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';
  return null;
}
