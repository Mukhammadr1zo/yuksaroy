import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ContactForm } from '@/components/marketing/ContactForm';
import { alt } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ topic?: string; text?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contact.meta' });
  return { ...{ title: t('title'), description: t('description') }, ...alt(locale, '/contact') };
}

/** Murojaat: forma (mijoz komponenti, POST /contact) va yon ustunda boshqa yo'llar. ?topic= tanlovni, ?text= xabar maydonini oldindan qo'yadi (/pricing va ochilgan telefondan). */
export default async function ContactPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [{ topic, text }, t] = await Promise.all([searchParams, getTranslations('contact')]);
  const links = [
    { key: 'pricing', href: '/pricing' },
  ] as const;
  return (
    <>
      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-teal-ink">{t('eyebrow')}</p>
          <h1 className="mt-3 max-w-[22ch] font-display text-3xl font-bold leading-[1.08] text-navy md:text-5xl">{t('title')}</h1>
          <p className="mt-4 max-w-[58ch] text-lg text-muted">{t('lead')}</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-14 md:grid-cols-[1.3fr_1fr] md:py-16">
        <ContactForm topic={topic} text={text?.slice(0, 2000)} />
        <aside>
          <h2 className="font-display text-lg font-bold text-navy">{t('aside.heading')}</h2>
          <ul className="mt-4 divide-y divide-line rounded-card border border-line bg-white">
            <li>
              <a href="https://t.me/yuksaroy_bot" target="_blank" rel="noreferrer" className="block px-5 py-4 transition hover:bg-sand">
                <span className="font-semibold text-ink">{t('aside.bot')}</span>
                <span className="mt-0.5 block text-sm text-muted">{t('aside.botNote')}</span>
              </a>
            </li>
            {links.map((l) => (
              <li key={l.key}>
                <Link href={l.href} className="block px-5 py-4 transition hover:bg-sand">
                  <span className="font-semibold text-ink">{t(`aside.${l.key}`)}</span>
                  <span className="mt-0.5 block text-sm text-muted">{t(`aside.${l.key}Note`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </section>
    </>
  );
}
