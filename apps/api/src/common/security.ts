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
export const PHOTO_URL = /^https?:\/\/[^\s/]+\/v1\/files\/\d{4}\/\d{2}\/[0-9a-f]{24}\.(?:jpg|png|webp)$/;

/** Fayl mazmuni bo'yicha tur (magic bytes). Mijoz e'lon qilgan mimetype ga ishonilmaydi. */
export function detectImageExt(buf: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 8 && buf.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return 'png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}
