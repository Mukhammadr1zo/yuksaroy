import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeftIcon } from '@phosphor-icons/react/dist/ssr';
import type { SearchLang } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { BTN } from '@/components/marketing/bits';
import { findPost, readMinutes } from '@/components/marketing/posts';
import { postDate } from '../date';
import { alt } from '@/lib/seo';

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = findPost(slug);
  if (!p) return {};
  const lang = locale as SearchLang;
  return { title: `${p.title[lang]} · YukSaroy`, description: p.lead[lang], ...alt(locale, `/blog/${slug}`) };
}

/** Maqola: sarlavha, sana, o'qish vaqti, bloklar (h/p/li), oxirida amal (xarita yoki bron). */
export default async function PostPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const p = findPost(slug);
  if (!p) notFound();
  const t = await getTranslations('blog');
  const lang = locale as SearchLang;
  const body = p.body[lang];
  return (
    <article className="mx-auto max-w-3xl px-6 py-10 md:py-14">
      <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-ink hover:underline"><ArrowLeftIcon size={16} aria-hidden="true" />{t('back')}</Link>
      <p className="mt-6 font-mono text-xs text-muted">{postDate(p.date, locale)} · {t('minutes', { n: readMinutes(body) })}</p>
      <h1 className="mt-3 font-display text-3xl font-bold leading-[1.1] text-navy md:text-4xl">{p.title[lang]}</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">{p.lead[lang]}</p>
      <div className="mt-8 space-y-4 border-t border-line pt-8 text-[17px] leading-[1.65] text-ink/90">
        {body.map((b, i) => (
          <div key={i}>
            {b.h ? <h2 className="mb-2 mt-6 font-display text-xl font-bold text-navy">{b.h}</h2> : null}
            {b.p ? <p>{b.p}</p> : null}
            {b.li ? (
              <ul className="space-y-2">
                {b.li.map((s, j) => <li key={j} className="flex gap-3"><span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-teal" aria-hidden="true" />{s}</li>)}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-10 flex flex-wrap items-center gap-4 rounded-card border border-line bg-sand p-6">
        <p className="font-display text-lg font-bold text-navy">{t('cta.heading')}</p>
        <Link href={p.cta} className={`ml-auto ${BTN.primary}`}>{t(p.cta === '/map' ? 'cta.map' : 'cta.booking')}</Link>
      </div>
    </article>
  );
}
