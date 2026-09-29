'use client';
// Kabinet uchun mayda umumiy bo'laklar: holat pilli, til bo'yicha yorliqlar, xato matni, input sinflari.
import { useLocale, useTranslations } from 'next-intl';
import { LISTING_LABELS, type ListingStatus, type SearchLang } from '@yuksaroy/domain';
import { ApiError } from '@/lib/api';

export const INPUT = 'w-full rounded-xl border border-line bg-white px-4 py-2.5 text-base outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/25 disabled:bg-sand disabled:text-muted';
export const BTN_PRIMARY = 'rounded-full bg-teal px-6 py-2.5 font-semibold text-white transition hover:bg-teal-ink active:scale-[0.98] disabled:bg-line disabled:text-muted disabled:cursor-not-allowed';
export const BTN_NAVY = 'rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white transition hover:bg-navy-2 disabled:bg-line disabled:text-muted disabled:cursor-not-allowed';
export const BTN_GHOST = 'rounded-full border border-line bg-white px-5 py-2 text-sm font-semibold transition hover:border-teal hover:bg-sand disabled:opacity-60';
export const CHIP = (on: boolean) => `rounded-full px-3 py-1.5 text-sm font-semibold transition ${on ? 'bg-navy text-white' : 'border border-line bg-white text-muted hover:border-teal hover:text-ink'}`;

/** Joriy til bo'yicha e'lon lug'ati (kind, status, condition, wagonType, truckType, priceUnit). */
export function useListingLabels() {
  const locale = useLocale();
  return LISTING_LABELS[(locale in LISTING_LABELS ? locale : 'uz') as SearchLang];
}
export const useLang = () => { const l = useLocale(); return (l in LISTING_LABELS ? l : 'uz') as SearchLang; };

const TONE: Record<ListingStatus, string> = {
  DRAFT: 'bg-line text-ink/70',
  PENDING_REVIEW: 'bg-amber-soft text-amber-ink',
  ACTIVE: 'bg-teal text-white',
  REJECTED: 'bg-red-50 text-red-700',
  ARCHIVED: 'bg-line text-ink/70',
  EXPIRED: 'bg-line text-ink/70',
};
export function ListingStatusPill({ status }: { status: ListingStatus }) {
  const t = useTranslations('kabinet.status');
  return <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${TONE[status]}`}>{t(status)}</span>;
}

/** API xatosini tarjimaga aylantiradi: `ns.<code>` bo'lsa shu, bo'lmasa umumiy matn. */
export function errText(e: unknown, t: (k: string) => string, has: (k: string) => boolean, fallback: string): string {
  const code = e instanceof ApiError ? String(e.body?.code ?? '') : '';
  return code && has(code) ? t(code) : fallback;
}

/** `group`: ichida bir nechta tugma bo'lsa (chip'lar) label o'rniga div, aks holda label matni birinchi tugmani bosadi. */
export function Field({ label, hint, error, required, recommended, children, className, group }: {
  label: string; hint?: string; error?: string; required?: boolean; recommended?: string; children: React.ReactNode; className?: string; group?: boolean;
}) {
  const Tag = group ? 'div' : 'label';
  return (
    <Tag className={`block text-sm font-semibold ${className ?? ''}`}>
      <span className="flex items-baseline gap-2">
        {label}
        {required ? <span aria-hidden className="text-amber">*</span> : recommended ? <span className="text-xs font-normal text-muted">{recommended}</span> : null}
      </span>
      <div className="mt-1 font-normal">{children}</div>
      {error ? <p role="alert" className="mt-1 text-xs font-semibold text-red-700">{error}</p> : hint ? <p className="mt-1 text-xs font-normal text-muted">{hint}</p> : null}
    </Tag>
  );
}

export function Notice({ tone, children }: { tone: 'ok' | 'warn' | 'err'; children: React.ReactNode }) {
  const cls = tone === 'ok' ? 'border-teal/30 bg-teal-soft text-teal-ink' : tone === 'warn' ? 'border-amber/30 bg-amber-soft text-amber-ink' : 'border-red-200 bg-red-50 text-red-700';
  return <div role={tone === 'err' ? 'alert' : 'status'} className={`rounded-card border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}
