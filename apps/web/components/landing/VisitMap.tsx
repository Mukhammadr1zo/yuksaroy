import { getTranslations } from 'next-intl/server';
import { SEARCH_LABELS, type RegionCode, type SearchLang } from '@yuksaroy/domain';
import { num } from '@/lib/format';
import { MAP_BOX, UZ_REGION_PATHS } from '@/lib/uz-map';

/**
 * Oxirgi 30 kunda qayerdan kirishgan.
 *
 * Xarita WebGL emas, oddiy SVG: bu yerda bosish ham, surish ham kerak emas, faqat
 * taqsimot ko'rinsa bas. Landingga ikkinchi xarita kutubxonasini yuklash esa telefonda
 * sahifani sezilarli og'irlashtirardi.
 *
 * Joy IP dan aniqlanadi va O'zbekiston ichida bu qo'pol: mobil operatorlar trafikni
 * Toshkentdagi manzil bloklaridan chiqaradi. Shuning uchun ro'yxatda aniq son emas,
 * ulush ko'rsatiladi va sarlavhada umumiy raqam turadi.
 */
export async function VisitMap({ total, regions, lang }: {
  total: number;
  regions: { region: string; count: number }[];
  lang: SearchLang;
}) {
  const t = await getTranslations('landing.visits');
  if (!total) return null;

  const by = new Map(regions.map((r) => [r.region, r.count]));
  const max = regions.length ? Math.max(...regions.map((r) => r.count)) : 0;
  const label = (code: string) => SEARCH_LABELS[lang].region[code as RegionCode] ?? code;
  const top = regions.slice(0, 5);

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="grid gap-8 md:grid-cols-[1.3fr_1fr] md:items-center">
          <div className="min-w-0">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-teal-ink">{t('heading')}</h2>
            <p className="mt-3 font-display text-4xl font-bold tabular-nums text-navy md:text-5xl">{num(total, lang)}</p>
            <p className="mt-1 text-sm text-muted">{t('lead')}</p>

            {top.length ? (
              <dl className="mt-6 space-y-2">
                {top.map((r) => (
                  <div key={r.region} className="flex items-center gap-3">
                    <dt className="w-32 shrink-0 truncate text-sm text-ink">{label(r.region)}</dt>
                    <dd className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="h-2 min-w-[2px] rounded-full bg-teal" style={{ width: `${Math.max(2, Math.round((r.count / max) * 100))}%` }} />
                      <span className="shrink-0 font-mono text-xs tabular-nums text-muted">{num(r.count, lang)}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>

          <div className="min-w-0">
            <svg viewBox={`0 0 ${MAP_BOX.w} ${MAP_BOX.h}`} role="img" aria-label={t('mapAria')} className="h-auto w-full">
              {UZ_REGION_PATHS.map((r) => (
                <path key={r.code} d={r.d} className="fill-line/30 stroke-white" strokeWidth={2} />
              ))}
              {/* Qiymat doira bilan: Toshkent shahri xaritada eng kichik, lekin son
                  ko'pincha aynan unga tushadi va faqat bo'yash bilan u ko'rinmay qolardi */}
              {UZ_REGION_PATHS.map((r) => {
                const n = by.get(r.code) ?? 0;
                if (!n || !max) return null;
                const rad = 6 + Math.sqrt(n / max) * 34;
                return (
                  <circle key={`c-${r.code}`} cx={r.cx} cy={r.cy} r={rad} className="fill-teal/70 stroke-white" strokeWidth={2}>
                    <title>{`${label(r.code)}: ${num(n, lang)}`}</title>
                  </circle>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
