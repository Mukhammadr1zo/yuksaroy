'use client';
// Bozor kartasi: yuk (yo'nalish, yuk, og'irlik, sana, kuzov) yoki xizmat so'rovi (tur, viloyat). Takliflar soni va Namuna yorlig'i.
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRightIcon } from '@phosphor-icons/react';
import { Link } from '@/i18n/navigation';
import { uzDate, uzDateTime } from '@/lib/format';
import type { MarketRequest } from '@/lib/types-market';
import { DemoBadge, useMarketLabels } from './bits';

export const requestHref = (r: { board: string; no: string }) => (r.board === 'CARGO' ? `/cargo/${r.no}` : `/services/requests/${r.no}`);

export function RequestCard({ r, cta }: { r: MarketRequest; cta?: string }) {
  const locale = useLocale();
  const tc = useTranslations('cargo.card');
  const L = useMarketLabels();
  const cargo = r.board === 'CARGO';
  return (
    <article className="flex min-w-0 flex-col rounded-card border border-line bg-white p-5 transition hover:border-teal">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-xs font-semibold text-navy">{r.no}</span>
        {r.isDemo ? <DemoBadge /> : null}
        {!cargo && r.serviceType ? <span className="rounded-full bg-teal-soft px-2.5 py-0.5 text-xs font-semibold text-teal-ink">{L.service[r.serviceType]}</span> : null}
        <span className="ml-auto font-mono text-xs text-muted tabular-nums">{uzDateTime(r.createdAt, locale)}</span>
      </div>
      {cargo ? (
        <p className="mt-3 flex flex-wrap items-center gap-2 font-display text-lg font-bold text-navy wrap-anywhere">
          <span>{L.region(r.fromRegion)}</span><ArrowRightIcon size={16} className="shrink-0 text-teal" aria-hidden="true" /><span>{L.region(r.toRegion)}</span>
        </p>
      ) : (
        <p className="mt-3 font-display text-lg font-bold text-navy wrap-anywhere">{r.title}</p>
      )}
      {cargo ? (
        <>
          <p className="mt-1 text-sm text-ink wrap-anywhere">{r.cargoName}{r.fromText || r.toText ? <span className="text-muted"> · {[r.fromText, r.toText].filter(Boolean).join(' - ')}</span> : null}</p>
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-sm tabular-nums text-ink/85">
            {r.weightT != null ? <span>{tc('weight', { t: r.weightT })}</span> : null}
            {r.loadDate ? <span>{tc('load', { date: uzDate(r.loadDate, locale) })}</span> : null}
            <span className="text-muted">{r.truckType ? L.truck(r.truckType) : tc('truckAny')}</span>
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted">{L.region(r.regionCode)}</p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
        <span className={r.offersCount ? 'font-semibold text-teal-ink' : 'text-muted'}>{r.offersCount ? tc('offers', { count: r.offersCount }) : tc('noOffers')}</span>
        <Link href={requestHref(r)} className="font-semibold text-navy underline-offset-4 hover:text-teal-ink hover:underline">{cta ?? tc('more')}</Link>
      </div>
    </article>
  );
}
