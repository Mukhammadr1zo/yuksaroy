import { describe, expect, it } from 'vitest';
import { handledData, handledWhere } from './admin-ops.controller';

/**
 * Murojaat hal qilinganini sana aytadi, alohida holat ustuni yo'q. Ikki manba bo'lsa
 * ular bir-biriga zid bo'lib qolardi, shuning uchun qoida shu ikki funksiyada turadi.
 */
describe('murojaat holati', () => {
  it("filtr: javobsiz, hal qilingan yoki filtrsiz", () => {
    expect(handledWhere('0')).toEqual({ handledAt: null });
    expect(handledWhere('1')).toEqual({ handledAt: { not: null } });
    expect(handledWhere(undefined)).toEqual({});
    expect(handledWhere('x')).toEqual({});
  });

  it('belgilashda izoh kesiladi va kim ekani yoziladi', () => {
    const d = handledData(true, 'u1', '  javob berdim  ');
    expect(d.handledById).toBe('u1');
    expect(d.handledNote).toBe('javob berdim');
    expect(d.handledAt).toBeInstanceOf(Date);
  });

  it("faqat bo'shliqdan iborat izoh saqlanmaydi", () => {
    expect(handledData(true, 'u1', '   ').handledNote).toBe(null);
  });

  it('qaytarishda uchala ustun birga tozalanadi', () => {
    expect(handledData(false, 'u1', 'x')).toEqual({ handledAt: null, handledById: null, handledNote: null });
  });
});
