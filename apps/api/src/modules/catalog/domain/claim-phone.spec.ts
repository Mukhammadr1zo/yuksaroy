import { describe, expect, it } from 'vitest';
import { claimPhoneMatch } from './claim-phone';

describe('claimPhoneMatch', () => {
  it("shakli boshqacha yozilgan bir raqam mos keladi", () => {
    expect(claimPhoneMatch('+998712991234', ['71 299-12-34'])).toBe(true);
  });

  it("reestrdagi ikki raqamning ikkinchisi ham tekshiriladi", () => {
    expect(claimPhoneMatch('+998712991235', ['71 299-12-34, 71 299-12-35'])).toBe(true);
  });

  it("boshqa raqam mos emas", () => {
    expect(claimPhoneMatch('+998901234567', ['71 299-12-34', '+998 90 765 43 21'])).toBe(false);
  });

  it("obyektda tanilgan raqam bo'lmasa javob yo'q, mos emas emas", () => {
    expect(claimPhoneMatch('+998901234567', [null, undefined, '', '8-371-299'])).toBeNull();
  });
});
