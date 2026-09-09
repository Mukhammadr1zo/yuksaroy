'use client';
// Mijoz buyurtmalari: ochiq (harakat kutayotgan) yuqorida, yopilganlari pastda.
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useEffect, useState } from 'react';
import type { OrderStatus } from '@yuksaroy/domain';
import { api } from '@/lib/api';
import { num, som } from '@/lib/format';
import type { OrderCard, Page } from '@/lib/types';
import { StatusPill, slotLabel } from '@/components/order/bits';
import { SlaTimer } from '@/components/order/SlaTimer';

const OPEN: OrderStatus[] = ['PENDING', 'CONFIRMED', 'IN_PROGRESS'];
const FILTERS: { key: string; status?: OrderStatus[] }[] = [
  { key: 'all' },
  { key: 'open', status: OPEN },
  { key: 'done', status: ['DONE'] },
  { key: 'closed', status: ['REJECTED', 'EXPIRED', 'CANCELLED'] },
];

export default function OrdersPage() {
  const locale = useLocale();
  const t = useTranslations('dashboard2.order');
  const [filter, setFilter] = useState('all');
  const [data, setData] = useState<Page<OrderCard> | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    setData(null); setErr(false);
    const f = FILTERS.find((x) => x.key === filter);
    api<Page<OrderCard>>(`/orders?scope=client&limit=50${f?.status ? `&status=${f.status.join(',')}` : ''}`)
      .then(setData).catch(() => setErr(true));
  }, [filter]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-display text-3xl font-bold">{t('title')}</h1>

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key} type="button" onClick={() => setFilter(f.key)} aria-pressed={filter === f.key}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${filter === f.key ? 'bg-navy text-white' : 'border border-line bg-white text-muted hover:text-ink'}`}
          >
            {t(`filter.${f.key}`)}
          </button>
        ))}
      </div>

      {err ? <p role="alert" className="mt-6 text-sm text-red-700">{t('loadFailed')}</p> : null}
      {!data && !err ? <p className="mt-6 text-sm text-muted">{t('loading')}</p> : null}

      {data && data.items.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-line bg-white p-10 text-center">
          <p className="text-muted">{t('empty')}</p>
          <Link href="/dashboard/orders/new" className="mt-4 inline-block rounded-full bg-teal px-6 py-2.5 font-semibold text-white transition hover:bg-teal-ink">{t('newOrder')}</Link>
        </div>
      ) : null}

      <ul className="mt-6 space-y-2">
        {data?.items.map((o) => (
          <li key={o.no}>
            <Link href={`/dashboard/orders/${o.no}`} className="block rounded-card border border-line bg-white p-4 transition hover:border-navy/30 hover:shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-sm font-bold">{o.no}</span>
                <StatusPill status={o.status} />
                {o.status === 'PENDING' && o.slaConfirmUntil ? (
                  <span className="flex items-center gap-1.5 text-xs text-muted">{t('awaitingConfirm')} <SlaTimer until={o.slaConfirmUntil} /></span>
                ) : null}
                <span className="ml-auto font-mono font-semibold tabular-nums">{som(o.totalTiyin, locale)}</span>
              </div>
              <p className="mt-2 font-semibold">{o.terminal.name}</p>
              <p className="mt-0.5 text-sm text-muted">
                {o.station.name} · {o.cargoName ?? t('noCargo')} · {num(o.weightKg / 1000, locale)} t
                {o.slot ? ` · ${slotLabel(o.slot.startsAt, o.slot.endsAt, locale)}` : ''}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      {data && data.total > data.items.length ? (
        <p className="mt-4 text-center text-sm text-muted">{t('shown', { n: data.items.length, total: data.total })}</p>
      ) : null}
    </main>
  );
}
