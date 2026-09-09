'use client';
// Kartadagi "Solishtirish" belgisi: Link tashqarisida turadi (a ichida input bo'lmasin), localStorage bilan sinxron.
import { useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { COMPARE_MAX, getCompare, getCompareServer, subscribeCompare, toggleCompare, type CompareCat } from '@/lib/compare';

export function CompareCheck({ cat, slug, name, className = '' }: { cat: CompareCat; slug: string; name: string; className?: string }) {
  const t = useTranslations('compare');
  const s = useSyncExternalStore(subscribeCompare, getCompare, getCompareServer);
  const [full, setFull] = useState(false);
  const on = s[cat].some((x) => x.slug === slug);
  const disabled = !on && s[cat].length >= COMPARE_MAX;
  return (
    <label className={`inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${on ? 'border-teal bg-teal-soft text-teal-ink' : 'border-line bg-white text-muted hover:border-teal hover:text-teal-ink'} ${className}`} title={full || disabled ? t('full') : undefined}>
      <input type="checkbox" checked={on} onChange={() => setFull(!toggleCompare(cat, { slug, name }))} className="h-3.5 w-3.5 accent-teal" aria-label={`${t('check')}: ${name}`} />
      {on ? t('checked') : full || disabled ? t('full') : t('check')}
    </label>
  );
}
