'use client';
// Solishtirish sahifasi mayda islandlari: havolani nusxalash, ustunni olib tashlash (savat + URL sinxron).
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { LinkSimpleIcon, XIcon } from '@phosphor-icons/react';
import { compareHref, removeCompare, type CompareCat } from '@/lib/compare';

export function ShareLink() {
  const t = useTranslations('compare');
  const [ok, setOk] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(location.href); setOk(true); setTimeout(() => setOk(false), 2000); } catch { /* ruxsat yo'q */ }
  }
  return (
    <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink/80 transition hover:border-teal hover:text-teal-ink">
      <LinkSimpleIcon size={16} />{ok ? t('shared') : t('share')}
    </button>
  );
}

export function RemoveColumn({ cat, slug, slugs, name }: { cat: CompareCat; slug: string; slugs: string[]; name: string }) {
  const t = useTranslations('compare');
  const router = useRouter();
  function remove() {
    removeCompare(cat, slug);
    const rest = slugs.filter((s) => s !== slug);
    router.push(rest.length ? compareHref(cat, rest) : `/${cat}/compare`);
  }
  return (
    <button type="button" onClick={remove} aria-label={`${t('remove')}: ${name}`} className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-navy">
      <XIcon size={11} weight="bold" />{t('remove')}
    </button>
  );
}
