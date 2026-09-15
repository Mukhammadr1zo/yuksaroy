import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/**
 * Sahifalagich. Hamma raqamni chizmaydi: reestr qo'shilgach katalogda 70 dan ortiq sahifa
 * bo'lib qoldi va ular bitta qatorga sig'may, mobil sahifani yon tomonga suradigan qilib qo'ygan edi.
 * Ko'rinadigan oyna: birinchi, joriy atrofidagi ikkita, oxirgi; oradagilar uch nuqta.
 */
const WINDOW = 2;

const pageList = (page: number, pages: number): (number | 'gap')[] => {
  const keep = new Set<number>([1, pages]);
  for (let i = page - WINDOW; i <= page + WINDOW; i++) if (i >= 1 && i <= pages) keep.add(i);
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i]! - sorted[i - 1]! > 1) out.push('gap');
    out.push(sorted[i]!);
  }
  return out;
};

export async function Pagination({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  const t = await getTranslations('pagination');
  if (pages <= 1) return null;
  return (
    <nav aria-label={t('aria')} className="mt-8 flex flex-wrap items-center justify-center gap-2 font-mono text-sm">
      {page > 1 ? <Link href={href(page - 1)} rel="prev" className="rounded-full border border-line bg-white px-3 py-1 hover:bg-sand">{t('prev')}</Link> : null}
      {pageList(page, pages).map((n, i) =>
        n === 'gap'
          ? <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-muted">...</span>
          : (
            <Link key={n} href={href(n)} aria-current={n === page ? 'page' : undefined}
              className={`rounded-full px-3 py-1 tabular-nums ${n === page ? 'bg-navy text-white' : 'border border-line bg-white hover:bg-sand'}`}>{n}</Link>
          ),
      )}
      {page < pages ? <Link href={href(page + 1)} rel="next" className="rounded-full border border-line bg-white px-3 py-1 hover:bg-sand">{t('next')}</Link> : null}
    </nav>
  );
}
