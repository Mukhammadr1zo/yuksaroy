'use client';
// So'rovlar: kelgan (mening e'lonlarimga) va yuborgan (men) ikki bo'lim. Faqat o'qish, javob telefon orqali.
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { uzDateTime } from '@/lib/format';
import { listingHref, type Inquiry } from '@/lib/types-kabinet';
import { CHIP, useListingLabels } from '@/components/kabinet/bits';

type Scope = 'owner' | 'mine';

export default function InquiriesPage() {
  const t = useTranslations('kabinet.inquiries');
  const locale = useLocale();
  const tch = useTranslations('kabinet.chat');
  const tc = useTranslations('kabinet.common');
  const L = useListingLabels();
  const [scope, setScope] = useState<Scope>('owner');
  const [items, setItems] = useState<Inquiry[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    setItems(null); setErr(false);
    api<Inquiry[]>(`/inquiries?scope=${scope}`).then(setItems).catch(() => setErr(true));
  }, [scope]);

  return (
    <>
      <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
      <p className="mt-1 text-muted">{t('lead')}</p>

      <div className="mt-5 flex gap-2">
        {(['owner', 'mine'] as Scope[]).map((s) => (
          <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)} className={CHIP(scope === s)}>{t(`tabs.${s}`)}</button>
        ))}
      </div>

      {err ? <p role="alert" className="mt-6 text-sm text-red-700">{tc('loadFailed')}</p> : null}
      {!items && !err ? <p className="mt-6 text-sm text-muted">{tc('loading')}</p> : null}
      {items?.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-line bg-white p-10 text-center">
          <p className="text-muted">{t(`empty.${scope}`)}</p>
          <Link href={scope === 'owner' ? '/dashboard/listings/new' : '/equipment'} className="mt-4 inline-block rounded-full bg-teal px-6 py-2.5 font-semibold text-white transition hover:bg-teal-ink">{t(`emptyCta.${scope}`)}</Link>
        </div>
      ) : null}

      <ul className="mt-6 space-y-2">
        {items?.map((i) => (
          <li key={i.id} className="rounded-card border border-line bg-white p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <Link href={listingHref(i.listing)} className="font-semibold hover:underline">{i.listing.title}</Link>
              <span className="rounded-full bg-teal-soft px-2.5 py-0.5 text-xs font-semibold text-teal-ink">{L.kind[i.listing.kind]}</span>
              <span className="ml-auto font-mono text-xs text-muted">{uzDateTime(i.createdAt, locale)}</span>
            </div>
            {scope === 'owner' ? <p className="mt-1 text-sm text-muted">{i.fromOrgName ?? t('fromPrivate')}</p> : null}
            <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm">{i.message}</p>
            <Link href={`/dashboard/inquiries/${i.id}`} className="mt-2 inline-block text-sm font-semibold text-teal-ink underline decoration-dotted hover:text-navy">{tch('open')}</Link>
          </li>
        ))}
      </ul>
    </>
  );
}
