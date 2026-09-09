'use client';
import { useLocale, useTranslations } from 'next-intl';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@yuksaroy/domain';
import { useLang } from '@/components/kabinet/bits';
import { pricePer, som, uzDate, uzDateTime, uzTime } from '@/lib/format';
import type { OrderLine } from '@/lib/types';

const TONE: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-soft text-amber-ink',
  CONFIRMED: 'bg-teal-soft text-teal-ink',
  IN_PROGRESS: 'bg-navy text-white',
  DONE: 'bg-teal text-white',
  REJECTED: 'bg-red-50 text-red-700',
  EXPIRED: 'bg-line text-ink/70',
  CANCELLED: 'bg-line text-ink/70',
};

export function StatusPill({ status }: { status: OrderStatus }) {
  const lang = useLang();
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${TONE[status]}`}>{ORDER_STATUS_LABELS[lang][status]}</span>;
}

/** Narx tarkibi: har qator ochiq formula bilan. Buyurtmada tarif muzlatilgan. */
export function PriceLines({ items, subtotalTiyin, commissionPct, commissionTiyin, commissionPayer, totalTiyin }: {
  items: OrderLine[]; subtotalTiyin: number; commissionPct: number; commissionTiyin: number; commissionPayer: 'CLIENT' | 'TERMINAL'; totalTiyin: number;
}) {
  const locale = useLocale();
  const t = useTranslations('dashboard2.order.price');
  const ts = useTranslations('service');
  const tu = useTranslations('unit');
  return (
    <table className="w-full text-sm">
      <tbody>
        {items.map((l) => (
          <tr key={l.serviceCode} className="border-t border-line/70 align-top">
            <td className="py-2 pr-3">
              {ts(l.serviceCode)}
              <span className="block font-mono text-xs text-muted">{l.qty} {tu(l.unit)} x {pricePer(l.unitPriceTiyin, l.unit, locale)}{l.minApplied ? ` ${t('min')}` : ''}</span>
            </td>
            <td className="py-2 whitespace-nowrap text-right font-mono tabular-nums">{som(l.amountTiyin, locale)}</td>
          </tr>
        ))}
        {commissionPayer === 'CLIENT' && commissionTiyin > 0 ? (
          <tr className="border-t border-line/70 align-top">
            <td className="py-2 pr-3">{t('commission', { pct: commissionPct / 100 })}</td>
            <td className="py-2 whitespace-nowrap text-right font-mono tabular-nums">{som(commissionTiyin, locale)}</td>
          </tr>
        ) : null}
        <tr className="border-t-2 border-line align-top">
          <td className="py-2 pr-3 font-semibold">
            {t('total')}
            {commissionPayer === 'TERMINAL' && commissionPct > 0 ? <span className="block font-mono text-xs font-normal text-muted">{t('paidByTerminal')}</span> : null}
            {subtotalTiyin !== totalTiyin ? <span className="block font-mono text-xs font-normal text-muted">{t('services', { sum: som(subtotalTiyin, locale) })}</span> : null}
          </td>
          <td className="py-2 whitespace-nowrap text-right font-mono text-base font-bold tabular-nums">{som(totalTiyin, locale)}</td>
        </tr>
      </tbody>
    </table>
  );
}

/** Slot oynasi: "10-sentabr, 08:00-10:00" (Toshkent vaqti). */
export const slotLabel = (startsAt: string, endsAt: string, locale = 'uz') => `${uzDate(startsAt, locale)}, ${uzTime(startsAt)}-${uzTime(endsAt)}`;

export const dateTime = uzDateTime;
