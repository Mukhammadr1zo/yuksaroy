import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { REGIONS } from '@yuksaroy/domain';

/** "Viloyatlar" chip qatori: kategoriya sahifasi pastida 14 ta hub havolasi. base: /terminals, /sidings, /equipment, /carriers. */
export async function RegionChips({ base, current }: { base: string; current?: string }) {
  const [t, tr] = await Promise.all([getTranslations('hubs'), getTranslations('region')]);
  return (
    <nav aria-label={t('regions')} className="mt-10 border-t border-line pt-6">
      <h2 className="font-mono text-xs font-semibold uppercase tracking-wide text-muted">{t('regions')}</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {REGIONS.map((r) => (
          <li key={r}>
            <Link href={`${base}/region/${r}`} aria-current={r === current ? 'page' : undefined} className={`inline-block rounded-full border px-3 py-1 text-sm transition ${r === current ? 'border-navy bg-navy text-white' : 'border-line bg-white text-ink/80 hover:border-teal hover:text-teal-ink'}`}>{tr(r)}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
