'use client';
// Kabinet uchun mayda umumiy bo'laklar: holat pilli, til bo'yicha yorliqlar, xato matni, input sinflari.
import { cloneElement, isValidElement, useId } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LISTING_LABELS, type ListingStatus, type SearchLang } from '@yuksaroy/domain';
import { ApiError } from '@/lib/api';

export const INPUT = 'w-full rounded-xl border border-field bg-white px-4 py-2.5 text-base outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/25 disabled:bg-sand disabled:text-muted';
// Xato holatidagi chegara. Bolaning o'z className iga Field ichidan qo'shib bo'lmaydi
// (uning sinfini buzardi), shuning uchun chaqiruvchi o'zi qo'shadi: className={`${INPUT} ${err ? INPUT_ERR : ''}`}
export const INPUT_ERR = 'border-red-600 focus:border-red-600 focus:ring-red-600/25';
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

/**
 * Yorliq + maslahat + xato uchun umumiy o'rov.
 *
 * `group`: ichida bir nechta boshqaruv bo'lsa (chip'lar, ikkita input, rasm yuklagich)
 * <label> ishlatilmaydi. Sabab: bitta yorliq bir nechta boshqaruvni nomlay olmaydi va
 * matnni bosish birinchi tugmani bosib yuborardi. O'rniga role="group".
 */
export function Field({ label, hint, error, required, recommended, children, className, group }: {
  label: string; hint?: string; error?: string; required?: boolean; recommended?: string; children: React.ReactNode; className?: string; group?: boolean;
}) {
  const ta = useTranslations('a11y');
  const uid = useId();
  const [labelId, hintId, errId] = [`${uid}l`, `${uid}h`, `${uid}e`];

  // id va aria faqat BITTA haqiqiy boshqaruvga beriladi: oddiy input/select/textarea yoki
  // o'zini shunday deb belgilagan maydon (ui/fields.tsx dagi isFieldControl).
  // Qolgan holatlarda (o'rovchi div, chiplar to'plami) htmlFor noto'g'ri elementga ishora
  // qilardi va HTML qoidasi bo'yicha label ning o'rab turishidan keladigan yashirin
  // bog'lanish ham bekor bo'lardi, ya'ni hozirgidan YOMONROQ.
  const kid = !group && isValidElement<Record<string, unknown>>(children) ? children : null;
  const kind: unknown = kid?.type;
  const ctrl = kid && (typeof kind === 'string'
    ? kind === 'input' || kind === 'select' || kind === 'textarea'
    : (kind as { isFieldControl?: boolean }).isFieldControl === true) ? kid : null;
  const boundId = ctrl ? ((ctrl.props.id as string | undefined) ?? `${uid}c`) : undefined;
  const describedBy = [hint ? hintId : '', error ? errId : ''].filter(Boolean).join(' ') || undefined;

  const head = (
    <span id={labelId} className="flex items-baseline gap-2">
      {label}
      {/* Yulduzcha endi faqat bezak: majburiylikni yonidagi sr-only so'z aytadi,
          chunki aria-hidden belgi ekran o'quvchiga umuman yetmasdi */}
      {required ? <><span aria-hidden className="text-amber-ink">*</span><span className="sr-only">{ta('required')}</span></>
        : recommended ? <span className="text-xs font-normal text-muted">{recommended}</span> : null}
    </span>
  );

  const rest = (
    <>
      <div className="mt-1 font-normal">
        {ctrl ? cloneElement(ctrl, {
          id: boundId,
          'aria-invalid': error ? true : undefined,
          'aria-required': required || undefined,
          'aria-describedby': describedBy,
        }) : children}
      </div>
      {/* Maslahat xato bilan BIRGA turadi: formatni tushuntiradigan matn aynan xato
          chiqqanda kerak bo'ladi, ilgari esa u o'sha paytda yo'qolib ketardi */}
      {hint ? <p id={hintId} className="mt-1 text-xs font-normal text-muted">{hint}</p> : null}
      {error ? <p id={errId} role="alert" className="mt-1 text-xs font-semibold text-red-700">{error}</p> : null}
    </>
  );

  const cls = `block text-sm font-semibold ${className ?? ''}`;
  if (group) return <div role="group" aria-labelledby={labelId} className={cls}>{head}{rest}</div>;
  // Bog'lanish htmlFor orqali bo'lganda yorliq FAQAT yorliq matnini o'rasin: aks holda
  // maslahat va xato matni ham hisoblangan nomga kiradi va aria-describedby bilan
  // birga ekran o'quvchida ikki marta eshitiladi.
  if (boundId) return <div className={cls}><label htmlFor={boundId}>{head}</label>{rest}</div>;
  // boundId yo'q: bu yerda yagona bog'lanish label ning o'rab turishi, shuning uchun
  // hamma narsa uning ichida qoladi.
  return <label className={cls}>{head}{rest}</label>;
}

export function Notice({ tone, children }: { tone: 'ok' | 'warn' | 'err'; children: React.ReactNode }) {
  const cls = tone === 'ok' ? 'border-teal/30 bg-teal-soft text-teal-ink' : tone === 'warn' ? 'border-amber/30 bg-amber-soft text-amber-ink' : 'border-red-200 bg-red-50 text-red-700';
  return <div role={tone === 'err' ? 'alert' : 'status'} className={`rounded-card border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}
