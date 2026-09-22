'use client';
/**
 * Tashriflar: oxirgi 30 kun, kunlar bo'yicha va joy bo'yicha.
 *
 * Joy IP manzilidan aniqlanadi. O'zbekiston ichida bu qo'pol: mobil operatorlar va
 * Uztelecom trafikni Toshkentdagi manzil bloklaridan chiqaradi, ya'ni viloyat kesimi
 * haqiqiy taqsimotdan Toshkentga og'adi. Davlat darajasi ishonchli. Shu ogohlantirish
 * ekranda ham turadi, aks holda raqamdan noto'g'ri xulosa chiqarilardi.
 *
 * Xom yozuv umuman yo'q: bazada IP ham, sessiya ham, sahifa manzili ham saqlanmaydi,
 * shuning uchun "kim kirgani" emas, "qayerdan nechta" ko'rsatiladi.
 */
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { SEARCH_LABELS, type RegionCode, type SearchLang } from '@yuksaroy/domain';
import { api } from '@/lib/api';
import { num, uzDate } from '@/lib/format';
import { MAP_BOX, UZ_REGION_PATHS } from '@/lib/uz-map';
import { CARD, Notice, PageHead, errText } from '@/components/admin/kit';

type Visits = {
  total: number;
  days: { day: string; count: number }[];
  regions: { region: string; count: number }[];
  countries: { country: string; count: number }[];
};

export default function AdminVisitsPage() {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const tv = useTranslations('admin.visits');
  const locale = useLocale();
  const lang = (['uz', 'ru', 'en'].includes(locale) ? locale : 'uz') as SearchLang;
  const [data, setData] = useState<Visits | null>(null);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => { api<Visits>('/admin/visits').then(setData).catch(setErr); }, []);

  const regionName = (c: string) => SEARCH_LABELS[lang].region[c as RegionCode] ?? c;
  const countryName = (c: string) => {
    if (c === 'ZZ') return tv('unknown');
    try { return new Intl.DisplayNames([lang, 'en'], { type: 'region' }).of(c) ?? c; } catch { return c; }
  };

  const maxDay = data ? Math.max(1, ...data.days.map((d) => d.count)) : 1;
  const maxRegion = data && data.regions.length ? data.regions[0]!.count : 0;
  const byRegion = new Map(data?.regions.map((r) => [r.region, r.count]) ?? []);
  return (
    <>
      <PageHead title={t('nav.visits')} lead={tv('lead')} />
      {err ? <Notice tone="err">{errText(err, t, t.has, tc('loadFailed'))}</Notice> : null}
      {!data && !err ? <p className="mt-5 text-sm text-muted">{tc('loading')}</p> : null}

      {data ? (
        <>
          <section className="mt-5">
            <p className="font-display text-4xl font-bold tabular-nums text-navy">{num(data.total, locale)}</p>
            <p className="mt-1 text-sm text-muted">{tv('total30')}</p>
          </section>

          {/* Kunlik ustunlar: qaysi kun ko'tarilgani ko'rinsin, aniq raqam ustiga olib borilganda chiqadi */}
          <section className={`${CARD} mt-5 p-4`}>
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted">{tv('daily')}</h2>
            <div className="mt-3 flex h-28 items-end gap-1">
              {data.days.map((d) => (
                <div key={d.day} title={`${uzDate(d.day, locale)}: ${num(d.count, locale)}`}
                  className="min-h-[2px] flex-1 rounded-t bg-teal/70 transition-colors duration-150 hover:bg-teal"
                  style={{ height: `${Math.max(2, Math.round((d.count / maxDay) * 100))}%` }} />
              ))}
            </div>
            <div className="mt-2 flex justify-between font-mono text-[11px] text-muted">
              <span>{uzDate(data.days[0]!.day, locale)}</span>
              <span>{uzDate(data.days[data.days.length - 1]!.day, locale)}</span>
            </div>
          </section>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_minmax(0,380px)]">
            <section className={`${CARD} min-w-0 p-4`}>
              <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted">{tv('regions')}</h2>
              <svg viewBox={`0 0 ${MAP_BOX.w} ${MAP_BOX.h}`} role="img" aria-label={tv('mapAria')} className="mt-3 h-auto w-full">
                {UZ_REGION_PATHS.map((r) => (
                  <path key={r.code} d={r.d} className="fill-line/30 stroke-white" strokeWidth={2} />
                ))}
                {/* Qiymat doira bilan: Toshkent shahri xaritada eng kichik, lekin son
                    ko'pincha aynan unga tushadi va faqat bo'yash bilan u ko'rinmay qolardi */}
                {UZ_REGION_PATHS.map((r) => {
                  const n = byRegion.get(r.code) ?? 0;
                  if (!n || !maxRegion) return null;
                  const rad = 6 + Math.sqrt(n / maxRegion) * 34;
                  return (
                    <circle key={`c-${r.code}`} cx={r.cx} cy={r.cy} r={rad} className="fill-teal/70 stroke-white" strokeWidth={2}>
                      <title>{`${regionName(r.code)}: ${num(n, locale)}`}</title>
                    </circle>
                  );
                })}
              </svg>
              <p className="mt-3 text-xs text-muted">{tv('accuracy')}</p>
            </section>

            <section className={`${CARD} min-w-0 p-4`}>
              <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted">{tv('countries')}</h2>
              {data.countries.length ? (
                <dl className="mt-3 divide-y divide-line/70">
                  {data.countries.slice(0, 12).map((c) => (
                    <div key={c.country} className="flex items-baseline justify-between gap-3 py-1.5">
                      <dt className="min-w-0 truncate text-sm">{countryName(c.country)}</dt>
                      <dd className="shrink-0 font-mono text-sm tabular-nums text-navy">{num(c.count, locale)}</dd>
                    </div>
                  ))}
                </dl>
              ) : <p className="mt-3 text-sm text-muted">{tc('empty')}</p>}
            </section>
          </div>
        </>
      ) : null}
    </>
  );
}
