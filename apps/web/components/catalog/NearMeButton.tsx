'use client';
// "Yonimda": brauzerdan joylashuvni oladi va katalogni radius bo'yicha filtrlaydi.
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CrosshairIcon } from '@phosphor-icons/react';

export function NearMeButton({ path, radiusKm = 30 }: { path: string; radiusKm?: number }) {
  const t = useTranslations('catalog.nearMe');
  const router = useRouter();
  const sp = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const active = sp.has('near');

  function locate() {
    if (active) {
      const q = new URLSearchParams(sp.toString());
      q.delete('near');
      q.delete('radius');
      return router.push(`${path}?${q}`);
    }
    if (!navigator.geolocation) return setErr(t('err.unsupported'));
    setBusy(true);
    setErr(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const q = new URLSearchParams(sp.toString());
        q.set('near', `${pos.coords.longitude.toFixed(5)},${pos.coords.latitude.toFixed(5)}`);
        q.set('radius', String(radiusKm));
        q.delete('page');
        setBusy(false);
        router.push(`${path}?${q}`);
      },
      () => { setBusy(false); setErr(t('err.denied')); },
      { timeout: 10_000, maximumAge: 60_000 },
    );
  }

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={locate}
        disabled={busy}
        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition duration-200 disabled:opacity-60 ${
          active ? 'border-teal bg-teal-soft text-teal-ink' : 'border-line bg-white text-ink/80 hover:border-teal hover:text-teal-ink'
        }`}
      >
        <CrosshairIcon size={17} weight="regular" aria-hidden="true" />
        {busy ? t('busy') : active ? t('active', { radius: sp.get('radius') ?? radiusKm }) : t('idle')}
      </button>
      {err ? <span className="mt-1 text-xs text-amber-ink">{err}</span> : null}
    </span>
  );
}
