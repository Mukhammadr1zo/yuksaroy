'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';

// Kirish holati mijozda tekshiriladi, shuning uchun Header serverda cookies() chaqirmaydi va (public) sahifalar statik qoladi.
// Natija sessionStorage'da 60 s: bir sessiyada har sahifada yangi so'rov ketmasin.
// ponytail: kirish/chiqishdan keyin holat 60 s eskirgan bo'lishi mumkin; kerak bo'lsa login/logout kalitni tozalasin.
const KEY = 'ys-authed';
const TTL = 60_000;

function cached(): boolean | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    return v && Date.now() - v.at < TTL ? !!v.v : null;
  } catch { return null; }
}

export function AuthButton() {
  const t = useTranslations('nav');
  const [authed, setAuthed] = useState(false);

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

  return authed
    ? <Link href="/dashboard" className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-2">{t('cabinet')}</Link>
    : <Link href="/login" className="rounded-full bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-ink">{t('login')}</Link>;
}
