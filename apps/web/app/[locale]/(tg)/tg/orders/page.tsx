'use client';
// Buyurtmalarim: holat pilli bilan ixcham ro'yxat, filtr chiplari.
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { OrderStatus } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { som } from '@/lib/format';
import type { OrderCard, Page } from '@/lib/types';
import { StatusPill, slotLabel } from '@/components/order/bits';
import { SlaTimer } from '@/components/order/SlaTimer';
import { haptic } from '@/components/tg/TgProvider';
import { BTN, CARD, CHIP, Empty, Err, Skeleton } from '@/components/tg/bits';

const FILTERS: { key: 'open' | 'done' | 'closed' | 'all'; status?: OrderStatus[] }[] = [
  { key: 'open', status: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
  { key: 'done', status: ['DONE'] },
  { key: 'closed', status: ['REJECTED', 'EXPIRED', 'CANCELLED'] },
  { key: 'all' },
];

export default function TgOrdersPage() {
  const t = useTranslations('tg.orders');
  const tc = useTranslations('tg.common');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('open');
  const [data, setData] = useState<Page<OrderCard> | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    setData(null); setErr(false);
    const f = FILTERS.find((x) => x.key === filter);
    api<Page<OrderCard>>(`/orders?scope=client&limit=50${f?.status ? `&status=${f.status.join(',')}` : ''}`).then(setData).catch(() => setErr(true));
  }, [filter]);

  return (
    <main className="mx-auto max-w-md px-4 pb-8 pt-4">
      <h1 className="font-display text-xl font-bold">{t('title')}</h1>
      <div className="tg-strip -mx-4 mt-3 px-4">
        {FILTERS.map((f) => <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => { haptic(); setFilter(f.key); }} className={CHIP(filter === f.key)}>{t(`filter.${f.key}`)}</button>)}
      </div>
      <div className="mt-4">
        {err ? <Err>{tc('loadFailed')}</Err> : !data ? <Skeleton /> : data.items.length === 0 ? (
          <Empty><p>{t('empty')}</p><Link href="/tg/search?cat=terminal" className={`${BTN} mt-4`}>{t('emptyCta')}</Link></Empty>
        ) : (
          <ul className="space-y-2">
            {data.items.map((o) => (
              <li key={o.no}>
                <Link href={`/tg/orders/${o.no}`} onClick={() => haptic()} className={`${CARD} block p-3 active:bg-sand`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold">{o.no}</span>
                    <StatusPill status={o.status} />
                    <span className="ml-auto font-mono text-sm font-semibold tabular-nums">{som(o.totalTiyin)}</span>
                  </div>
                  {o.status === 'PENDING' && o.slaConfirmUntil ? <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">{t('sla')} <SlaTimer until={o.slaConfirmUntil} /></p> : null}
                  <p className="mt-1.5 truncate font-semibold">{o.terminal.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">{o.station.name} · {o.cargoName ?? t('noCargo')} · {(o.weightKg / 1000).toLocaleString('ru-RU')} t{o.slot ? ` · ${slotLabel(o.slot.startsAt, o.slot.endsAt)}` : ''}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
