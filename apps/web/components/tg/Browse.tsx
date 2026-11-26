// Yozmasdan ko'rish: viloyatlar (sonlari bilan), bitta viloyat tanlanganda uning stansiyalari.
// Manba bitta: xaritadagi /map-objects.geojson. Shahobcha guruhi har stansiya uchun bitta nuqta va `count`,
// egasi bor terminal esa o'z nuqtasi bilan, shuning uchun viloyat soni = guruhlar yig'indisi + egalik terminallar.
import { getTranslations } from 'next-intl/server';
import { REGIONS, type SearchLang } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { regionName } from './labels';

export interface BrowseFeature { properties: { id: string; kind: string; name: string; regionCode: string | null; count?: number; isDemo?: boolean } }
export interface BrowseData { regions: Record<string, number>; stations: { id: string; name: string; count: number; region: string | null }[] }

export function toBrowse(features: BrowseFeature[]): BrowseData {
  const regions: Record<string, number> = {};
  const stations: BrowseData['stations'] = [];
  for (const { properties: p } of features) {
    if (p.kind === 'siding') {
      const n = p.count ?? 1;
      stations.push({ id: p.id, name: p.name, count: n, region: p.regionCode });
      if (p.regionCode) regions[p.regionCode] = (regions[p.regionCode] ?? 0) + n;
    } else if (p.kind === 'terminal' && !p.isDemo && p.regionCode) regions[p.regionCode] = (regions[p.regionCode] ?? 0) + 1;
  }
  return { regions, stations };
}

// bits.tsx 'use client': undagi sinf satrlarini server komponentda ishlatib bo'lmaydi, shuning uchun CARD sinflari shu yerda
const ROW = `rounded-card border border-line bg-white flex min-h-14 items-center justify-between gap-2 px-3 py-2 active:bg-sand`;

export async function Browse({ data, lang, region }: { data: BrowseData; lang: SearchLang; region?: string }) {
  const t = await getTranslations('tg.search');
  if (region) {
    // Stansiyalar eng ko'p terminalli birinchi; ro'yxat ko'p bo'lishi mumkin, shuning uchun bir qatorli yonga surilgich
    const list = data.stations.filter((s) => s.region === region).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    if (!list.length) return null;
    return (
      <section className="mt-3">
        <h2 className="mb-2 text-sm font-bold">{t('byStation')}</h2>
        <div className="tg-strip -mx-4 px-4">
          {list.map((s) => (
            <Link key={s.id} data-station href={`/tg/search?cat=terminal&region=${region}&station=${s.id}`} className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border border-line bg-white px-4 text-sm font-semibold active:bg-sand">
              {s.name}<span className="font-mono text-xs font-normal text-muted tabular-nums">{s.count}</span>
            </Link>
          ))}
        </div>
      </section>
    );
  }
  // 14 viloyat, soni kattalari birinchi; teng bo'lsa domen tartibi saqlanadi
  const rows = REGIONS.map((code) => ({ code, n: data.regions[code] ?? 0 })).sort((a, b) => b.n - a.n);
  return (
    <section className="mt-4">
      <h2 className="mb-2 text-sm font-bold">{t('byRegion')}</h2>
      <div className="grid grid-cols-2 gap-2">
        {rows.map(({ code, n }) => (
          <Link key={code} data-region={code} href={`/tg/search?cat=terminal&region=${code}`} className={ROW}>
            <span className="min-w-0 text-sm font-semibold leading-tight">{regionName(code, lang)}</span>
            {n > 0 ? <span className="shrink-0 font-mono text-xs text-muted tabular-nums">{n}</span> : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
