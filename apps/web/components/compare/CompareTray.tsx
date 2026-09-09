'use client';
// Pastki suzuvchi savat: tanlangan nomlar va "Solishtirish" tugmasi. Bo'sh bo'lsa hech narsa chizmaydi.
import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { XIcon } from '@phosphor-icons/react';
import { COMPARE_MAX, clearCompare, compareHref, getCompare, getCompareServer, removeCompare, subscribeCompare, type CompareCat } from '@/lib/compare';

const CATS: CompareCat[] = ['terminals', 'equipment', 'carriers'];

export function CompareTray() {
  const t = useTranslations('compare');
  const s = useSyncExternalStore(subscribeCompare, getCompare, getCompareServer);
  const path = usePathname();
  const cats = CATS.filter((c) => s[c].length);
  // Solishtirish sahifasining o'zida savat ko'rinmaydi: jadval allaqachon ochiq
  if (!cats.length || path.includes('/compare')) return null;
  return (
    <aside aria-label={t('tray.aria')} className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-3xl rounded-card border border-navy/20 bg-white p-3 sm:inset-x-6">
      {cats.map((c) => (
        <div key={c} className="flex flex-wrap items-center gap-2 py-1">
          <span className="font-mono text-[11px] font-semibold text-muted">{t(`cat.${c}`)} · {t('tray.count', { count: s[c].length })}</span>
          <div className="flex min-w-0 flex-1 flex-wrap gap-1">
            {s[c].map((x) => (
              <span key={x.slug} className="inline-flex max-w-[16rem] items-center gap-1 rounded-full bg-sand py-0.5 pl-2.5 pr-1 text-xs text-ink">
                <span className="truncate">{x.name}</span>
                <button type="button" onClick={() => removeCompare(c, x.slug)} aria-label={`${t('remove')}: ${x.name}`} className="tap-40 relative rounded-full p-1.5 text-muted hover:bg-line hover:text-navy"><XIcon size={14} weight="bold" /></button>
              </span>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => clearCompare(c)} className="text-xs font-semibold text-muted underline decoration-dotted hover:text-navy">{t('tray.clear')}</button>
            {s[c].length < 2
              ? <span aria-disabled="true" className="rounded-full bg-line px-4 py-1.5 text-sm font-semibold text-muted">{t('tray.go')}</span>
              : <Link href={compareHref(c, s[c].map((x) => x.slug))} className="rounded-full bg-teal px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-teal-ink">{t('tray.go')}</Link>}
          </div>
        </div>
      ))}
      {cats.some((c) => s[c].length >= COMPARE_MAX) ? <p className="mt-1 text-[11px] text-muted">{t('full')}</p> : null}
    </aside>
  );
}
