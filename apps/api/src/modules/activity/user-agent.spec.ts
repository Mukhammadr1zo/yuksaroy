import { describe, expect, it } from 'vitest';
import { deviceLine, isCrawler, parseUa } from './user-agent';

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const WIN_EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.70';
const MAC_FF = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0';
const YANDEX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 YaBrowser/24.10.0.0 Safari/537.36';
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

describe('parseUa', () => {
  it('Android Chrome telefon', () => expect(parseUa(ANDROID)).toEqual({ os: 'Android 14', browser: 'Chrome 131', device: 'telefon' }));
  it('iPhone Safari telefon', () => expect(parseUa(IPHONE)).toEqual({ os: 'iOS 17', browser: 'Safari', device: 'telefon' }));
  it('iPad planshet', () => expect(parseUa(IPAD)?.device).toBe('planshet'));
  it('Android Mobile siz -> planshet', () => expect(parseUa(ANDROID.replace(' Mobile', ''))?.device).toBe('planshet'));
  it('Windows Edge (Chrome emas)', () => expect(parseUa(WIN_EDGE)).toEqual({ os: 'Windows', browser: 'Edge 131', device: 'kompyuter' }));
  it('macOS Firefox', () => expect(parseUa(MAC_FF)).toEqual({ os: 'macOS', browser: 'Firefox 132', device: 'kompyuter' }));
  it('Yandex (Chrome emas)', () => expect(parseUa(YANDEX)?.browser).toBe('Yandex'));
  it("bo'sh UA -> null va qator", () => {
    expect(parseUa('')).toBeNull();
    expect(deviceLine(undefined)).toBe('qurilma aniqlanmadi');
    expect(deviceLine(ANDROID)).toBe('Android 14, Chrome 131, telefon');
  });
});

describe('isCrawler', () => {
  it('robotlar', () => {
    for (const ua of [GOOGLEBOT, 'curl/8.4.0', 'python-requests/2.31', 'Mozilla/5.0 HeadlessChrome/120', 'TelegramBot (like TwitterBot)', undefined, '']) expect(isCrawler(ua)).toBe(true);
  });
  it('oddiy brauzer robot emas', () => {
    for (const ua of [ANDROID, IPHONE, WIN_EDGE, MAC_FF]) expect(isCrawler(ua)).toBe(false);
  });
});
