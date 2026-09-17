import { describe, expect, it } from 'vitest';
import { detectDocExt, detectImageExt, parseTrustProxy, securityHeaders } from './security';

describe('securityHeaders', () => {
  it('asosiy sarlavhalar har javobda, HSTS faqat prodda', () => {
    const dev = securityHeaders('/v1/listings', false);
    expect(dev['x-content-type-options']).toBe('nosniff');
    expect(dev['x-frame-options']).toBe('DENY');
    expect(dev['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(dev['permissions-policy']).toContain('camera=()');
    expect(dev['strict-transport-security']).toBeUndefined();
    expect(securityHeaders('/v1/listings', true)['strict-transport-security']).toContain('max-age=');
  });

  it('CSP faqat /docs uchun', () => {
    expect(securityHeaders('/v1/listings', false)['content-security-policy']).toBeUndefined();
    expect(securityHeaders('/docs', false)['content-security-policy']).toContain("default-src 'self'");
    expect(securityHeaders('/docs-json', false)['content-security-policy']).toContain("default-src 'self'");
  });
});

describe('parseTrustProxy', () => {
  it('sukut o\'chiq, true/raqam/CIDR ajratiladi', () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy('')).toBe(false);
    expect(parseTrustProxy('  ')).toBe(false);
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('2')).toBe(2);
    expect(parseTrustProxy('10.0.0.0/8')).toBe('10.0.0.0/8');
  });
});

describe('detectImageExt', () => {
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const png = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(8)]);
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(4)]);

  it('imzoni taniydi', () => {
    expect(detectImageExt(jpg)).toBe('jpg');
    expect(detectImageExt(png)).toBe('png');
    expect(detectImageExt(webp)).toBe('webp');
  });

  it('rasm bo\'lmagan yoki juda qisqa bufer null', () => {
    expect(detectImageExt(Buffer.from('<?php echo 1; ?>'))).toBeNull();
    expect(detectImageExt(Buffer.from('<html></html>'))).toBeNull();
    expect(detectImageExt(Buffer.from([0xff, 0xd8]))).toBeNull(); // kesilgan jpg imzosi
    expect(detectImageExt(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('AVI ')]))).toBeNull();
    expect(detectImageExt(Buffer.alloc(0))).toBeNull();
  });
});

describe('detectDocExt', () => {
  const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const pdf = Buffer.from('%PDF-1.7 ...');
  const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(8)]);

  it('pdf imzosi va mimetype mos kelishi shart', () => {
    expect(detectDocExt(pdf, 'application/pdf')).toBe('pdf');
    expect(detectDocExt(pdf, DOCX)).toBeNull(); // pdf ni docx deb yuborib bo'lmaydi
  });

  it('docx va xlsx ZIP imzosi bilan, turini mimetype belgilaydi', () => {
    expect(detectDocExt(zip, DOCX)).toBe('docx');
    expect(detectDocExt(zip, XLSX)).toBe('xlsx');
    expect(detectDocExt(zip, 'application/zip')).toBeNull(); // oddiy arxiv qabul qilinmaydi
  });

  it("hujjat bo'lmagan bufer null", () => {
    expect(detectDocExt(Buffer.from('<?php echo 1; ?>'), 'application/pdf')).toBeNull();
    expect(detectDocExt(Buffer.alloc(0), DOCX)).toBeNull();
  });
});
