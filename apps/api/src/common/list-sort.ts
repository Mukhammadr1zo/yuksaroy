import { BadRequestException } from '@nestjs/common';

/**
 * Admin ro'yxatlarining tartibi va guruh amali chegarasi bitta joyda.
 *
 * Mijozdan kelgan `sort` satri hech qachon to'g'ridan-to'g'ri Prisma orderBy ga tushmaydi:
 * oq ro'yxat (ALLOW) dan tashqarisi jimgina sukut maydonga tushadi (pickIn odati, 400 emas).
 * Har tartibga id tiebreak qo'shiladi: bir soniyada yaratilgan ikki qator sahifalar
 * orasida takrorlanmasin yoki tushib qolmasin.
 */
export type SortDir = 'asc' | 'desc';

/**
 * Maydon -> sukut yo'nalish (sana desc, matn asc). Prisma ifodasi oddiy `{ maydon: dir }`
 * bo'lmasa (null lar oxirida, _count bo'yicha) `by` beriladi.
 */
export type SortAllow<T> = Record<string, { def: SortDir; by?: (dir: SortDir) => T }>;

/** Guruh amali va ids filtri: bitta chaqiruvda eng ko'p shuncha qator. Kattarog'i bo'lsa filtr aniqlashtiriladi. */
export const BULK_MAX = 500;

export function orderByOf<T>(sort: string | undefined, dir: string | undefined, allow: SortAllow<T>, fallback: string): T[] {
  const field = sort && Object.hasOwn(allow, sort) ? sort : fallback;
  const rule = allow[field]!;
  const d: SortDir = dir === 'asc' || dir === 'desc' ? dir : rule.def;
  return [rule.by ? rule.by(d) : ({ [field]: d } as T), { id: 'asc' } as T];
}

/**
 * `?ids=a,b,c`: tanlangan qatorlar. Berilmasa undefined (filtr yo'q), bo'sh yoki takror
 * qismlar tashlanadi, chegaradan oshsa 400: tanlov ekranda ham shu son bilan cheklanadi.
 */
export function parseIds(ids: string | undefined, max = BULK_MAX): string[] | undefined {
  if (ids === undefined) return undefined;
  const list = [...new Set(ids.split(',').map((s) => s.trim()).filter(Boolean))];
  if (list.length > max) throw new BadRequestException({ code: 'BULK_TOO_MANY', max });
  return list;
}
