// Kichik UA o'qigich: kutubxona yo'q. Faqat xabarda ko'rsatish uchun, aniq emas.
export type Ua = { os: string; browser: string; device: 'telefon' | 'planshet' | 'kompyuter' };

const CRAWLER = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|telegrambot|whatsapp|curl|wget|python|node-fetch|axios|go-http|okhttp|java\//i;
/** Bo'sh UA ham robot hisoblanadi (brauzer doim UA yuboradi). */
export const isCrawler = (ua?: string | null): boolean => !ua || CRAWLER.test(ua);

const major = (m: RegExpMatchArray | null) => (m ? ` ${m[1]}` : '');

export function parseUa(ua?: string | null): Ua | null {
  if (!ua) return null;
  let os = 'OS aniqlanmadi';
  if (/Android/i.test(ua)) os = `Android${major(ua.match(/Android[ /]?(\d+)/i))}`;
  else if (/iPhone|iPad|iPod/i.test(ua)) os = `iOS${major(ua.match(/OS (\d+)[_.]/))}`;
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  // Tartib muhim: Edge, Opera, Yandex, Samsung o'zini "Chrome" deb ham tanishtiradi
  let browser = 'brauzer aniqlanmadi';
  let m: RegExpMatchArray | null;
  if ((m = ua.match(/Edg(?:e|A|iOS)?\/(\d+)/))) browser = `Edge ${m[1]}`;
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/YaBrowser/.test(ua)) browser = 'Yandex';
  else if (/SamsungBrowser/.test(ua)) browser = 'Samsung Internet';
  else if ((m = ua.match(/(?:Firefox|FxiOS)\/(\d+)/))) browser = `Firefox ${m[1]}`;
  else if ((m = ua.match(/(?:Chrome|CriOS)\/(\d+)/))) browser = `Chrome ${m[1]}`;
  else if (/Safari/.test(ua)) browser = 'Safari';

  const device = /iPad/.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) ? 'planshet' : /Mobile|iPhone|Android/i.test(ua) ? 'telefon' : 'kompyuter';
  return { os, browser, device };
}

/** Sarlavhadagi qurilma satri. */
export const deviceLine = (ua?: string | null): string => {
  const p = parseUa(ua);
  return p ? `${p.os}, ${p.browser}, ${p.device}` : 'qurilma aniqlanmadi';
};
