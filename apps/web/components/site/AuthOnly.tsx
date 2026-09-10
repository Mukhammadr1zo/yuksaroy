'use client';
// Kabinet tugmalari faqat kirgan foydalanuvchiga: mehmon uchun umuman chizilmaydi (yoki `guest` ko'rsatiladi).
// Holat mijozda tekshiriladi, shuning uchun ochiq sahifalar statik qoladi (AuthButton bilan bir xil kesh).
import { useEffect, useState } from 'react';
import { api, hasSession } from '@/lib/api';

const KEY = 'ys-authed';
const TTL = 60_000;
// Bir sahifada bir nechta AuthOnly bo'ladi: so'rov bir marta ketadi, qolganlari shu va'daga ulanadi
let inflight: Promise<boolean> | null = null;

function cached(): boolean | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    return v && Date.now() - v.at < TTL ? !!v.v : null;
  } catch { return null; }
}

export function useAuthed(): boolean | undefined {
  const [authed, setAuthed] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    const c = cached();
    if (c !== null) { setAuthed(c); return; }
    // Sessiya bayrog'i yo'q bo'lsa mehmon: server so'rovi kerak emas
    if (!hasSession()) { setAuthed(false); return; }
    let alive = true;
    inflight ??= api('/auth/me').then(() => true, () => false).then((v) => {
      try { sessionStorage.setItem(KEY, JSON.stringify({ v, at: Date.now() })); } catch { /* xususiy rejim */ }
      inflight = null;
      return v;
    });
    void inflight.then((v) => { if (alive) setAuthed(v); });
    return () => { alive = false; };
  }, []);
  return authed;
}

/** Kirgan bo'lsa `children`, aks holda `guest` (default: hech narsa). Tekshirilguncha ham hech narsa. */
export function AuthOnly({ children, guest = null }: { children: React.ReactNode; guest?: React.ReactNode }) {
  const authed = useAuthed();
  if (authed === undefined) return null;
  return <>{authed ? children : guest}</>;
}
