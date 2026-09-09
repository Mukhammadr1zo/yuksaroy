import { afterEach, describe, expect, it, vi } from 'vitest';
import { TG_MAX, clip, notifyText, sendTelegram } from './telegram';

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
