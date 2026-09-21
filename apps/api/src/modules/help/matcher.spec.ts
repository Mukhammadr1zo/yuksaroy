import { describe, expect, it } from 'vitest';
import { FAQ, HELP_LANGS } from './faq';
import { match, normalize, stemEq, tokenize } from './matcher';

describe('normalize / tokenize', () => {
  it('kirill -> lotin, apostrof yo\'qoladi, kichik harf', () => {
    expect(normalize('Терминал')).toBe('terminal');
    expect(normalize("O'zbek G'ijduvon")).toBe('ozbek gijduvon');
    expect(normalize('O\u2019zbek')).toBe('ozbek'); // tipografik apostrof
    expect(normalize('ўқғҳ')).toBe('oqgh');
  });

  it('tinish belgilari ajratgich, so\'roq so\'zlari tushib qoladi', () => {
    expect(tokenize('Terminalni qanday topaman?')).toEqual(['terminalni', 'topaman']);
    expect(tokenize('Как найти терминал?')).toEqual(['nayti', 'terminal']);
    expect(tokenize('How do I book a slot?')).toEqual(['book', 'slot']);
  });

  it('stemEq: 4 harfdan boshlab prefiks, qisqa so\'zlar faqat aynan', () => {
    expect(stemEq('terminalni', 'terminal')).toBe(true);
    expect(stemEq('vagon', 'vagonlar')).toBe(true);
    expect(stemEq('bot', 'botanika')).toBe(false);
    expect(stemEq('bot', 'bot')).toBe(true);
  });
});

describe('match', () => {
  it('uz: obuna narxi, lotin va kirill', () => {
    const r = match('Obuna qancha turadi?', 'uz');
    expect(r.confident).toBe(true);
    expect(r.top[0].faq.id).toBe('subscription');
    const c = match('Обуна қанча туради', 'uz');
    expect(c.confident).toBe(true);
    expect(c.top[0].faq.id).toBe('subscription');
  });

  it('uz: vagon qayerda -> wagon; egasining telefoni -> contact-owner', () => {
    expect(match('vagon qayerda ekanini bilsam boladimi', 'uz').top[0].faq.id).toBe('wagon');
    const r = match("Egasining telefon raqamini qanday ko'raman", 'uz');
    expect(r.confident).toBe(true);
    expect(r.top[0].faq.id).toBe('contact-owner');
  });

  it('ru: bron va kod kelmadi', () => {
    const b = match('Как забронировать место на терминале', 'ru');
    expect(b.confident).toBe(true);
    expect(b.top[0].faq.id).toBe('book');
    const k = match('Код не пришел в телеграм', 'ru');
    expect(k.confident).toBe(true);
    expect(k.top[0].faq.id).toBe('telegram-code');
  });

  it('en: premium va yagona so\'z', () => {
    const p = match('what does premium listing give me', 'en');
    expect(p.confident).toBe(true);
    expect(p.top[0].faq.id).toBe('premium');
    const s = match('subscription', 'en');
    expect(s.top.map((x) => x.faq.id)).toContain('subscription');
    expect(s.confident).toBe(false); // subscription va subscription-pay teng: tanlamaymiz
  });

  it('bir so\'z ikki savolga teng tushsa ishonchsiz, lekin ro\'yxat bor', () => {
    const r = match('terminal', 'uz');
    expect(r.confident).toBe(false);
    expect(r.top.length).toBeGreaterThan(1);
  });

  it('aloqasiz savol: hech narsa topilmaydi', () => {
    for (const q of ['Ob-havo bugun qanday?', 'Какой сегодня день', 'tell me a joke']) {
      const r = match(q, q.startsWith('tell') ? 'en' : q.startsWith('Ob') ? 'uz' : 'ru');
      expect(r.confident).toBe(false);
      expect(r.top).toEqual([]);
    }
  });

  it('eng ko\'pi 3 ta va faqat ball > 0', () => {
    const r = match('terminal bron narx obuna xarita vagon', 'uz');
    expect(r.top.length).toBe(3);
    expect(r.top.every((x) => x.score > 0)).toBe(true);
  });
});

describe('faq corpus', () => {
  it('uch tilda bir xil id, href sayt yo\'li, jargon yo\'q', () => {
    const ids = FAQ.uz.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of HELP_LANGS) {
      expect(FAQ[l].map((f) => f.id)).toEqual(ids);
      for (const f of FAQ[l]) {
        expect(f.href.startsWith('/')).toBe(true);
        expect(f.keywords.length).toBeGreaterThan(0);
        expect(`${f.q} ${f.a}`).not.toMatch(/\b(SVX|SLA|KYC|ESR|RJU)\b/);
      }
    }
    expect(ids.length).toBeGreaterThanOrEqual(25);
  });
});
