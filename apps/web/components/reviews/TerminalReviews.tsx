import { getTranslations } from 'next-intl/server';
import { REVIEW } from '@yuksaroy/domain';
import { sapi } from '@/lib/server-api';
import { uzDate } from '@/lib/format';
import type { ReviewsPage } from '@/lib/types-trust';
import { Stars } from './Stars';

/** Terminal sahifasi: baho xulosasi va ro'yxat (terminal javobi bilan). 0 bo'lsa tushuntirish matni. */
export async function TerminalReviews({ slug }: { slug: string }) {
  const [t, r] = await Promise.all([getTranslations('reviews'), sapi<ReviewsPage>(`/terminals/${slug}/reviews`, 60).catch(() => null)]);
  const count = r?.count ?? 0;
  return (
    <section>
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-lg font-bold">{t('heading')}</h2>
        {r?.avg != null ? <span className="font-mono text-sm text-navy tabular-nums">{t('summary', { avg: `★ ${r.avg.toFixed(1)}`, count })}</span>
          : <span className="font-mono text-sm text-muted">{count ? t('hidden', { count, min: REVIEW.minToShow }) : t('none')}</span>}
      </div>
      {/* Ro'yxatda barcha sharhlar (reytingga kirmaydiganlari ham), count esa faqat hisobga kirganlari */}
      {!r || r.total === 0 ? <p className="mt-2 text-sm text-muted">{t('noneBody')}</p> : (
        <ul className="mt-3 space-y-3">
          {r.items.map((x) => (
            <li key={x.id} className="rounded-card border border-line bg-white p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <Stars n={x.rating} />
                <span className="font-semibold">{x.orgName}</span>
                <span className="font-mono text-xs text-muted">{t('order')} {x.orderNo} · {uzDate(x.createdAt)}</span>
              </div>
              {x.text ? <p className="mt-2 whitespace-pre-line text-sm text-ink/85">{x.text}</p> : null}
              {x.reply ? (
                <div className="mt-3 rounded-xl bg-sand px-3 py-2 text-sm">
                  <p className="text-xs font-semibold text-muted">{t('reply')}{x.repliedAt ? ` · ${uzDate(x.repliedAt)}` : ''}</p>
                  <p className="mt-0.5 whitespace-pre-line">{x.reply}</p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
