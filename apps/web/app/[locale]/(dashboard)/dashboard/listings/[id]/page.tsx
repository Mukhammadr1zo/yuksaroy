'use client';
// E'lonni tahrirlash: egasi ro'yxatidan (GET /listings/mine) id bo'yicha topiladi, ommaviy GET faqat ACTIVE va slug bilan.
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { OwnerListing } from '@/lib/types-kabinet';
import { ListingForm } from '@/components/kabinet/ListingForm';

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('kabinet.form');
  const tc = useTranslations('kabinet.common');
  const [listing, setListing] = useState<OwnerListing | null | undefined>(undefined);

  useEffect(() => {
    api<OwnerListing[]>('/listings/mine').then((ls) => setListing(ls.find((l) => l.id === id) ?? null)).catch(() => setListing(null));
  }, [id]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <nav aria-label="Yo'l" className="font-mono text-xs text-muted"><Link href="/dashboard/listings" className="hover:text-navy">{t('backToList')}</Link></nav>
      <h1 className="mt-2 font-display text-3xl font-bold">{t('titleEdit')}</h1>
      <div className="mt-6">
        {listing === undefined ? <p className="text-sm text-muted">{tc('loading')}</p> : listing === null ? <p className="text-muted">{t('notFound')}</p> : <ListingForm initial={listing} />}
      </div>
    </main>
  );
}
