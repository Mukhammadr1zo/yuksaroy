'use client';
// E'lon izohlari: xizmatdan foydalangan odam baho qoldiradi, egasi javob beradi.
// Yozish huquqi ikki tomonli yozishmadan keyin ochiladi (server ham shuni tekshiradi).
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api, hasSession, post } from '@/lib/api';
import { uzDate } from '@/lib/format';
import { Stars } from './Stars';

type Item = { id: string; rating: number; text: string | null; reply: string | null; repliedAt: string | null; createdAt: string; author: string | null };
type Page = { rating: { show: boolean; avg: number | null; count: number }; minToShow: number; total: number; items: Item[] };
type Mine = { canReview: boolean; already: { id: string; rating: number; text: string | null } | null };

export function ListingReviews({ listingId, slug }: { listingId: string; slug: string }) {
  const t = useTranslations('reviews');
  const tl = useTranslations('listing.reviews');
  const locale = useLocale();
  const [page, setPage] = useState<Page | null>(null);
  const [mine, setMine] = useState<Mine | null>(null);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Page>(`/listings/${slug}/reviews`).then(setPage).catch(() => setPage(null));
    if (hasSession()) api<Mine>(`/listings/${listingId}/reviews/mine`).then(setMine).catch(() => setMine(null));
  }, [listingId, slug]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!rating || busy) return;
    setBusy(true); setErr(null);
    try {
      await post(`/listings/${listingId}/reviews`, { rating, text: text.trim() || undefined });
      setMine({ canReview: false, already: { id: 'new', rating, text: text.trim() || null } });
      setText('');
      setPage(await api<Page>(`/listings/${slug}/reviews`));
    } catch { setErr(tl('failed')); } finally { setBusy(false); }
  }

  const count = page?.rating.count ?? 0;
  return (
    <section>
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-lg font-bold">{t('heading')}</h2>
        {page?.rating.avg != null
          ? <span className="font-mono text-sm text-navy tabular-nums">{t('summary', { avg: `★ ${page.rating.avg.toFixed(1)}`, count })}</span>
          : <span className="font-mono text-sm text-muted">{count ? t('hidden', { count, min: page?.minToShow ?? 3 }) : t('none')}</span>}
      </div>

      {/* Terminal sahifasidagi kabi: ro'yxatda barcha izohlar (reytingga kirmaydiganlari ham), count esa faqat hisobga kirganlari */}
      {page && page.total > 0 ? (
        <ul className="mt-3 space-y-3">
          {page.items.map((x) => (
            <li key={x.id} className="rounded-card border border-line bg-white p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <Stars n={x.rating} />
                <span className="font-semibold">{x.author ?? tl('anonymous')}</span>
                <span className="font-mono text-xs text-muted">{uzDate(x.createdAt, locale)}</span>
              </div>
              {x.text ? <p className="mt-2 whitespace-pre-line text-sm text-ink/85">{x.text}</p> : null}
              {x.reply ? (
                <div className="mt-3 rounded-xl bg-sand px-3 py-2 text-sm">
                  <p className="text-xs font-semibold text-muted">{t('reply')}{x.repliedAt ? ` · ${uzDate(x.repliedAt, locale)}` : ''}</p>
                  <p className="mt-0.5 whitespace-pre-line">{x.reply}</p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-sm text-muted">{tl('emptyBody')}</p>}

      {mine?.already ? <p className="mt-3 rounded-xl bg-teal-soft px-4 py-3 text-sm text-teal-ink">{tl('thanks')}</p> : null}

      {mine?.canReview ? (
        <form onSubmit={send} className="mt-4 rounded-card border border-line bg-white p-4">
          <p className="font-semibold">{tl('formTitle')}</p>
          <p className="mt-0.5 text-xs text-muted">{tl('formHint')}</p>
          <div className="mt-3 flex gap-1" role="radiogroup" aria-label={tl('formTitle')}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} onClick={() => setRating(n)}
                className={`flex h-10 w-10 items-center justify-center rounded-full border text-lg transition-colors duration-150 ${rating >= n ? 'border-amber bg-amber-soft text-amber-ink' : 'border-line text-muted hover:border-teal'}`}>
                {'★'}
              </button>
            ))}
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={1000} placeholder={tl('placeholder')}
            className="mt-3 w-full rounded-xl border border-field px-4 py-2.5 text-base outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/25" />
          <button disabled={!rating || busy} className="mt-2 rounded-full bg-teal px-6 py-2.5 font-semibold text-white transition hover:bg-teal-ink disabled:opacity-60">
            {busy ? tl('sending') : tl('send')}
          </button>
          {err ? <p role="alert" className="mt-2 text-sm text-red-700">{err}</p> : null}
        </form>
      ) : null}
    </section>
  );
}
