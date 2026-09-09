import { useTranslations } from 'next-intl';

/** Premium e'lon belgisi (to'q ko'k): karta, tafsilot va kabinet jadvali. Server va mijoz komponentlarida ishlaydi. */
export function PremiumBadge({ className = '' }: { className?: string }) {
  const t = useTranslations('premium');
  return <span className={`inline-block rounded-full bg-navy px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-white ${className}`}>{t('badge')}</span>;
}
