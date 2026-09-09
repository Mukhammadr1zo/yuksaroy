'use client';
// Terminal sahifasining mijoz qismi: telefon (kirgan foydalanuvchiga Bearer bilan), "Slot band qilish" (MainButton ham), "Xaritada".
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MapTrifoldIcon, PhoneIcon } from '@phosphor-icons/react';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { haptic, useMainButton } from './TgProvider';
import { BTN, BTN_GHOST } from './bits';

export function TerminalCta({ slug, lat, lng }: { slug: string; lat: number | null; lng: number | null }) {
  const t = useTranslations('tg.terminal');
  const router = useRouter();
  const [phone, setPhone] = useState<string | null | undefined>(undefined);
  useEffect(() => { api<{ phone: string | null }>(`/terminals/${slug}`).then((d) => setPhone(d.phone ?? null)).catch(() => setPhone(null)); }, [slug]);
  const book = () => { haptic('medium'); router.push(`/tg/book/${slug}`); };
  useMainButton({ text: t('book'), onClick: book });
  return (
    <div className="mt-3 space-y-2">
      <p className="flex items-center gap-2 px-1 font-mono text-sm">
        <PhoneIcon size={16} className="shrink-0 text-muted" aria-hidden="true" />
        {phone === undefined ? <span className="text-muted">…</span> : phone ? <a href={`tel:${phone}`} className="font-semibold text-navy">{phone}</a> : <span className="text-muted">{t('noPhone')}</span>}
      </p>
      <button type="button" onClick={book} className={BTN}>{t('book')}</button>
      {lat != null && lng != null ? (
        <Link href={`/tg/map?cat=terminal&c=${lng},${lat}&z=12`} onClick={() => haptic()} className={BTN_GHOST}><MapTrifoldIcon size={18} className="mr-2" aria-hidden="true" />{t('map')}</Link>
      ) : null}
    </div>
  );
}
