'use client';
/**
 * Mas'ul shaxs telefoni. Nega alohida klient komponenti:
 *
 * Terminal sahifasi server tomonda ISR bilan keshlanadi va u so'rov cookie'sini olib o'tmaydi,
 * ya'ni server so'rovi har doim "mehmon" sifatida ketadi va API raqamni null qilib qaytaradi.
 * Agar cookie o'tkazilsa ham, natija kesh bo'lgani uchun bitta odamning raqami hammaga tarqalardi.
 * Shuning uchun raqam brauzerdan alohida olinadi: fetch cookie'ni o'zi olib boradi va kesh yo'q.
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api, hasSession } from '@/lib/api';
import type { TerminalDetail } from '@/lib/types';

export function RailPhone({ slug }: { slug: string }) {
  const t = useTranslations('claim');
  const [phone, setPhone] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!hasSession()) return setPhone(null);
    let alive = true;
    api<TerminalDetail>(`/terminals/${slug}`)
      .then((d) => { if (alive) setPhone(d.rail?.contactPhone ?? null); })
      .catch(() => { if (alive) setPhone(null); });
    return () => { alive = false; };
  }, [slug]);

  if (phone) {
    return (
      <a href={`tel:${phone.replace(/[^+\d]/g, '')}`} className="mt-1 inline-block font-mono text-lg font-semibold tabular-nums text-teal-ink underline underline-offset-4">{phone}</a>
    );
  }
  // Yuklanayotganda ham qulf matni turadi: joy sakramasin va mehmonga darrov nima qilish kerakligi ko'rinsin
  return (
    <p className="mt-1.5 text-sm text-muted">
      {t('phoneLocked')}{' '}
      <Link href={`/login?next=/terminals/${slug}`} className="font-semibold text-teal-ink underline">{t('phoneLoginCta')}</Link>
    </p>
  );
}
