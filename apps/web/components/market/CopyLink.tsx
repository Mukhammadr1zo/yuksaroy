'use client';
/**
 * Holat havolasi: o'qish uchun maydon va nusxalash tugmasi.
 *
 * Bir xil blok kabinetdagi so'rovda, shoshilinch so'rovda va Telegram ilovasida
 * takrorlanardi, endi bittasi. So'rov yuborilgan ekran ham shu yerdan foydalanadi.
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { BTN_NAVY } from '@/components/kabinet/bits';

export function CopyLink({ url, className = '' }: { url: string; className?: string }) {
  const t = useTranslations('market.dash');
  const [copied, setCopied] = useState(false);

  async function copy() {
    // Xavfsiz bo'lmagan ulanishda yoki ruxsat berilmasa nusxalash ishlamaydi:
    // maydonning o'zi qoladi va odam qo'lda belgilab oladi
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
  }

  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('statusLink')}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label={t('statusLink')}
          className="min-w-0 flex-1 rounded-xl border border-field bg-sand px-3 py-2 font-mono text-xs" />
        <button type="button" onClick={copy} className={BTN_NAVY}>{copied ? t('copied') : t('copy')}</button>
      </div>
      <p className="mt-1 text-xs text-muted">{t('statusLinkHint')}</p>
    </div>
  );
}
