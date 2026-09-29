import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { BULK_MAX, orderByOf, parseIds, type SortAllow } from './list-sort';

type Row = Record<string, unknown>;
const ALLOW: SortAllow<Row> = {
  createdAt: { def: 'desc' },
  name: { def: 'asc' },
  fullName: { def: 'asc', by: (d) => ({ fullName: { sort: d, nulls: 'last' } }) },
  listings: { def: 'desc', by: (d) => ({ listings: { _count: d } }) },
};

/**
 * Mijoz satri Prisma ga faqat oq ro'yxat orqali tushadi. Noma'lum qiymat 400 emas,
 * jim sukut: eski havola yoki qo'lda yozilgan URL ro'yxatni buzmasin.
 */
describe('orderByOf', () => {
  it("oq ro'yxatdagi maydon va yo'nalish, oxirida id tiebreak", () => {
    expect(orderByOf('name', 'desc', ALLOW, 'createdAt')).toEqual([{ name: 'desc' }, { id: 'asc' }]);
  });

  it("noma'lum sort jimgina sukut maydonga tushadi", () => {
    expect(orderByOf('passwordHash', 'asc', ALLOW, 'createdAt')).toEqual([{ createdAt: 'asc' }, { id: 'asc' }]);
    expect(orderByOf(undefined, undefined, ALLOW, 'createdAt')).toEqual([{ createdAt: 'desc' }, { id: 'asc' }]);
  });

  it("prototip kaliti oq ro'yxat emas", () => {
    expect(orderByOf('constructor', 'asc', ALLOW, 'createdAt')).toEqual([{ createdAt: 'asc' }, { id: 'asc' }]);
  });

  it("noma'lum dir maydonning sukutiga tushadi: sana desc, matn asc", () => {
    expect(orderByOf('createdAt', 'yuqoriga', ALLOW, 'createdAt')[0]).toEqual({ createdAt: 'desc' });
    expect(orderByOf('name', undefined, ALLOW, 'createdAt')[0]).toEqual({ name: 'asc' });
  });

  it('maxsus ifoda: null lar oxirida va _count', () => {
    expect(orderByOf('fullName', 'desc', ALLOW, 'createdAt')[0]).toEqual({ fullName: { sort: 'desc', nulls: 'last' } });
    expect(orderByOf('listings', undefined, ALLOW, 'createdAt')[0]).toEqual({ listings: { _count: 'desc' } });
  });
});

describe('parseIds', () => {
  it("berilmasa filtr yo'q, berilsa bo'sh va takror qismlar tashlanadi", () => {
    expect(parseIds(undefined)).toBeUndefined();
    expect(parseIds(' a, b ,,a')).toEqual(['a', 'b']);
  });

  it('chegaradan oshsa 400 BULK_TOO_MANY', () => {
    const ok = Array.from({ length: BULK_MAX }, (_, i) => `id${i}`).join(',');
    expect(parseIds(ok)).toHaveLength(BULK_MAX);
    expect(() => parseIds(`${ok},yana`)).toThrow(BadRequestException);
    expect(() => parseIds('a,b,c', 2)).toThrow(BadRequestException);
  });
});
