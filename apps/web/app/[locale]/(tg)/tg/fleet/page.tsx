'use client';
// /tg/fleet: «Mening vagonlarim» (vagon operatori). Butun mantiq FleetView ichida, sayt kabineti bilan bir xil.
import { useTranslations } from 'next-intl';
import { FleetView } from '@/components/fleet/FleetView';
import { CARD } from '@/components/tg/bits';

export default function TgFleetPage() {
  const t = useTranslations('fleet');
  return (
    <main id="main" className="mx-auto max-w-md px-4 pb-8 pt-4">
      <h1 className="font-display text-xl font-bold">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted">{t('lead')}</p>
      {/* Tashkilot ro'yxati saytda: Mini App ichida sayt sahifasi Telegram brauzerida ochiladi */}
      <div className="mt-4"><FleetView orgHref="/dashboard/organization" card={CARD} external /></div>
    </main>
  );
}
