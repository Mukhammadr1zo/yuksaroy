import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr';
import type { SearchLang } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { POSTS, readMinutes } from '@/components/marketing/posts';
import { postDate } from './date';
import { alt } from '@/lib/seo';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'blog.meta' });
  return { ...{ title: t('title'), description: t('description') }, ...alt(locale, '/blog') };
}

/** Blog ro'yxati: to'rt maqola, sana, o'qish vaqti (so'z sonidan), sarlavha va kirish. */
export default async function BlogPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('blog');
  const lang = locale as SearchLang;
  const posts = [...POSTS].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-teal-ink">{t('eyebrow')}</p>
          <h1 className="mt-3 max-w-[22ch] font-display text-3xl font-bold leading-[1.08] text-navy md:text-5xl">{t('title')}</h1>
          <p className="mt-4 max-w-[58ch] text-lg text-muted">{t('lead')}</p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-14 md:py-16">
        <ul className="grid gap-4 md:grid-cols-2">
          {posts.map((p) => (
            <li key={p.slug}>
              <Link href={`/blog/${p.slug}`} className="group flex h-full flex-col rounded-card border border-line bg-white p-6 transition duration-200 hover:border-teal/60">
                <p className="font-mono text-xs text-muted">{postDate(p.date, locale)} · {t('minutes', { n: readMinutes(p.body[lang]) })}</p>
                <h2 className="mt-3 font-display text-xl font-bold leading-snug text-navy">{p.title[lang]}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{p.lead[lang]}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-ink">
                  {t('readMore')}<ArrowRightIcon size={16} className="transition duration-200 group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
