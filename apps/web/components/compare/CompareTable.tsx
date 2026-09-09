import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { CompareCat } from '@/lib/compare';
import { RemoveColumn, ShareLink } from './bits';

export interface CompareCol { slug: string; name: string; href: string; sub?: string }
/** head: bo'lim sarlavhasi qatori (masalan "Tariflar"); values: har ustun uchun bittadan. */
export interface CompareRow { label: string; values: React.ReactNode[]; head?: boolean }

/** Yonma-yon jadval: birinchi ustun yorliqlar (yopishqoq), keyin har obyekt uchun ustun. Tor ekranda konteyner ichida gorizontal scroll. */
export async function CompareTable({ cat, cols, rows, missing }: { cat: CompareCat; cols: CompareCol[]; rows: CompareRow[]; missing: number }) {
  const t = await getTranslations('compare');
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <nav aria-label={t(`cat.${cat}`)} className="font-mono text-xs text-muted"><Link href={`/${cat}`} className="hover:text-navy">{t(`cat.${cat}`)}</Link> / {t(`title.${cat}`)}</nav>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy sm:text-3xl">{t(`title.${cat}`)}</h1>
          <p className="mt-2 max-w-[64ch] text-muted">{t('lead')}</p>
        </div>
        {cols.length ? <ShareLink /> : null}
      </div>
      {missing ? <p className="mt-3 text-xs font-semibold text-amber-ink">{t('notFound', { count: missing })}</p> : null}

      {cols.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-line bg-white p-10 text-center">
          <p className="font-display text-lg font-bold text-navy">{t('empty.title')}</p>
          <p className="mx-auto mt-2 max-w-[52ch] text-muted">{t('empty.body')}</p>
          <Link href={`/${cat}`} className="mt-6 inline-block rounded-full bg-teal px-6 py-3 font-semibold text-white transition hover:bg-teal-ink active:scale-[0.98]">{t('empty.back')}</Link>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-card border border-line bg-white">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="align-top">
                <th className="sticky left-0 z-10 w-40 bg-white px-4 py-3" aria-hidden="true" />
                {cols.map((c) => (
                  <th key={c.slug} scope="col" className="min-w-[12rem] px-4 py-3 text-left align-top">
                    <Link href={c.href} className="font-bold text-navy hover:text-teal-ink">{c.name}</Link>
                    {c.sub ? <p className="mt-0.5 text-xs font-normal text-muted">{c.sub}</p> : null}
                    <RemoveColumn cat={cat} slug={c.slug} slugs={cols.map((x) => x.slug)} name={c.name} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => r.head ? (
                <tr key={i}><th colSpan={cols.length + 1} scope="colgroup" className="bg-sand px-4 py-1.5 text-left font-mono text-[11px] font-semibold uppercase tracking-wide text-muted">{r.label}</th></tr>
              ) : (
                <tr key={i} className="border-t border-line/70">
                  <th scope="row" className="sticky left-0 z-10 bg-white px-4 py-2 text-left text-xs font-semibold text-muted">{r.label}</th>
                  {r.values.map((v, j) => <td key={j} className="px-4 py-2 align-top font-mono text-sm text-ink tabular-nums">{v ?? '·'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
