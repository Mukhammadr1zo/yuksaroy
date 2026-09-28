import { describe, expect, it } from 'vitest';
import { PRIVATE_PREFIX, isPrivateFilePath } from './upload-visibility';

/*
 * Bu funksiya xavfsizlik qarorini qabul qiladi: statik yo'lning oldidagi qorovul faqat
 * shunga qarab kirish talab qiladi. Shuning uchun chegara holatlari shu yerda qulflangan.
 */
describe('isPrivateFilePath', () => {
  it('maxfiy fayl nomini taniydi', () => {
    expect(isPrivateFilePath('/v1/files/2026/09/d_0123456789abcdef.jpg')).toBe(true);
    expect(isPrivateFilePath('/v1/files/2026/09/d_abc.pdf')).toBe(true);
  });

  it('eski, belgisiz fayl ommaviy qoladi', () => {
    // Bu muhim: katalogdagi mavjud suratlar mehmonga ko'rinaveradi
    expect(isPrivateFilePath('/v1/files/2026/09/0123456789abcdef.jpg')).toBe(false);
  });

  it('belgi faqat fayl nomining boshida hisoblanadi', () => {
    // Papka nomida uchrasa ham, nomning o'rtasida uchrasa ham maxfiy emas
    expect(isPrivateFilePath('/v1/files/d_2026/09/abc.jpg')).toBe(false);
    expect(isPrivateFilePath('/v1/files/2026/09/abcd_ef.jpg')).toBe(false);
  });

  it("so'rov qatori va langar nomni buzmaydi", () => {
    expect(isPrivateFilePath('/v1/files/2026/09/d_abc.jpg?w=200')).toBe(true);
    expect(isPrivateFilePath('/v1/files/2026/09/d_abc.jpg#x')).toBe(true);
    expect(isPrivateFilePath('/v1/files/2026/09/abc.jpg?d_=1')).toBe(false);
  });

  it("bo'sh va tugallanmagan yo'l ommaviy deb hisoblanmaydi", () => {
    expect(isPrivateFilePath('')).toBe(false);
    expect(isPrivateFilePath('/v1/files/')).toBe(false);
  });

  it('belgi qiymati kutilganidek', () => {
    expect(PRIVATE_PREFIX).toBe('d_');
  });
});
