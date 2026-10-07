import { describe, expect, it } from 'vitest';
import { PRIVATE_PREFIX, isPrivateFilePath, isPrivateFileRequest } from './upload-visibility';

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

describe('isPrivateFileRequest', () => {
  const H = '0123456789abcdef01234567.pdf';

  it('oddiy maxfiy va ommaviy manzil', () => {
    expect(isPrivateFileRequest(`/v1/files/2026/10/d_${H}`)).toBe(true);
    expect(isPrivateFileRequest(`/v1/files/2026/10/d_${H}?x=1`)).toBe(true);
    expect(isPrivateFileRequest(`/v1/files/2026/10/${H}`)).toBe(false);
    // Fayl yo'li bo'lmasa qorovul aralashmaydi
    expect(isPrivateFileRequest('/v1/listings/d_abc')).toBe(false);
  });

  it("shifrlangan manzil qorovuldan o'tolmaydi", () => {
    // Bularning hammasini yo'naltirgich d_... ga ochib, faylni sessiyasiz berardi (2026-10-07)
    expect(isPrivateFileRequest(`/v1/files/2026/10/%64_${H}`)).toBe(true);
    expect(isPrivateFileRequest(`/v1/files/2026/10/d%5F${H}`)).toBe(true);
    expect(isPrivateFileRequest(`/v1/files/2026/10%2Fd_${H}`)).toBe(true);
    expect(isPrivateFileRequest(`/v1/%66iles/2026/10/d_${H}`)).toBe(true);
  });

  it('buzuq manzil shubhali deb olinadi', () => {
    expect(isPrivateFileRequest(`/v1/files/2026/10/x%zz/../%64_${H}`)).toBe(true);
  });
});
