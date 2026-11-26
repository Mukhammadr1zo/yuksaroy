'use client';
// /tg/wagon: vagon raqami bo'yicha oxirgi joylashuv. Butun mantiq WagonBox ichida,
// sahifa faqat sarlavha va kenglik: boshqa Mini App sahifalari ham shunday.
import { Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { WagonBox } from '@/components/tg/WagonBox';

export default function TgWagonPage() {
  const t = useTranslations('tg.wagon');
  return (
    <main id="main" className="mx-auto max-w-md px-4 pb-8 pt-4">
      <h1 className="font-display text-xl font-bold">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted">{t('lead')}</p>
      {/* WagonBox ?no= ni o'qiydi: useSearchParams sahifani statik chizishni buzmasin uchun Suspense ichida */}
      <div className="mt-4"><Suspense fallback={null}><WagonBox /></Suspense></div>
    </main>
  );
}
