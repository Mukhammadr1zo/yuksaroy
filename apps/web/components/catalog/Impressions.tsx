'use client';
// Ko'rsatish mayoqlari: sahifada ko'ringan obyektlar (kind, id, yuza) navbatga tushadi, sendBeacon bilan to'plab yuboriladi.
// Bir sahifa yuklanishida bitta obyekt+yuza bir marta. Yuborish: 20 ta yig'ilganda, 2 soniya tinchlikdan keyin yoki sahifa yashirilganda.
import { useEffect } from 'react';
import type { ImpressionSurface } from '@yuksaroy/domain';

export type ImpressionKind = 'listing' | 'terminal';
// Reklama banneri ham shu navbatdan ketadi: bitta sahifada uchtagacha banner bor va
// har biri o'z so'rovini yuborsa IP chelagi (daqiqasiga 60) ommaviy operator manzilida
// tez to'lardi, 429 esa jim yo'qoladi va brendga ko'rsatiladigan son kam chiqardi.
type Item = { kind: ImpressionKind | 'ad'; targetId: string; surface: ImpressionSurface | 'view' | 'click' };

const URL = '/api/v1/events/impressions';
const BATCH = 20;
const seen = new Set<string>();
let queue: Item[] = [];
let timer = 0;
let bound = false;

function flush() {
  window.clearTimeout(timer);
  while (queue.length) {
    const body = JSON.stringify({ items: queue.splice(0, 50) }); // API chegarasi 50
    const sent = navigator.sendBeacon?.(URL, new Blob([body], { type: 'application/json' }));
    if (!sent) fetch(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
  }
}

/**
 * Navbatga bitta element qo'shish.
 *
 * Takror tekshiruvi chaqiruvchida: bu yerdagi `seen` to'plami hech qachon tozalanmaydi,
 * ya'ni reklama ko'rilishi butun seansga bir marta sanalib qolardi. Katalog uchun bu
 * to'g'ri (bir obyekt ro'yxatda bir marta), banner uchun esa har ko'rsatilgan sahifa
 * alohida sanaladi va kalitni AdSlot o'zi saqlaydi.
 */
export function pushImpression(item: Item) {
  if (!bound) {
    bound = true;
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  }
  queue.push(item);
  if (queue.length >= BATCH) flush();
  else { window.clearTimeout(timer); timer = window.setTimeout(flush, 2000); }
}

/** ids o'zgarganda yangi obyektlar navbatga qo'shiladi. */
export function useImpressions(kind: ImpressionKind, ids: string[], surface: ImpressionSurface) {
  const key = ids.join(',');
  useEffect(() => {
    if (!key) return;
    for (const targetId of key.split(',')) {
      const k = `${kind}:${targetId}:${surface}`;
      if (seen.has(k)) continue;
      seen.add(k);
      pushImpression({ kind, targetId, surface });
    }
  }, [kind, key, surface]);
}

/** Server sahifalar uchun: hech narsa chizmaydi, faqat mayoq. */
export function Impressions({ kind, ids, surface }: { kind: ImpressionKind; ids: string[]; surface: ImpressionSurface }) {
  useImpressions(kind, ids, surface);
  return null;
}
