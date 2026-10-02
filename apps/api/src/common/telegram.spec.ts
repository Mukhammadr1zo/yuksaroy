import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SearchLang } from '@yuksaroy/domain';
import { TG_MAX, clip, notifyTelegram, notifyText, sendTelegram } from './telegram';
import type { PrismaService } from './prisma.service';

describe('notifyText', () => {
  it('til bo\'yicha shablon, noma\'lum til = uz', () => {
    const v = { no: 'YS-1', terminal: 'Sergeli', shipper: 'Alfa', minutes: 30, url: 'https://x/y' };
    expect(notifyText('orderNew', 'ru', v)).toContain('Новый заказ YS-1');
    expect(notifyText('orderNew', 'en', v)).toContain('New order YS-1');
    expect(notifyText('orderNew', 'de', v)).toBe(notifyText('orderNew', 'uz', v));
    expect(notifyText('orderNew', null, v)).toContain('https://x/y');
  });

  it('qiymatlar HTML uchun tozalanadi, bo\'sh kalit bo\'sh satr', () => {
    const t = notifyText('inquiry', 'uz', { title: '<b>Kran</b>', from: '', message: 'a & b', url: 'https://x' });
    expect(t).toContain('&lt;b&gt;Kran&lt;/b&gt;');
    expect(t).toContain('a &amp; b');
    expect(t).not.toContain('{from}');
  });

  it('uzun matn 3500 belgigacha qisqaradi', () => {
    const long = notifyText('inquiry', 'uz', { title: 'x', from: 'y', message: 'm'.repeat(9000), url: 'https://x' });
    expect(long.length).toBe(TG_MAX);
    expect(long.endsWith('…')).toBe(true);
    expect(clip('qisqa')).toBe('qisqa');
  });
});

describe('sendTelegram chegarasi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('bitta chatga soatiga 5 xabar, boshqa chat ta\'sirlanmaydi', async () => {
    const calls: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: { body: string }) => { calls.push(JSON.parse(init.body)); return { ok: true }; }));
    let sent = 0;
    for (let i = 0; i < 7; i++) sent += await sendTelegram(['777001'], `xabar ${i}`);
    expect(sent).toBe(5);
    expect(calls.length).toBe(5);
    expect(await sendTelegram(['777002'], 'boshqa chat')).toBe(1);
  });
});

/**
 * Yetib bormagan xabar sanalmaydi. Nega muhim: ilgari urinishlar soni qaytardi, ya'ni
 * bloklangan chat ham "yuborildi" bo'lib sanalardi va panelda ketgan odam baribir
 * hisobda qolardi.
 *
 * Bu yerda bazaga umuman tegilmaydi: 403 ni "odam botni bloklagan" deb o'qib
 * TelegramLink qatorini o'chirish mumkin emas, chunki Telegram xuddi shu 403 ni botda
 * /start bosmagan (Mini App orqali kelgan) odam uchun ham qaytaradi va o'sha qator
 * o'chsa odam yangi, bo'sh hisobga tushib qolardi.
 */
describe('sendTelegram yetib borganlar sanog\'i', () => {
  afterEach(() => vi.unstubAllGlobals());

  const stub = (status: number) => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status })));

  it('403 da son nol, xato tashqariga chiqmaydi', async () => {
    stub(403);
    expect(await sendTelegram(['778001'], 'x')).toBe(0);
  });

  it('429 va 5xx ham nol beradi', async () => {
    stub(429);
    expect(await sendTelegram(['778002'], 'x')).toBe(0);
    stub(502);
    expect(await sendTelegram(['778003'], 'x')).toBe(0);
  });

  it('tarmoq uzilsa ham yiqilmaydi, kanal nomi (@kanal) ham o\'tadi', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('tarmoq'); }));
    expect(await sendTelegram(['@yuksaroy_yuk', '778004'], 'x')).toBe(0);
  });

  it('qaytgan son faqat yetib borganlarni sanaydi', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: { body: string }) => ({ ok: (JSON.parse(init.body) as { chat_id: string }).chat_id === '778005', status: 403 })));
    expect(await sendTelegram(['778005', '778006'], 'x')).toBe(1);
  });
});

/**
 * Tugma ham oluvchining tilida. Nega muhim: oluvchilar til bo'yicha guruhlanadi va matn
 * o'z tilida ketadi, tugma esa bitta obyekt bo'lib qotirilsa rus tilidagi odam ruscha
 * matn ostida o'zbekcha tugma ko'rardi, ya'ni aralash tilli xabar chiqardi.
 */
describe('notifyTelegram tugmasi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('tugma funksiya bo\'lsa har til uchun o\'z yozuvi ketadi', async () => {
    const sent: { chat_id: string; reply_markup?: { text: string } }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: { body: string }) => { sent.push(JSON.parse(init.body)); return { ok: true }; }));
    const prisma = {
      telegramLink: {
        findMany: async () => [
          { chatId: 779001n, user: { locale: 'uz' } },
          { chatId: 779002n, user: { locale: 'ru' } },
        ],
      },
    } as unknown as PrismaService;
    const label: Record<SearchLang, string> = { uz: 'Taklif yuborish', ru: 'Predlozhit', en: 'Make an offer' };
    const n = await notifyTelegram(prisma, { userIds: ['a', 'b'] }, 'urgentNew', { no: 'UR-1', what: 'x', where: 'y', message: 'z', url: 'https://x' }, (l) => ({ text: label[l] }));
    expect(n).toBe(2);
    expect(sent.find((s) => s.chat_id === '779001')?.reply_markup).toEqual({ text: 'Taklif yuborish' });
    expect(sent.find((s) => s.chat_id === '779002')?.reply_markup).toEqual({ text: 'Predlozhit' });
  });

  it('tugma oddiy obyekt bo\'lsa o\'zi uzatiladi', async () => {
    const sent: { reply_markup?: unknown }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: { body: string }) => { sent.push(JSON.parse(init.body)); return { ok: true }; }));
    const prisma = { telegramLink: { findMany: async () => [{ chatId: 779003n, user: { locale: 'en' } }] } } as unknown as PrismaService;
    await notifyTelegram(prisma, { userIds: ['a'] }, 'urgentNew', { no: 'UR-2', what: 'x', where: 'y', message: 'z', url: 'https://x' }, { text: 'bitta' });
    expect(sent[0].reply_markup).toEqual({ text: 'bitta' });
  });
});
