import type { Map as MlMap } from 'maplibre-gl';
import { PIN } from './mapStyle';

// Xaritadagi pinlar ilgari faqat rang bilan farqlanardi (to'q sariq to'ldirilgan, to'q sariq halqa,
// navy, teal), shuning uchun qaysi biri nima ekanini ajratish qiyin edi. Endi doira ichida belgi turadi.
// Belgilar qo'lda yozilgan (sprite yoki kutubxona kerak emas): 16x16, 2x o'lchamda yuklanadi.

const box = (c: string) =>
  `<rect x="3.2" y="4.6" width="9.6" height="7" rx="1" fill="none" stroke="${c}" stroke-width="1.6"/>
   <path d="M6.2 4.6v7M9.8 4.6v7" stroke="${c}" stroke-width="1.3"/>`;

const wagon = (c: string) =>
  `<rect x="2.6" y="4.4" width="10.8" height="5.2" rx="1" fill="none" stroke="${c}" stroke-width="1.6"/>
   <circle cx="5.4" cy="11.6" r="1.35" fill="${c}"/><circle cx="10.6" cy="11.6" r="1.35" fill="${c}"/>`;

const truck = (c: string) =>
  `<path d="M2.4 4.8h6.2v5.1H2.4z" fill="none" stroke="${c}" stroke-width="1.6"/>
   <path d="M8.6 6.6h2.6l2.4 2.1v1.2H8.6z" fill="none" stroke="${c}" stroke-width="1.6" stroke-linejoin="round"/>
   <circle cx="5.1" cy="11.8" r="1.3" fill="${c}"/><circle cx="11.2" cy="11.8" r="1.3" fill="${c}"/>`;

const rail = (c: string) =>
  `<path d="M5.6 2.9v10.2M10.4 2.9v10.2" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>
   <path d="M4.2 5.6h7.6M4.2 8h7.6M4.2 10.4h7.6" stroke="${c}" stroke-width="1.2" stroke-linecap="round"/>`;

/** Belgi rangi: to'ldirilgan pinda oq, halqali pinda pin rangi. */
const GLYPH: Record<string, string> = {
  terminal: box('#FFFFFF'),
  equipment: wagon('#FFFFFF'),
  truck: truck(PIN.truck),
  siding: rail(PIN.siding),
};

const svg = (body: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="32" height="32">${body}</svg>`)}`;

const load = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image(32, 32);
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/** Pin belgilarini xaritaga qo'shadi. Qatlamlar qo'shilishidan oldin chaqiriladi. */
export async function addPinIcons(map: MlMap): Promise<void> {
  await Promise.all(
    Object.entries(GLYPH).map(async ([kind, body]) => {
      const id = `ys-pin-${kind}`;
      if (map.hasImage(id)) return;
      try { map.addImage(id, await load(svg(body)), { pixelRatio: 2 }); } catch { /* belgisiz ham xarita ishlaydi */ }
    }),
  );
}
