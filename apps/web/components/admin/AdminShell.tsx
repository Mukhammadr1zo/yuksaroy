'use client';
/**
 * Admin qobig'i: huquqni bir marta tekshiradi va chap menyuni chizadi.
 *
 * Tekshiruv klientda, chunki admin so'rovlari httpOnly cookie bilan ketadi va server
 * komponentidan ular uzatilmaydi. Bu yagona to'siq emas: haqiqiy himoya API tomonida,
 * PlatformAdminGuard da. Bu yerdagi tekshiruv faqat noto'g'ri ekran ko'rsatmaslik uchun.
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { Me } from '@/lib/types-auth';
import { AdminNav } from '@/components/admin/AdminNav';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('admin');
  const tc = useTranslations('kabinet.common');
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const path = usePathname();

  useEffect(() => { api<Me>('/auth/me').then(setMe).catch(() => setMe(null)); }, []);

  /*
   * Menyudagi "kutilmoqda" soni. Qobiq admin maketida bir marta yaratiladi va sahifalar
   * almashganda qayta yaratilmaydi, shuning uchun ilgari bu so'rov butun sessiyada
   * bir marta ketardi: sakkizta e'lon tasdiqlangach ham yon menyuda "8" turaverardi,
   * bosh sahifadagi navbat esa "0" ko'rsatardi. Ikki xil raqam, bitta ekranda.
   * Endi har admin sahifasiga o'tganda yangilanadi. Yorliq almashganda emas:
   * u faqat ?tab= ni o'zgartiradi, usePathname esa so'rov qismini olib tashlaydi.
   */
  useEffect(() => {
    if (!me?.isPlatformAdmin) return;
    api<{ counts: Record<string, number> }>('/admin/health')
      .then((h) => {
        const c = h.counts ?? {};
        // Murojaat ham moderatsiya sahifasining yorlig'i: aks holda menyu va sahifa
        // ikki xil raqam ko'rsatardi
        setCounts({ pending: (c.listingsPendingReview ?? 0) + (c.orgsPendingKyc ?? 0) + (c.terminalClaimsPending ?? 0) + (c.premiumPending ?? 0) + (c.subscriptionPending ?? 0) + (c.contactNew ?? 0) });
      })
      .catch(() => {});
  }, [me?.isPlatformAdmin, path]);

  if (me === undefined) return <p className="py-10 text-sm text-muted">{tc('loading')}</p>;
  if (!me?.isPlatformAdmin) return <p role="alert" className="py-10 text-sm text-muted">{t('forbidden')}</p>;

  return (
    <div className="grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-8">
      {/* min-w-0: aks holda grid elementi menyu kengligiga cho'zilib, mobilda sahifa yon tomonga surilardi */}
      <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start"><AdminNav counts={counts} isOwner={!!me.isPlatformOwner} /></aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
