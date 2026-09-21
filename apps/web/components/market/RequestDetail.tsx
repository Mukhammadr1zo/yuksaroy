'use client';
// So'rov tafsiloti (yuk yoki xizmat): faktlar, tavsif, egasining telefoni (obunachiga), taklif formasi.
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRightIcon } from '@phosphor-icons/react';
import { Link } from '@/i18n/navigation';
import { uzDate, uzDateTime } from '@/lib/format';
import type { MarketRequest } from '@/lib/types-market';
import { Notice } from '@/components/kabinet/bits';
import { DemoBadge, MarketPhone, MarketStatusPill, useMarketLabels } from './bits';
import { OfferForm } from './OfferForm';
import { requestHref } from './RequestCard';

export function RequestDetail({ r }: { r: MarketRequest }) {
  const locale = useLocale();
  const cargo = r.board === 'CARGO';
  const t = useTranslations(cargo ? 'cargo.detail' : 'services.requestDetail');
  const td = useTranslations('services.detail');
  const L = useMarketLabels();
  const next = requestHref(r);
  const facts: [string, React.ReactNode][] = cargo
    ? [
        [t('route'), <span key="r" className="inline-flex flex-wrap items-center gap-1">{L.region(r.fromRegion)}<ArrowRightIcon size={14} className="text-teal" aria-hidden="true" />{L.region(r.toRegion)}</span>],
        [t('cargo'), r.cargoName ?? ''],
        [t('weight'), r.weightT != null ? `${r.weightT} t` : ''],
        [t('loadDate'), r.loadDate ? uzDate(r.loadDate, locale) : ''],
        [t('truck'), r.truckType ? L.truck(r.truckType) : L.truck(null) || '-'],
      ]
    : [
        [t('type'), r.serviceType ? L.service[r.serviceType] : ''],
        [t('region'), L.region(r.regionCode)],
      ];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href={cargo ? '/cargo' : '/services'} className="text-sm font-semibold text-teal-ink hover:text-navy">{t('back')}</Link>
      <p className="mt-4 font-mono text-xs uppercase tracking-wide text-teal-ink">{t('eyebrow')} · {r.no}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display min-w-0 text-3xl font-bold text-navy wrap-anywhere">{r.title}</h1>
        <MarketStatusPill status={r.status} />
        {r.isDemo ? <DemoBadge /> : null}
      </div>
      <p className="mt-1 font-mono text-xs text-muted tabular-nums">{t('created')}: {uzDateTime(r.createdAt, locale)}</p>
      {r.isDemo ? <div className="mt-4"><Notice tone="warn">{td('demoNote')}</Notice></div> : null}

      <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map(([k, v]) => (
          <div key={k} className="min-w-0 rounded-card border border-line bg-white px-4 py-3">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="mt-1 font-semibold wrap-anywhere">{v || '-'}</dd>
          </div>
        ))}
      </dl>
      {cargo && (r.fromText || r.toText) ? <p className="mt-3 text-sm text-muted wrap-anywhere">{[r.fromText, r.toText].filter(Boolean).join(' - ')}</p> : null}

      <section className="mt-4 rounded-card border border-line bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('description')}</h2>
        <p className="mt-2 whitespace-pre-line text-sm wrap-anywhere">{r.description}</p>
      </section>

      {/* Raqam serverda OPEN va AWARDED so'rovga ochiladi; AWARDED da faqat tanlangan ijrochiga ko'rsatiladi, yopiq so'rovda "yo'q" deb aldamaydi */}
      {r.hasPhone && !r.isDemo && (r.status === 'OPEN' || (r.status === 'AWARDED' && r.myOffer?.status === 'AWARDED')) ? (
        <section className="mt-4 rounded-card border border-line bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('phone')}</h2>
          <div className="mt-2"><MarketPhone kind="request" targetId={r.id} next={next} /></div>
        </section>
      ) : null}

      <section className="mt-8 rounded-card border border-teal/40 bg-sand p-5">
        <h2 className="font-display text-xl font-bold text-navy">{t('offerTitle')}</h2>
        {cargo ? <p className="mt-1 text-sm text-muted">{t('offerLead')}</p> : null}
        <div className="mt-4">
          {r.isDemo ? <p className="text-sm text-muted">{td('demoNote')}</p>
            : r.status !== 'OPEN' && cargo ? <Notice tone="warn">{t('closedNote')}</Notice>
            : <OfferForm request={r} next={next} />}
        </div>
      </section>
    </div>
  );
}
