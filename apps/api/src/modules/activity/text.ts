import { clip, esc } from '../../common/telegram';

// Katalog va xabar yig'uvchi umumiy kichik yordamchilar. Foydalanuvchi matni hammasi shu yerdan o'tadi.

/** href atributi uchun: esc + qo'shtirnoq. */
export const attr = (s: string) => esc(s).replace(/"/g, '&quot;');

/** Foydalanuvchi matni: qisqartirilgan va tegsiz. Satr/son bo'lmasa yo'q (mantiqiy qiymat va id hech qachon chiqmaydi). */
export const s = (v: unknown, max = 60): string | undefined =>
  (typeof v === 'string' || typeof v === 'number') && String(v).trim() !== '' ? esc(clipCp(String(v).trim(), max)) : undefined;
/** Kod nuqtasi bo'yicha qisqartirish: emoji o'rtasidan kesilmaydi (yolg'iz surrogat Telegramda 400 beradi). */
export const clipCp = (t: string, max: number): string => {
  const a = Array.from(t);
  return a.length > max ? a.slice(0, max - 1).join('') + '…' : t;
};
export const q = (v: unknown): string | undefined => {
  const t = s(v, 60);
  return t === undefined ? undefined : `"${t}"`;
};
export const why = (v: unknown): string | undefined => {
  const t = s(v, 80);
  return t === undefined ? undefined : `sabab: ${t}`;
};
export const no = (v: unknown): string | undefined => {
  const t = s(v, 30);
  return t === undefined ? undefined : `№${t}`;
};

const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
/** Tiyin -> "1 250 000 so'm". */
export const som = (tiyin: unknown): string | undefined => (typeof tiyin === 'number' && Number.isFinite(tiyin) ? `${group(Math.round(tiyin / 100))} so'm` : undefined);
/** So'mda berilgan qiymat. */
export const somRaw = (v: unknown): string | undefined => (typeof v === 'number' && Number.isFinite(v) ? `${group(Math.round(v))} so'm` : undefined);

const FIELD_UZ: Record<string, string> = {
  title: 'sarlavha', description: 'tavsif', priceTiyin: 'narx', price: 'narx', photos: 'rasmlar', name: 'nomi', phone: 'telefon',
  address: 'manzil', regionCode: 'hudud', fullName: 'ism', email: 'email', personalRoles: 'rollar', locale: 'til', avatarUrl: 'rasm',
  kinds: 'turlari', website: 'sayt', inn: 'STIR', status: 'holat', services: 'xizmatlar', workHours: 'ish vaqti',
};
/** O'zgargan maydonlar NOMI (qiymati hech qachon), 6 tagacha. */
export function fields(v: unknown): string | undefined {
  const keys = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : v && typeof v === 'object' ? Object.keys(v) : [];
  if (!keys.length) return undefined;
  const words = keys.slice(0, 6).map((k) => esc(clip(FIELD_UZ[k] ?? k, 30)));
  return words.join(', ') + (keys.length > 6 ? ` +${keys.length - 6}` : '');
}

/** +998901234567 -> +99890•••4567: mehmon yozgan, hech kimga mos kelmagan raqam. */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const p = phone.trim();
  return p.length < 11 ? `${p.slice(0, 4)}•••` : `${p.slice(0, 6)}•••${p.slice(-4)}`;
}

