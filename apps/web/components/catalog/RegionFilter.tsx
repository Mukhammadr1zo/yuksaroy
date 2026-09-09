import { getTranslations } from 'next-intl/server';
import { REGIONS } from '@yuksaroy/domain';

/** Viloyat tanlash: oddiy GET forma elementi, JS kerak emas. Server komponent, yorliqlar tarjimadan. */
export async function RegionFilter({ value }: { value: string }) {
  const [t, tr, tc] = await Promise.all([getTranslations('filter.region'), getTranslations('region'), getTranslations('common')]);
  return (
    <select
      name="region"
      defaultValue={value}
      aria-label={tc('region')}
      className="rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/25"
    >
      <option value="">{t('all')}</option>
      {REGIONS.map((r) => (
        <option key={r} value={r}>{tr(r)}</option>
      ))}
    </select>
  );
}
