import { Link } from '@/i18n/navigation';
import uz from '@/messages/uz/legal.json';
import ru from '@/messages/ru/legal.json';
import en from '@/messages/en/legal.json';

/**
 * Shartlar va Maxfiylik bitta komponentdan chiqadi: tuzilishi bir xil, farqi faqat matn.
 *
 * Matn next-intl lug'atiga QO'SHILMAGAN (messages/<lang>/index.ts da import yo'q):
 * layout da NextIntlClientProvider messages propsiz chizilgan, ya'ni lug'atdagi hamma
 * narsa har bir sahifaning mijoz yukiga tushadi. Ikki hujjatning to'liq matni katalog
 * va kabinetda keraksiz. Fayl baribir messages/ ichida turadi, chunki parite tekshiruvi
 * o'sha papkadagi hamma .json ni o'qiydi.
 *
 * Quyidagi Record yozuvi tufayli uch tilning kaliti tsc ning o'zida tekshiriladi:
 * ru yoki en da kalit yetishmasa web tip tekshiruvi yiqiladi.
 */
const DOCS: Record<string, typeof uz.legal> = { uz: uz.legal, ru: ru.legal, en: en.legal };

/** Versiya alohida raqam emas - tahrir sanasi versiyaning o'zi. Matn o'zgarganda SHU QATOR yangilanadi. */
export const LEGAL_UPDATED = '2026-10-02';

/** Noma'lum til bo'lsa o'zbekcha: sahifa yiqilmaydi. generateMetadata ham shuni chaqiradi. */
export const legalDoc = (locale: string) => DOCS[locale] ?? DOCS.uz!;

export function LegalPage({ locale, doc }: { locale: string; doc: 'terms' | 'privacy' }) {
  const L = legalDoc(locale);
  const d = L[doc];
  const other = doc === 'terms' ? 'privacy' : 'terms';
  // Bo'lim soni bu yerda qattiq yozilmaydi, matndan o'qiladi: JSON dan xat boshi
  // olinganda sahifa jimgina noto'g'ri emas, shunchaki qisqa chiqadi.
  const sections = Object.entries(d).filter(([k]) => /^s\d+$/.test(k)) as [string, Record<string, string>][];

  return (
    <>
      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-3xl px-6 py-14 md:py-20">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-teal-ink">{d.eyebrow}</p>
          <h1 className="font-display mt-3 text-3xl font-bold leading-[1.08] text-navy md:text-5xl">{d.title}</h1>
          <p className="mt-4 font-mono text-sm text-muted">{L.updated}: {LEGAL_UPDATED}</p>
          <p className="mt-4 text-lg text-muted">{d.lead}</p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        {sections.map(([key, sec], i) => {
          const { h, ...paras } = sec;
          return (
            <section key={key} className={i ? 'mt-10' : ''}>
              <h2 className="font-display text-xl font-bold text-navy md:text-2xl">{h}</h2>
              {Object.entries(paras).map(([pk, p]) => (
                <p key={pk} className="mt-3 leading-relaxed text-ink/85">{p}</p>
              ))}
            </section>
          );
        })}

        <p className="mt-12 border-t border-line pt-6 text-sm text-muted">
          {L.other}{' '}
          <Link href={`/${other}`} className="font-semibold text-teal-ink hover:underline">{L[other].title}</Link>
        </p>
      </div>
    </>
  );
}
