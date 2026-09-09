'use client';
// Yangi e'lon: tur tanlash (?kind=TRUCK bo'lsa tayyor), keyin forma. Saqlangach forma o'z id'i bilan PATCH qiladi.
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LISTING_KINDS, type ListingKind } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { ListingForm } from '@/components/kabinet/ListingForm';

export default function NewListingPage() {
  const t = useTranslations('kabinet.form');
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <nav aria-label="Yo'l" className="font-mono text-xs text-muted"><Link href="/dashboard/listings" className="hover:text-navy">{t('backToList')}</Link></nav>
      <h1 className="mt-2 font-display text-3xl font-bold">{t('titleNew')}</h1>
      <div className="mt-6"><Suspense fallback={null}><PresetForm /></Suspense></div>
    </main>
  );
}

function PresetForm() {
  const k = useSearchParams().get('kind');
  return <ListingForm presetKind={LISTING_KINDS.includes(k as ListingKind) ? (k as ListingKind) : null} />;
}
