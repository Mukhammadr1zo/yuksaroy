'use client';
/**
 * 2026-10-07: telefoni reestrdagi raqamga mos kelgani uchun O'ZI tasdiqlangan da'volar. Ular endi
 * PENDING navbatida turmaydi, shuning uchun admin ularni shu yerdan ko'rib, noto'g'ri bo'lsa
 * qaytarib oladi (PATCH claimStatus: serverda orgId va claimedAt tozalanadi).
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { BTN_GHOST, CARD, ConfirmButton, Pill } from '@/components/admin/kit';

interface AutoClaim { id: string; slug: string; name: string; org: { id: string; name: string } | null }

export function AutoClaims() {
  const t = useTranslations('claim');
  const [rows, setRows] = useState<AutoClaim[]>([]);
  const [done, setDone] = useState(false);
  useEffect(() => {
    // Ikkilamchi blok: yiqilsa asosiy navbat baribir ko'rinadi
    void api<AutoClaim[]>('/admin/catalog/auto-claims').then(setRows).catch(() => {});
  }, []);
  if (!rows.length && !done) return null;
  return (
    <section className="mt-8" aria-label={t('autoTitle')}>
      <h2 className="font-display text-lg font-semibold text-navy">{t('autoTitle')}</h2>
      <p className="mt-1 max-w-prose text-sm text-muted">{t('autoHint')}</p>
      {done ? <p role="status" className="mt-2 text-sm font-semibold text-teal-ink">{t('autoRevoked')}</p> : null}
      <ul className="mt-3 space-y-2">
        {rows.map((x) => (
          <li key={x.id} className={`${CARD} flex flex-wrap items-center gap-x-3 gap-y-2 p-3`}>
            <Pill tone="ok">{t('autoTitle')}</Pill>
            <Link href={`/admin/terminals/${x.id}`} className="min-w-0 break-words font-semibold text-navy hover:underline">{x.name}</Link>
            {x.org ? <span className="min-w-0 break-words text-sm text-muted">{x.org.name}</span> : null}
            <span className="ml-auto">
              <ConfirmButton label={t('autoRevoke')} confirm={t('autoRevokeConfirm')} className={BTN_GHOST}
                onRun={async () => {
                  await api(`/admin/catalog/terminals/${x.id}`, { method: 'PATCH', body: JSON.stringify({ claimStatus: 'REJECTED' }) });
                  setRows((r) => r.filter((y) => y.id !== x.id));
                  setDone(true);
                }} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
