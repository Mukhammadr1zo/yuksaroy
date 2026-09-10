'use client';
// Kirgan foydalanuvchi holati bitta joyda: sarlavhadagi menyu, qo'shish tugmasi va AuthOnly shu ilgakdan oladi.
// Sessiya bayrog'i bo'lmasa server so'rovi umuman ketmaydi (mehmonda konsol toza qoladi).
import { useEffect, useState } from 'react';
import { api, hasSession } from '@/lib/api';
// Kesh kaliti lib/api.ts dagi clearAuthedCache bilan bir xil bo'lishi shart
import type { Me } from '@/lib/types-auth';

const KEY = 'ys-me';
const TTL = 60_000;
let inflight: Promise<Me | null> | null = null;

function cached(): Me | null | undefined {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    return v && Date.now() - v.at < TTL ? (v.me as Me | null) : undefined;
  } catch { return undefined; }
}

function put(me: Me | null) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ me, at: Date.now() })); } catch { /* xususiy rejim */ }
}

/** undefined = tekshirilmoqda, null = mehmon. */
export function useMe(): Me | null | undefined {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    const c = cached();
    if (c !== undefined) { setMe(c); return; }
    if (!hasSession()) { put(null); setMe(null); return; }
    let alive = true;
    inflight ??= api<Me>('/auth/me').then((m) => m, () => null).then((m) => { put(m); inflight = null; return m; });
    void inflight.then((m) => { if (alive) setMe(m); });
    return () => { alive = false; };
  }, []);
  return me;
}

