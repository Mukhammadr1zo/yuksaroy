'use client';
// Bozor va xizmatlar markazi uchun mayda bo'laklar: holat pilli, Namuna yorlig'i, yorliqlar, telefon.
import { useTranslations } from 'next-intl';
import { LISTING_LABELS, SEARCH_LABELS, SERVICE_TYPE_LABELS, type MarketOfferStatus, type MarketStatus, type TruckType } from '@yuksaroy/domain';
import { PhoneReveal } from '@/components/catalog/PhoneReveal';
import { useLang } from '@/components/kabinet/bits';

const TONE: Record<MarketStatus, string> = { OPEN: 'bg-teal-soft text-teal-ink', AWARDED: 'bg-navy text-white', CLOSED: 'bg-line text-ink/70', CANCELLED: 'bg-red-50 text-red-700' };
const OFFER_TONE: Record<MarketOfferStatus, string> = { SENT: 'bg-teal-soft text-teal-ink', AWARDED: 'bg-navy text-white', DECLINED: 'bg-line text-ink/70' };

export function MarketStatusPill({ status }: { status: MarketStatus }) {
  const t = useTranslations('market.status');
  return <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${TONE[status] ?? TONE.CLOSED}`}>{t.has(status) ? t(status) : status}</span>;
}
export function OfferStatusPill({ status }: { status: MarketOfferStatus }) {
  const t = useTranslations('market.offerStatus');
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${OFFER_TONE[status] ?? OFFER_TONE.DECLINED}`}>{t.has(status) ? t(status) : status}</span>;
}

/** Namuna qatori: haqiqiy taklif emas, har joyda bir xil yorliq. */
export function DemoBadge() {
  const t = useTranslations('market');
  return <span className="inline-block whitespace-nowrap rounded-full border border-amber/40 bg-amber-soft px-2.5 py-0.5 text-[11px] font-semibold text-amber-ink">{t('demo')}</span>;
}

/** Tur, viloyat va kuzov nomlari domain lug'atidan (JSON'da takrorlanmaydi). */
export function useMarketLabels() {
  const lang = useLang();
  return {
    service: SERVICE_TYPE_LABELS[lang],
    region: (c: string | null | undefined) => (c ? SEARCH_LABELS[lang].region[c as keyof typeof SEARCH_LABELS.uz.region] ?? c : ''),
    truck: (c: string | null | undefined) => (c ? LISTING_LABELS[lang].truckType[c as TruckType] ?? c : ''),
  };
}

// integrator ikkala tarafni kengaytirguncha shu yerda bitta joyda o'tkaziladi.
export function MarketPhone({ kind, targetId, next }: { kind: 'service' | 'request'; targetId: string; next: string }) {
  return <PhoneReveal kind={kind} targetId={targetId} next={next} />;
}
