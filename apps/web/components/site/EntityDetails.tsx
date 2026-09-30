import { getTranslations } from 'next-intl/server';
import { entityRows, type EntityField } from '@/lib/entity';

/**
 * Tashkilot rekvizitlari. Qiymatlar lib/entity.ts da, yorliqlar tarjimada.
 * variant="inline" - futer uchun bitta qator, variant="list" - to'liq ro'yxat.
 * Hech bir maydon to'ldirilmagan bo'lsa null qaytaradi: bo'sh ramka chizilmaydi.
 * Server komponenti: hech qanday holat yo'q, mijoz kodi ham kerak emas.
 */

/** Telefon va pochta havola bo'ladi, qolgani oddiy matn. tel: dan bo'shliq va qavs olib tashlanadi. */
const HREF: Partial<Record<EntityField, (v: string) => string>> = {
  phone: (v) => `tel:${v.replace(/[^\d+]/g, '')}`,
  email: (v) => `mailto:${v}`,
};

export async function EntityDetails({ variant = 'list', className = '' }: { variant?: 'inline' | 'list'; className?: string }) {
  const rows = entityRows();
  if (rows.length === 0) return null;
  const t = await getTranslations('entity');

  if (variant === 'inline') {
    return (
      <p className={className}>
        {rows.map((r, i) => (
          <span key={r.key}>
            {i > 0 ? ' / ' : ''}
            {/* STIR yolg'iz raqam sifatida tushunarsiz, shuning uchun qisqa qatorda ham yorlig'i bilan */}
            {r.key === 'tin' ? `${t('tin')} ` : ''}
            {r.value}
          </span>
        ))}
      </p>
    );
  }

  return (
    <div className={className}>
      <h2 className="font-display text-lg font-bold text-navy">{t('heading')}</h2>
      <dl className="mt-4 divide-y divide-line rounded-card border border-line bg-white">
        {rows.map((r) => {
          const href = HREF[r.key]?.(r.value);
          return (
            <div key={r.key} className="px-5 py-3.5 sm:flex sm:gap-4">
              <dt className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-muted sm:w-40 sm:shrink-0 sm:pt-0.5">{t(r.key)}</dt>
              <dd className="mt-1 text-[15px] leading-[1.45] text-ink sm:mt-0">
                {href ? <a href={href} className="text-teal-ink underline decoration-teal/40 underline-offset-2 hover:decoration-teal">{r.value}</a> : r.value}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
