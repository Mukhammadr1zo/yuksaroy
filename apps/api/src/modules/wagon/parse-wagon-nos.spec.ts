import { describe, expect, it } from 'vitest';
import { parseWagonNos } from '@yuksaroy/domain';

/**
 * Odam raqamlarni qayerdan nusxalashini bilmaymiz: vergul, yangi qator, jadval katagi.
 * Shuning uchun ajratgich raqam bo'lmagan HAR QANDAY belgi. Noto'g'ri raqam tashlanmaydi,
 * alohida qaytadi: odam nimasi tushib qolganini ko'rishi kerak.
 */
describe('parseWagonNos', () => {
  it('vergul, probel, yangi qator va tab ajratadi', () => {
    expect(parseWagonNos('24567890, 24567891\n24567892\t24567893').ok)
      .toEqual(['24567890', '24567891', '24567892', '24567893']);
  });

  it("qisqa yoki uzun raqam alohida qaytadi", () => {
    const r = parseWagonNos('24567890 123456 123456789');
    expect(r.ok).toEqual(['24567890']);
    expect(r.bad).toEqual(['123456', '123456789']);
  });

  it('takror raqam bir marta olinadi', () => {
    expect(parseWagonNos('24567890, 24567890').ok).toEqual(['24567890']);
  });

  it("boshidagi nol takrorni yashirmaydi: serverda ular bitta vagon", () => {
    expect(parseWagonNos('01234567 1234567').ok).toEqual(['01234567']);
  });

  it("bo'sh matnda ikkalasi ham bo'sh", () => {
    expect(parseWagonNos('   ')).toEqual({ ok: [], bad: [] });
  });
});
