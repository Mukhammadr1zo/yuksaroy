'use client';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

/**
 * Qolgan vaqt taymeri (8.7): oxirgi 5 daqiqada amber, 1 daqiqada qizil.
 * `aria-live` yoqilmaydi - har soniya o'qib berilmasin; matn ekran o'quvchiga statik qoladi (8.8).
 */
export function SlaTimer({ until, onExpire, prefix = '' }: { until: string | null; onExpire?: () => void; prefix?: string }) {
  const t = useTranslations('dashboard2.order');
  const [left, setLeft] = useState(() => remaining(until));
  useEffect(() => {
    setLeft(remaining(until));
    if (!until) return;
    const t = setInterval(() => {
      const r = remaining(until);
      setLeft(r);
      if (r <= 0) { clearInterval(t); onExpire?.(); }
    }, 1000);
    return () => clearInterval(t);
  }, [until, onExpire]);

  if (!until) return null;
  if (left <= 0) return <span className="font-mono text-sm text-muted">{t('slaOver')}</span>;
  const m = Math.floor(left / 60), s = left % 60;
  const tone = left <= 60 ? 'text-red-700' : left <= 300 ? 'text-amber-ink' : 'text-ink';
  return (
    <span role="timer" className={`font-mono text-sm tabular-nums ${tone}`}>
      {prefix}{m}:{String(s).padStart(2, '0')}
    </span>
  );
}

function remaining(until: string | null): number {
  if (!until) return 0;
  return Math.max(0, Math.round((new Date(until).getTime() - Date.now()) / 1000));
}
