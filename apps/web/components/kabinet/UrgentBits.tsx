'use client';
// Shoshilinch so'rov sahifalari uchun umumiy bo'laklar: holat pilli, tur va viloyat yorliqlari (joriy tilda).
import { useTranslations } from 'next-intl';
import { SEARCH_LABELS, URGENT_KIND_LABELS, type RegionCode, type UrgentOfferStatus, type UrgentStatus } from '@yuksaroy/domain';
import { useLang } from './bits';

const TONE: Record<UrgentStatus, string> = { OPEN: 'bg-teal-soft text-teal-ink', AWARDED: 'bg-navy text-white', CLOSED: 'bg-line text-ink/70', CANCELLED: 'bg-red-50 text-red-700' };
const OFFER_TONE: Record<UrgentOfferStatus, string> = { SENT: 'bg-teal-soft text-teal-ink', AWARDED: 'bg-navy text-white', DECLINED: 'bg-line text-ink/70' };

export function UrgentStatusPill({ status }: { status: UrgentStatus }) {
  const t = useTranslations('urgent.status');
  return <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${TONE[status] ?? TONE.CLOSED}`}>{t.has(status) ? t(status) : status}</span>;
}
export function OfferStatusPill({ status }: { status: UrgentOfferStatus }) {
  const t = useTranslations('urgent.offerStatus');
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${OFFER_TONE[status] ?? OFFER_TONE.DECLINED}`}>{t.has(status) ? t(status) : status}</span>;
}
/** Tur va viloyat nomlari domain lug'atidan (JSON'da takrorlanmaydi). */
export function useUrgentLabels() {
  const lang = useLang();
  return { kind: URGENT_KIND_LABELS[lang], region: (c: string) => SEARCH_LABELS[lang].region[c as RegionCode] ?? c };
}
