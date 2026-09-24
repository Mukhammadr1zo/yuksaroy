import { describe, expect, it } from 'vitest';
import { IMPRESSION_SURFACES, REVIEW, maskOrderNo, ratingDisplay, recomputeRating } from '@yuksaroy/domain';
import { isRelatedParty } from './arms-length';

describe('recomputeRating', () => {
  it("birinchi baho: o'rtacha = baho, soni 1", () => {
    expect(recomputeRating({ avg: 0, count: 0 }, 5)).toEqual({ avg: 5, count: 1 });
  });

  it("o'rtacha 2 xonagacha yaxlitlanadi", () => {
    // (4*2 + 5) / 3 = 4.333...
    expect(recomputeRating({ avg: 4, count: 2 }, 5)).toEqual({ avg: 4.33, count: 3 });
  });

  it("prev o'zgarmaydi", () => {
    const prev = { avg: 4.5, count: 2 };
    expect(recomputeRating(prev, 3)).toEqual({ avg: 4, count: 3 });
    expect(prev).toEqual({ avg: 4.5, count: 2 });
  });
});

describe('maskOrderNo', () => {
  it('oxirgi ikki belgi yashiriladi', () => {
    expect(maskOrderNo('YS-1041')).toBe('YS-10**');
    expect(maskOrderNo('YS-12345')).toBe('YS-123**');
  });
});

describe('REVIEW va IMPRESSION_SURFACES', () => {
  it('chegaralar va yuzalar', () => {
    expect(REVIEW).toEqual({ min: 1, max: 5, maxText: 1000, maxReplyDays: 30, minToShow: 3 });
    expect([...IMPRESSION_SURFACES]).toEqual(['list', 'map', 'detail', 'compare', 'bot', 'contact']);
  });
});

describe('ratingDisplay', () => {
  it("3 tadan kam baho: o'rtacha ko'rsatilmaydi, soni qoladi", () => {
    expect(ratingDisplay({ avg: 5, count: 1 })).toEqual({ show: false, avg: null, count: 1 });
    expect(ratingDisplay({ avg: 5, count: 2 })).toEqual({ show: false, avg: null, count: 2 });
    expect(ratingDisplay({ avg: 0, count: 0 })).toEqual({ show: false, avg: null, count: 0 });
  });

  it("3 tadan boshlab o'rtacha ko'rsatiladi", () => {
    expect(ratingDisplay({ avg: 4.33, count: 3 })).toEqual({ show: true, avg: 4.33, count: 3 });
    expect(ratingDisplay({ avg: 4.9, count: 40 }).avg).toBe(4.9);
  });
});

describe('isRelatedParty (arms-length)', () => {
  const staff = ['u1', 'u2'];
  it('bir xil tashkilot: bir tomon', () => {
    expect(isRelatedParty({ orgId: 'o1', memberIds: ['u9'] }, { orgId: 'o1', memberIds: staff })).toBe(true);
  });
  it("a'zolar kesishsa: bir tomon", () => {
    expect(isRelatedParty({ orgId: 'o2', memberIds: ['u9', 'u2'] }, { orgId: 'o1', memberIds: staff })).toBe(true);
  });
  it("boshqa tashkilot va kesishmagan a'zolar: mustaqil", () => {
    expect(isRelatedParty({ orgId: 'o2', memberIds: ['u9'] }, { orgId: 'o1', memberIds: staff })).toBe(false);
  });
  it("egasiz terminal: tekshiruv yo'q", () => {
    expect(isRelatedParty({ orgId: 'o1', memberIds: staff }, { orgId: null, memberIds: [] })).toBe(false);
  });
});

describe("excluded baho reytingga kirmaydi", () => {
  // reviews.service: excluded bo'lsa recomputeRating chaqirilmaydi. Shu qoidani takrorlaymiz.
  const apply = (rows: { rating: number; excluded: boolean }[]) =>
    rows.reduce((acc, r) => (r.excluded ? acc : recomputeRating(acc, r.rating)), { avg: 0, count: 0 });

  it("o'z-o'ziga qo'yilgan 5 hisobga olinmaydi", () => {
    expect(apply([{ rating: 5, excluded: true }, { rating: 3, excluded: false }, { rating: 4, excluded: false }])).toEqual({ avg: 3.5, count: 2 });
  });

  it('hammasi excluded: reyting 0 va soni 0, ratingDisplay ham yashiradi', () => {
    const agg = apply([{ rating: 5, excluded: true }, { rating: 5, excluded: true }, { rating: 5, excluded: true }]);
    expect(agg).toEqual({ avg: 0, count: 0 });
    expect(ratingDisplay(agg).show).toBe(false);
  });
});
