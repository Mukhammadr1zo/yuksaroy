'use client';
// Kabinet tugmalari faqat kirgan foydalanuvchiga: mehmon uchun umuman chizilmaydi (yoki `guest` ko'rsatiladi).
// Holat mijozda tekshiriladi, shuning uchun ochiq sahifalar statik qoladi (AuthButton bilan bir xil kesh).
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const KEY = 'ys-authed';
const TTL = 60_000;

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
    let alive = true;
    api('/auth/me').then(() => true, () => false).then((v) => {
      if (!alive) return;
      setAuthed(v);
      try { sessionStorage.setItem(KEY, JSON.stringify({ v, at: Date.now() })); } catch { /* xususiy rejim */ }
    });
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
