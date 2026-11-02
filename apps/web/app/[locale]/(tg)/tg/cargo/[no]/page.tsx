'use client';
// Mini App: yuk tafsiloti va bir bosishda taklif. Telegramdagi "Taklif yuborish" tugmasi (market.service notifyNew)
// va cargo_<raqam> boshlang'ich havolasi shu yerga olib keladi. Taklif formasi saytdagi bilan bir xil (OfferForm).
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRightIcon } from '@phosphor-icons/react';
import { regionRouteKm } from '@yuksaroy/domain';
import { ApiError, api } from '@/lib/api';
import { km, uzDate } from '@/lib/format';
import type { MarketRequest } from '@/lib/types-market';
import { DemoBadge, MarketStatusPill, useMarketLabels } from '@/components/market/bits';
import { OfferForm } from '@/components/market/OfferForm';
import { Notice } from '@/components/kabinet/bits';
import { CARD, Row, Skeleton } from '@/components/tg/bits';

export default function TgCargoPage() {
  const { no } = useParams<{ no: string }>();
  const t = useTranslations('cargo.detail');
  const td = useTranslations('services.detail');
  const tc = useTranslations('tg.common');
  const locale = useLocale();
  const L = useMarketLabels();
  const [r, setR] = useState<MarketRequest | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);

  // Kirgan odam bilan o'qiladi (Bearer): javobda o'z taklifim ham keladi, forma "yuborilgan" holatini ko'rsatadi
  useEffect(() => {
    api<MarketRequest>(`/market/requests/${encodeURIComponent(no)}`)
      .then((x) => setR(x.board === 'CARGO' ? x : null))
      .catch((e) => { if (!(e instanceof ApiError && e.status === 404)) setErr(tc('loadFailed')); setR(null); });
  }, [no, tc]);

  if (r === undefined) return <main id="main" className="mx-auto max-w-md px-4 pt-4"><Skeleton /></main>;
  if (!r) return <main id="main" className="mx-auto max-w-md px-4 py-10 text-center text-sm text-muted">{err ?? t('notFound')}</main>;

  const routeKm = regionRouteKm(r.fromRegion, r.toRegion);
  return (
    <main id="main" className="mx-auto max-w-md px-4 pb-8 pt-4">
      <p className="font-mono text-xs uppercase tracking-wide text-teal-ink">{t('eyebrow')} · {r.no}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <h1 className="font-display min-w-0 text-xl font-bold wrap-anywhere">{r.title}</h1>
        <MarketStatusPill status={r.status} />
        {r.isDemo ? <DemoBadge /> : null}
      </div>
      <dl className={`${CARD} mt-3 divide-y divide-line px-3`}>
        <Row k={t('route')} v={<span className="inline-flex flex-wrap items-center justify-end gap-1">{L.region(r.fromRegion)}<ArrowRightIcon size={14} className="text-teal" aria-hidden="true" />{L.region(r.toRegion)}</span>} />
        <Row k={t('cargo')} v={r.cargoName ?? '-'} />
        <Row k={t('weight')} v={r.weightT != null ? `${r.weightT} t` : '-'} mono />
        <Row k={t('loadDate')} v={r.loadDate ? uzDate(r.loadDate, locale) : '-'} mono />
        <Row k={t('truck')} v={r.truckType ? L.truck(r.truckType) : '-'} />
        {r.volumeM3 != null ? <Row k={t('volume')} v={`${r.volumeM3} m3`} mono /> : null}
        {r.trucksCount != null && r.trucksCount > 1 ? <Row k={t('trucks')} v={String(r.trucksCount)} mono /> : null}
        {r.paymentTerm ? <Row k={t('payment')} v={L.payment(r.paymentTerm)} /> : null}
        {routeKm != null ? <Row k={t('distance')} v={km(routeKm, locale)} mono /> : null}
      </dl>
      {r.description.trim() ? <p className="mt-3 whitespace-pre-line text-sm wrap-anywhere">{r.description}</p> : null}

      <section className="mt-5 rounded-card border border-teal/40 bg-sand p-4">
        <h2 className="font-display text-lg font-bold text-navy">{t('offerTitle')}</h2>
        <div className="mt-3">
          {r.isDemo ? <Notice tone="warn">{td('demoNote')}</Notice>
            : r.status !== 'OPEN' && !r.myOffer ? <Notice tone="warn">{t('closedNote')}</Notice>
            : <OfferForm request={r} next={`/cargo/${r.no}`} me={r} source="tg" />}
        </div>
      </section>
    </main>
  );
}
