'use client';
// E'lonlarim: holat, tur, narx, ko'rishlar. Yangi e'lon /tg/listings/new; tahrirlash to'liq saytda (openLink).
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LISTING_LABELS } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { uzDate } from '@/lib/format';
import type { OwnerListing } from '@/lib/types-kabinet';
import { ListingStatusPill } from '@/components/kabinet/bits';
import { haptic, useTg } from '@/components/tg/TgProvider';
import { BTN, CARD, Empty, Err, Skeleton, listingPrice, useLang } from '@/components/tg/bits';

export default function TgListingsPage() {
  const t = useTranslations('tg.listings');
  const tc = useTranslations('tg.common');
  const { tg } = useTg();
  const lang = useLang();
  const L = LISTING_LABELS[lang];
  const [items, setItems] = useState<OwnerListing[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { api<OwnerListing[]>('/listings/mine').then(setItems).catch(() => setErr(true)); }, []);
  const edit = (l: OwnerListing) => { haptic(); tg?.openLink(`${window.location.origin}/dashboard/listings/${l.id}`); };

  return (
    <main className="mx-auto max-w-md px-4 pb-8 pt-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold">{t('title')}</h1>
        <Link href="/tg/listings/new" onClick={() => haptic()} className="min-h-10 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white">{t('new')}</Link>
      </div>
      <div className="mt-4">
        {err ? <Err>{tc('loadFailed')}</Err> : !items ? <Skeleton /> : items.length === 0 ? (
          <Empty><p>{t('empty')}</p><Link href="/tg/listings/new" className={`${BTN} mt-4`}>{t('new')}</Link></Empty>
        ) : (
          <ul className="space-y-2">
            {items.map((l) => (
              <li key={l.id} className={`${CARD} flex gap-3 p-3`}>
                <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-sand">{l.photo ? <img src={l.photo} alt="" className="h-full w-full object-cover" /> : null}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2"><p className="truncate font-bold">{l.title}</p><ListingStatusPill status={l.status} /></div>
                  <p className="mt-0.5 truncate text-xs text-muted">{L.kind[l.kind]} · {l.priceTiyin != null ? listingPrice(l.priceTiyin, l.priceUnit, lang) : tc('onRequest')}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted">{t('views', { count: l.views })} · {uzDate(l.updatedAt, lang)}</p>
                  {l.rejectReason ? <p className="mt-1 text-xs text-red-700">{l.rejectReason}</p> : null}
                  <button type="button" onClick={() => edit(l)} className="mt-1 text-xs font-semibold text-teal-ink underline">{t('openSite')}</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
