'use client';
// Terminal sahifasining mijoz qismi: telefon (PhoneReveal: veb bilan bir xil obuna qoidasi), "Slot band qilish" (MainButton ham), "Xaritada".
import { useTranslations } from 'next-intl';
import { MapTrifoldIcon } from '@phosphor-icons/react';
import { Link, useRouter } from '@/i18n/navigation';
import { PhoneReveal } from '@/components/catalog/PhoneReveal';
import { haptic, useMainButton } from './TgProvider';
import { BTN, BTN_GHOST } from './bits';

export function TerminalCta({ id, slug, lat, lng, hasPhone, isDemo }: { id: string; slug: string; lat: number | null; lng: number | null; hasPhone: boolean; isDemo: boolean }) {
  const t = useTranslations('tg.terminal');
  const tr = useTranslations('terminal');
  const router = useRouter();
  const book = () => { haptic('medium'); router.push(`/tg/book/${slug}`); };
  // Namuna terminalda joy band qilinmaydi (egasi qarori, 2026-10-07): MainButton ham yashirin
  useMainButton({ text: t('book'), onClick: book, show: !isDemo });
  return (
    <div className="mt-3 space-y-2">
      {/* Raqam obunachiga, bosilganda (veb sahifa bilan bir xil /contacts qoidasi): bepul ochilmaydi */}
      {hasPhone ? <p className="px-1"><PhoneReveal kind="terminal" targetId={id} next={`/tg/terminals/${slug}`} /></p> : <p className="px-1 text-sm text-muted">{t('noPhone')}</p>}
      {isDemo ? <p className="rounded-xl border border-dashed border-line bg-sand px-3 py-2 text-sm text-muted">{tr('demoNoBook')}</p>
        : <button type="button" onClick={book} className={BTN}>{t('book')}</button>}
      {lat != null && lng != null ? (
        <Link href={`/tg/map?cat=terminal&c=${lng},${lat}&z=12`} onClick={() => haptic()} className={BTN_GHOST}><MapTrifoldIcon size={18} className="mr-2" aria-hidden="true" />{t('map')}</Link>
      ) : null}
    </div>
  );
}
