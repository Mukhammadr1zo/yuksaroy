import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { WagonSearch } from '@/components/wagon/WagonSearch';
import { Ld, breadcrumbs, pageMeta } from '@/lib/seo';

type Params = { params: Promise<{ locale: string }> };

/*
 * DIQQAT: bu sahifa faqat tarjimalardan quriladi, ya'ni statik bo'lishi mumkin edi, lekin
 * butun (public) guruhi har so'rovda qaytadan chiziladi. Sababi guruh layout'i
 * setRequestLocale chaqirmaydi. Uni qo'shib ko'rildi: sahifalar statik chizishga o'tadi,
 * lekin /help kabi sahifalar qurilish paytida API ga murojaat qiladi va CI da API yo'q,
 * shuning uchun qurilish yiqiladi. Ya'ni bu bir qatorlik ish emas, alohida o'lchov kerak.
 * revalidate qo'yilmadi: dinamik yo'lda u hech narsa qilmaydi va yolg'on va'da bo'lardi.
 */

/**
 * Sarlavha va tavsif alohida `seo` kalitlarida turadi, ekrandagi sarlavhadan ajratilgan.
 *
 * Nega: bular ikki xil vazifa. Ekrandagi "Vagon qayerda" odamga tushunarli qisqa gap,
 * qidiruv sarlavhasi esa odam qidiruv qatoriga chindan yozadigan so'zlar bilan bo'lishi
 * kerak ("dislokatsiya", "raqami bo'yicha izlash"). Bitta matn ikkisini birga bajara olmaydi.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'wagon' });
  return pageMeta(locale, '/wagon', { title: t('seo.title'), description: t('seo.description') });
}

const H2 = 'font-display mt-10 text-xl font-bold text-navy md:text-2xl';
const P = 'mt-3 max-w-[68ch] text-muted';
const LI = 'mt-2 text-muted';

/** Vagon qidiruvi: tepada asbob, ostida uni tushuntiradigan matn va savollar. */
export default async function WagonPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('wagon');
  const faq = [1, 2, 3, 4, 5, 6].map((i) => ({ q: t(`faqBlock.q${i}`), a: t(`faqBlock.a${i}`) }));

  return (
    <section className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      <Ld data={breadcrumbs(locale, [{ name: t('title'), path: '/wagon' }])} />
      <Ld
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faq.map((x) => ({
            '@type': 'Question',
            name: x.q,
            acceptedAnswer: { '@type': 'Answer', text: x.a },
          })),
        }}
      />

      <p className="font-mono text-xs uppercase tracking-wide text-teal-ink">{t('eyebrow')}</p>
      <h1 className="font-display mt-3 text-3xl font-bold text-navy md:text-4xl">{t('title')}</h1>
      <p className="mt-3 max-w-[60ch] text-lg text-muted">{t('lead')}</p>
      <div className="mt-8">
        <WagonSearch />
      </div>

      {/* Asbob ostidagi matn: qidiruv tizimi uchun ham, birinchi marta kelgan odam uchun ham.
          Asbobning ustida emas, ostida: kelgan odam avval qidirishi kerak. */}
      <div className="mt-4 border-t border-line pt-4">
        <h2 className={H2}>{t('about.h2')}</h2>
        <p className={P}>{t('about.p1')}</p>
        <p className={P}>{t('about.p2')}</p>

        <h2 className={H2}>{t('how.h2')}</h2>
        <ol className="mt-3 list-decimal pl-6">
          <li className={LI}>{t('how.s1')}</li>
          <li className={LI}>{t('how.s2')}</li>
          <li className={LI}>{t('how.s3')}</li>
        </ol>

        <h2 className={H2}>{t('gives.h2')}</h2>
        <ul className="mt-3 list-disc pl-6">
          <li className={LI}>{t('gives.i1')}</li>
          <li className={LI}>{t('gives.i2')}</li>
          <li className={LI}>{t('gives.i3')}</li>
          <li className={LI}>{t('gives.i4')}</li>
        </ul>
        <p className={P}>{t('gives.p')}</p>

        <h2 className={H2}>{t('rail.h2')}</h2>
        <p className={P}>{t('rail.p')}</p>

        <h2 className={H2}>{t('who.h2')}</h2>
        <ul className="mt-3 list-disc pl-6">
          <li className={LI}>{t('who.i1')}</li>
          <li className={LI}>{t('who.i2')}</li>
          <li className={LI}>{t('who.i3')}</li>
        </ul>

        <h2 className={H2}>{t('faqBlock.h2')}</h2>
        <dl className="mt-3">
          {faq.map((x) => (
            <div key={x.q} className="mt-4">
              <dt className="font-semibold text-navy">{x.q}</dt>
              <dd className="mt-1 max-w-[68ch] text-muted">{x.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
