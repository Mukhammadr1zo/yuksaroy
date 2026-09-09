// Hujjat uchun qisqa muddatli imzolangan havola: Mini App tashqi brauzerda ochadi, u yerda cookie ham, Bearer ham yo'q.
import { createHmac, timingSafeEqual } from 'node:crypto';

/** Havola amal qilish muddati: 10 daqiqa. */
export const DOC_LINK_TTL_SEC = 600;

/** "<id>.<exp>" ustidan HMAC-SHA256 (hex). Kalit: JWT_SECRET. */
export function signDocLink(id: string, exp: number, secret: string): string {
  return createHmac('sha256', secret).update(`${id}.${exp}`).digest('hex');
}

/** Muddat va imzo tekshiruvi; solishtirish vaqt bo'yicha xavfsiz. */
export function verifyDocLink(id: string, exp: unknown, sig: unknown, secret: string, nowSec = Math.floor(Date.now() / 1000)): boolean {
  const e = Number(exp);
  if (!Number.isInteger(e) || e < nowSec || typeof sig !== 'string') return false;
  const want = Buffer.from(signDocLink(id, e, secret), 'utf8');
  const got = Buffer.from(sig, 'utf8');
  return want.length === got.length && timingSafeEqual(want, got);
}
