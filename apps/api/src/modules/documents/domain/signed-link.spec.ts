// Imzolangan hujjat havolasi: to'g'ri imzo o'tadi, buzilgani va muddati o'tgani o'tmaydi. DB kerak emas.
import { describe, expect, it } from 'vitest';
import { DOC_LINK_TTL_SEC, signDocLink, verifyDocLink } from './signed-link';

const SECRET = 'test-secret-kamida-32-belgidan-iborat';
const ID = 'doc_123';
const NOW = 1_757_000_000;

describe('verifyDocLink', () => {
  const exp = NOW + DOC_LINK_TTL_SEC;
  const sig = signDocLink(ID, exp, SECRET);

  it("to'g'ri imzoni qabul qiladi", () => {
    expect(verifyDocLink(ID, exp, sig, SECRET, NOW)).toBe(true);
    expect(verifyDocLink(ID, String(exp), sig, SECRET, NOW)).toBe(true);
  });

  it('buzilgan imzo, boshqa hujjat, boshqa muddat va boshqa kalitni rad etadi', () => {
    expect(verifyDocLink(ID, exp, `${sig.slice(0, -1)}0`, SECRET, NOW)).toBe(false);
    expect(verifyDocLink('doc_456', exp, sig, SECRET, NOW)).toBe(false);
    expect(verifyDocLink(ID, exp + 1, sig, SECRET, NOW)).toBe(false);
    expect(verifyDocLink(ID, exp, sig, 'boshqa-kalit', NOW)).toBe(false);
    expect(verifyDocLink(ID, exp, undefined, SECRET, NOW)).toBe(false);
    expect(verifyDocLink(ID, 'abc', sig, SECRET, NOW)).toBe(false);
  });

  it("muddati o'tgan havolani rad etadi", () => {
    expect(verifyDocLink(ID, exp, sig, SECRET, exp + 1)).toBe(false);
  });
});
