'use client';
// Ko'rsatish mayoqlari: sahifada ko'ringan obyektlar (kind, id, yuza) navbatga tushadi, sendBeacon bilan to'plab yuboriladi.
// Bir sahifa yuklanishida bitta obyekt+yuza bir marta. Yuborish: 20 ta yig'ilganda, 2 soniya tinchlikdan keyin yoki sahifa yashirilganda.
import { useEffect } from 'react';
import type { ImpressionSurface } from '@yuksaroy/domain';

export type ImpressionKind = 'listing' | 'terminal';
type Item = { kind: ImpressionKind; targetId: string; surface: ImpressionSurface };

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

/** ids o'zgarganda yangi obyektlar navbatga qo'shiladi. */
export function useImpressions(kind: ImpressionKind, ids: string[], surface: ImpressionSurface) {
  const key = ids.join(',');
  useEffect(() => {
    if (!key) return;
    if (!bound) {
      bound = true;
      window.addEventListener('pagehide', flush);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    }
    for (const targetId of key.split(',')) {
      const k = `${kind}:${targetId}:${surface}`;
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push({ kind, targetId, surface });
    }
    if (queue.length >= BATCH) flush();
    else if (queue.length) { window.clearTimeout(timer); timer = window.setTimeout(flush, 2000); }
  }, [kind, key, surface]);
}

/** Server sahifalar uchun: hech narsa chizmaydi, faqat mayoq. */
export function Impressions({ kind, ids, surface }: { kind: ImpressionKind; ids: string[]; surface: ImpressionSurface }) {
  useImpressions(kind, ids, surface);
  return null;
}
