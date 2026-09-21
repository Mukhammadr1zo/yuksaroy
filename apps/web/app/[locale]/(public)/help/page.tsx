import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { sapiOrNull } from '@/lib/server-api';
import { alt } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };
type Faq = { id: string; q: string; a: string; href: string };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'help.page' });
  return { title: `${t('title')} · YukSaroy`, description: t('lead'), ...alt(locale, '/help') };
}

/** Ko'p so'raladigan savollar: vidjet bilan bir xil lug'at, qidiruv tizimlari va havola ulashish uchun sahifa. */
export default async function HelpPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, faq] = await Promise.all([getTranslations('help'), sapiOrNull<Faq[]>(`/help/faq?locale=${locale}`, 3600)]);
  return (
    <>
      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-teal-ink">{t('page.eyebrow')}</p>
          <h1 className="mt-3 max-w-[22ch] font-display text-3xl font-bold leading-[1.08] text-navy md:text-5xl">{t('page.title')}</h1>
          <p className="mt-4 max-w-[58ch] text-lg text-muted">{t('page.lead')}</p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-14 md:py-16">
        <div className="divide-y divide-line rounded-card border border-line bg-white">
          {(faq ?? []).map((f) => (
            <details key={f.id} id={f.id} className="group px-5 py-4">
              <summary className="cursor-pointer list-none font-display font-bold text-navy marker:content-none">{f.q}</summary>
              <p className="mt-2 text-sm text-ink wrap-anywhere">{f.a}</p>
              <Link href={f.href} className="mt-2 inline-block text-sm font-semibold text-teal-ink hover:underline">{t('page.more')}</Link>
            </details>
          ))}
        </div>
        <div className="mt-8 rounded-card border border-line bg-sand p-5">
          <p className="font-display font-bold text-navy">{t('page.askTitle')}</p>
          <p className="mt-1 text-sm text-muted">{t('page.askBody')}</p>
          <Link href="/contact" className="mt-3 inline-block rounded-full bg-teal px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-ink">{t('contact')}</Link>
        </div>
      </section>
    </>
  );
}
