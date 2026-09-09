import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/**
 * Hali e'lon qo'shilmagan kategoriya. "Tez orada" demaymiz: katalog tayyor, faqat egalar hali qo'shmagan.
 * Shuning uchun asosiy harakat, e'lon joylash.
 */
export async function EmptyCatalog({ title, lead, examples }: { title: string; lead: string; examples: string[] }) {
  const t = await getTranslations('empty');
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-display text-3xl font-bold text-navy">{title}</h1>
      <p className="mt-2 max-w-[64ch] text-muted">{lead}</p>

      <div className="mt-8 rounded-card border border-dashed border-line bg-white p-10 text-center">
        <p className="font-display text-lg font-bold text-navy">{t('title')}</p>
        <p className="mx-auto mt-2 max-w-[52ch] text-muted">{t('body')}</p>
        <Link
          href="/dashboard/listings/new"
          className="mt-6 inline-block rounded-full bg-teal px-6 py-3 font-semibold text-white transition duration-200 hover:bg-teal-ink active:scale-[0.98]"
        >
          {t('cta')}
        </Link>
      </div>

      <h2 className="mt-10 font-display text-lg font-bold text-navy">{t('examplesHeading')}</h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {examples.map((e) => (
          <li key={e} className="rounded-card border border-line bg-white px-4 py-3 text-sm text-ink/85">{e}</li>
        ))}
      </ul>
    </div>
  );
}
