'use client';
// Google Identity Services. NEXT_PUBLIC_GOOGLE_CLIENT_ID bo'lmasa hech narsa chizilmaydi (ajratgich ham).
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ApiError, post } from '@/lib/api';
import type { LoginResponse } from '@/lib/types-auth';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GSI = 'https://accounts.google.com/gsi/client';

type Gsi = { accounts: { id: { initialize: (o: object) => void; renderButton: (el: HTMLElement, o: object) => void } } };
declare global { interface Window { google?: Gsi } }

export function GoogleButton({ onLogin }: { onLogin: (r: LoginResponse) => void }) {
  const locale = useLocale();
  const t = useTranslations('auth2');
  const box = useRef<HTMLDivElement>(null);
  const cb = useRef(onLogin);
  cb.current = onLogin;
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!CLIENT_ID || !el) return;
    const render = () => {
      window.google?.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async ({ credential }: { credential: string }) => {
          try { cb.current(await post<LoginResponse>('/auth/google', { credential })); }
          catch (e) { setErr(t(e instanceof ApiError && e.body?.code === 'GOOGLE_DISABLED' ? 'google.disabled' : 'google.failed')); }
        },
      });
      window.google?.accounts.id.renderButton(el, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale, width: Math.min(400, el.clientWidth) });
    };
    if (window.google) { render(); return; }
    // hl bilan: aks holda brauzer birinchi keshlangan tugmani (o'zbekchani) qayta ishlatadi
    const src = `${GSI}?hl=${locale}`;
    const s = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`) ?? Object.assign(document.createElement('script'), { src, async: true });
    s.addEventListener('load', render);
    if (!s.isConnected) document.head.appendChild(s);
    return () => s.removeEventListener('load', render);
  }, [locale, t]);

  if (!CLIENT_ID) return null;
  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />{t('login.or')}<span className="h-px flex-1 bg-line" />
      </div>
      <div ref={box} className="mt-4 flex justify-center" />
      {err && <p role="alert" className="mt-3 text-sm text-red-700">{err}</p>}
    </div>
  );
}
