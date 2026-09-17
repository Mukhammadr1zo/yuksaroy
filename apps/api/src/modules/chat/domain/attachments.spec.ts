import { describe, expect, it } from 'vitest';
import { AttachmentError, isImageUrl, parseAttachments } from './attachments';

/**
 * Ilova URL manzili mijozdan keladi. Tekshirilmasa yozishmaga begona manzil
 * yozib qo'yish mumkin edi va u ikkinchi tomonning brauzerida ochilardi.
 */
const ok = 'https://yuksaroy.uz/v1/files/2026/09/0123456789abcdef01234567.pdf';
const img = 'https://yuksaroy.uz/v1/files/2026/09/0123456789abcdef01234567.jpg';

describe('xabar ilovalari', () => {
  it("bo'sh kirish bo'sh ro'yxat", () => {
    expect(parseAttachments(undefined)).toEqual([]);
    expect(parseAttachments(null)).toEqual([]);
    expect(parseAttachments([])).toEqual([]);
  });

  it("to'g'ri ilova o'tadi", () => {
    const r = parseAttachments([{ url: ok, name: 'shartnoma.pdf', size: 1234, mime: 'application/pdf' }]);
    expect(r).toEqual([{ url: ok, name: 'shartnoma.pdf', size: 1234, mime: 'application/pdf' }]);
  });

  it('begona manzil rad etiladi', () => {
    for (const url of ['https://boshqa-sayt.uz/fayl.pdf', 'javascript:alert(1)', '/v1/files/2026/09/0123456789abcdef01234567.pdf', ok.replace('.pdf', '.exe')]) {
      expect(() => parseAttachments([{ url }])).toThrow(AttachmentError);
    }
  });

  it("ro'yxat emas yoki juda uzun bo'lsa xato", () => {
    expect(() => parseAttachments({ url: ok })).toThrow(AttachmentError);
    expect(() => parseAttachments(Array.from({ length: 11 }, (_, i) => ({ url: ok.replace('0123456789abcdef01234567', String(i).padStart(24, '0')) })))).toThrow(AttachmentError);
  });

  it('bir xil fayl ikki marta qo\'shilmaydi', () => {
    expect(() => parseAttachments([{ url: ok }, { url: ok }])).toThrow(AttachmentError);
  });

  it("nom bo'sh bo'lsa fayl nomidan olinadi va boshqaruv belgilari tozalanadi", () => {
    expect(parseAttachments([{ url: ok }])[0]!.name).toBe('0123456789abcdef01234567.pdf');
    const dirty = String.fromCharCode(10) + 'hisob' + String.fromCharCode(9) + '.pdf';
    expect(parseAttachments([{ url: ok, name: dirty }])[0]!.name).toBe('hisob.pdf');
  });

  it("o'lcham son bo'lmasa nolga tushadi, manfiy bo'lmaydi", () => {
    expect(parseAttachments([{ url: ok, size: 'katta' }])[0]!.size).toBe(0);
    expect(parseAttachments([{ url: ok, size: -5 }])[0]!.size).toBe(0);
  });

  it('rasm kengaytma bo\'yicha ajratiladi', () => {
    expect(isImageUrl(img)).toBe(true);
    expect(isImageUrl(ok)).toBe(false);
  });
});
