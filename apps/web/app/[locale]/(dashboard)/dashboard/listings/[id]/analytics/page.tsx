'use client';
// E'lon ko'rsatkichlari: GET /listings/:id/analytics (egasi). Sarlavha uchun nom /listings/mine dan.
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { OwnerListing } from '@/lib/types-kabinet';
import { AnalyticsPanel } from '@/components/kabinet/AnalyticsPanel';

export default function ListingAnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('analytics');
  const [title, setTitle] = useState<string | null>(null);
  useEffect(() => { api<OwnerListing[]>('/listings/mine').then((ls) => setTitle(ls.find((l) => l.id === id)?.title ?? null)).catch(() => {}); }, [id]);
  return (
    <main className="mx-auto max-w-4xl">
      <nav aria-label="Yo'l" className="font-mono text-xs text-muted"><Link href="/dashboard/listings" className="hover:text-navy">{t('back')}</Link>{title ? ` / ${title}` : ''}</nav>
      <h1 className="mt-2 font-display text-3xl font-bold">{t('title')}</h1>
      <div className="mt-6"><AnalyticsPanel path={`/listings/${id}/analytics`} kind="listing" /></div>
    </main>
  );
}
