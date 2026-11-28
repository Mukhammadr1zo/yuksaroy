'use client';
// Kabinet: «Mening vagonlarim» (vagon operatori). Mini App dagi /tg/fleet bilan bir xil komponent.
import { useTranslations } from 'next-intl';
import { FleetView } from '@/components/fleet/FleetView';

export default function DashboardFleetPage() {
  const t = useTranslations('fleet');
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
      <p className="mt-1 text-muted">{t('lead')}</p>
      <div className="mt-6"><FleetView orgHref="/dashboard/organization" card="rounded-card border border-line bg-white" /></div>
    </div>
  );
}
