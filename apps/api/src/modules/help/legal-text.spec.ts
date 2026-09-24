import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FAQ, HELP_LANGS, type HelpLang } from './faq';

/**
 * Shartlar matni sayt yordamchisi bilan bir xil gapni aytishi shart.
 *
 * Yordamchi javobi "vositachi yo'q" deydi. Shartlarda boshqa ibora tursa, sayt bir
 * sahifada bir narsani, ikkinchisida boshqasini aytgan bo'ladi. Shuning uchun ibora
 * bu yerda qo'lda takrorlanmaydi: javobning o'zidan olinadi.
 */
const MESSAGES = join(process.cwd(), '..', 'web', 'messages');
const PHRASE: Record<HelpLang, string> = { uz: "vositachi yo'q", ru: 'без посредника', en: 'no middleman' };

// Loyiha qoidasi: bu so'zlar foydalanuvchi matnida bo'lmaydi. Lotin harflilari so'z
// chegarasi bilan, kirillchalari oddiy qidiruv bilan.
const BANNED = /\b(svx|sla|kyc|esr|rju|koridor|reestr|manba|registry)\b/i;
const BANNED_RU = ['реестр', 'источник данных'];

type Doc = Record<string, unknown>;
const legal = (lang: string) => JSON.parse(readFileSync(join(MESSAGES, lang, 'legal.json'), 'utf8')).legal as Record<string, Doc>;
const flat = (d: Doc) => JSON.stringify(d);

describe('shartlar va maxfiylik matni', () => {
  for (const lang of HELP_LANGS) {
    const L = legal(lang);

    it(`${lang}: vositachi iborasi yordamchi javobi bilan bir xil`, () => {
      const what = FAQ[lang].find((f) => f.id === 'what')!.a;
      // Avval javobning o'zida borligi: faq.ts o'zgarsa shu yerda ushlanadi
      expect(what).toContain(PHRASE[lang]);
      expect(flat(L.terms!)).toContain(PHRASE[lang]);
    });

    it(`${lang}: yordamchi ham bitta pullik mahsulotni aytadi`, () => {
      // Alohida Premium to'lovi kodda yo'q. Shartlar "pullik narsa bitta" deydi;
      // yordamchi javobi bilan ayrilib ketmasin.
      const free = FAQ[lang].find((f) => f.id === 'free')!.a.toLowerCase();
      expect(free).not.toContain('premium');
      expect(free).not.toContain('премиум');
      expect(FAQ[lang].some((f) => f.id === 'premium-pay')).toBe(false);
    });

    it(`${lang}: taqiqlangan so'zlar yo'q`, () => {
      for (const doc of ['terms', 'privacy'] as const) {
        const text = flat(L[doc]!);
        expect(text).not.toMatch(BANNED);
        for (const w of BANNED_RU) expect(text).not.toContain(w);
      }
    });

    it(`${lang}: qaytarish bo'limi to'liq`, () => {
      // Qaytarish qoidasi bu hujjatdagi eng muhim yangi qator: olti qatorning biri ham
      // bo'sh qolmasin. Sarlavha qisqa bo'ladi, shuning uchun u alohida o'lchanadi.
      const s5 = L.terms!.s5 as Record<string, string>;
      expect(Object.keys(s5)).toEqual(['h', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
      for (const [k, v] of Object.entries(s5)) expect(v.length).toBeGreaterThan(k === 'h' ? 3 : 20);
    });

    it(`${lang}: cookie va brauzer xotirasi maxfiylikda aytilgan`, () => {
      // Sayt cookie qo'yadi va brauzer xotirasiga yozadi: maxfiylik sahifasining butun
      // vazifasi shu ro'yxat, shuning uchun unutilmasin.
      expect(flat(L.privacy!).toLowerCase()).toContain('cookie');
    });

    it(`${lang}: ikkala hujjat ham bo'sh bo'lmagan bo'limlardan iborat`, () => {
      for (const doc of ['terms', 'privacy'] as const) {
        const sections = Object.keys(L[doc]!).filter((k) => /^s\d+$/.test(k));
        expect(sections.length).toBeGreaterThanOrEqual(5);
        for (const s of sections) {
          const sec = (L[doc] as Record<string, Record<string, string>>)[s]!;
          expect(sec.h?.length ?? 0).toBeGreaterThan(3);
          // Sarlavhadan tashqari kamida bitta xat boshi
          expect(Object.keys(sec).filter((k) => k !== 'h').length).toBeGreaterThan(0);
        }
      }
    });
  }
});
