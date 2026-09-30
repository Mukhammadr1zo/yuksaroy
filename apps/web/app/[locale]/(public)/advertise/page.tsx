import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CursorClickIcon, EyeIcon, ProhibitIcon, XIcon } from '@phosphor-icons/react/dist/ssr';
import { Link } from '@/i18n/navigation';
import { BTN } from '@/components/marketing/bits';
import { pageMeta } from '@/lib/seo';

type Params = { params: Promise<{ locale: string }> };

/*
 * Ro'yxatlar kod tomonda, matn esa tarjimada: qatorlar soni uch tilda bir xil bo'lishi
 * kerak va uni JSON ichidagi massivga qoldirsak bir tilda beshta, boshqasida to'rtta
 * qator chiqib qolardi.
 */
const PLACES = ['bottom', 'left', 'right', 'terminal', 'listing'] as const;
const TIMES = ['delay', 'show', 'quiet'] as const;
const FILES = ['types', 'size', 'muted', 'prefer', 'host', 'lang'] as const;
// Uch son uch ikonka bilan: yopilgani ham sotuvchiga kerak, shuning uchun u ham kartada
const COUNTS = [{ key: 'view', Icon: EyeIcon }, { key: 'click', Icon: CursorClickIcon }, { key: 'close', Icon: XIcon }] as const;
const HONEST = ['subscribers', 'rails', 'label', 'outside'] as const;
const REJECT = ['fakeClose', 'fakeUi', 'disguise', 'sound', 'flash', 'restricted', 'http'] as const;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'advertise.meta' });
  return pageMeta(locale, '/advertise', { title: t('title'), description: t('description') });
}

/**
 * Ommaviy "Reklama joylashtirish" sahifasi.
 *
 * Tartib ataylab shunday: avval NIMA borligi (besh joy), keyin SHARTLAR (vaqtlar, fayl,
 * sanoq, cheklovlar, rad etish qoidalari), oxirida murojaat. Reklama beruvchi shartlarni
 * gaplashuvdan OLDIN o'qisa, keyin "obunachi ko'rmasligini bilmagan edim" degan janjal
 * chiqmaydi. Shuning uchun cheklovlar pastda kichik harfda emas, o'z bo'limida turadi.
 *
 * Narx yozilmaydi: uch tilda uchta joyda qotib qolgan son keyin kelishuv bilan sotishni
 * qiyinlashtiradi va har o'zgarishda deploy kerak bo'lardi.
 *
 * Statik server komponenti: sahifada o'zgaruvchi son yo'q. Tashrif soni ham yozilmaydi,
 * chunki u har kuni o'zgaradi va sahifaga qotirib qo'yilgan son ertaga yolg'onga aylanadi.
 */
export default async function AdvertisePage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('advertise');
  return (
    <>
      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-teal-ink">{t('eyebrow')}</p>
          <h1 className="mt-3 max-w-[22ch] font-display text-3xl font-bold leading-[1.08] text-navy md:text-5xl">{t('title')}</h1>
          <p className="mt-4 max-w-[70ch] text-lg leading-relaxed text-muted">{t('lead')}</p>
        </div>
      </section>

      {/* 1. Besh joy jadvali. Telefonda uch ustun sig'maydi, shuning uchun o'z qutisida
          yon tomonga suriladi: ustunni siqib matnni bitta harfga tushirgandan yaxshi. */}
      <section className="mx-auto max-w-6xl px-6 py-14 md:py-16">
        <h2 className="font-display text-2xl font-bold text-navy md:text-3xl">{t('places.heading')}</h2>
        <p className="mt-2 max-w-[62ch] text-muted">{t('places.lead')}</p>
        <p className="mt-4 text-sm text-muted sm:hidden">{t('places.scroll')}</p>
        <div className="mt-4 overflow-x-auto rounded-card border border-line bg-white">
          <table className="w-full min-w-[42rem] text-sm">
            <thead className="bg-sand text-left font-mono text-xs text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-normal">{t('places.col.place')}</th>
                <th scope="col" className="px-4 py-3 font-normal">{t('places.col.where')}</th>
                <th scope="col" className="px-4 py-3 font-normal">{t('places.col.size')}</th>
              </tr>
            </thead>
            <tbody>
              {PLACES.map((k) => (
                <tr key={k} className="border-t border-line/70 align-top">
                  <th scope="row" className="px-4 py-3 text-left font-semibold text-navy">{t(`places.${k}.name`)}</th>
                  <td className="px-4 py-3 leading-relaxed text-ink/85">{t(`places.${k}.where`)}</td>
                  <td className="px-4 py-3 leading-relaxed text-muted">{t(`places.${k}.size`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. Pastki banner: uchta vaqt va har birining sababi. Sabab yozilmasa raqam
          bezakka aylanadi, holbuki reklama beruvchi aynan shu uch songa pul to'laydi. */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-16">
          <h2 className="font-display text-2xl font-bold text-navy md:text-3xl">{t('bottom.heading')}</h2>
          <p className="mt-2 max-w-[70ch] leading-relaxed text-muted">{t('bottom.lead')}</p>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {TIMES.map((k) => (
              <li key={k} className="rounded-card border border-line bg-sand p-5">
                <p className="font-display text-3xl font-bold text-navy tabular-nums">{t(`bottom.${k}.value`)}</p>
                <h3 className="mt-2 font-semibold text-ink">{t(`bottom.${k}.label`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{t(`bottom.${k}.why`)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <p className="max-w-[70ch] rounded-card border border-line p-4 text-sm leading-relaxed text-ink/85">{t('bottom.note')}</p>
            <p className="max-w-[70ch] rounded-card border border-line p-4 text-sm leading-relaxed text-ink/85">{t('bottom.counted')}</p>
          </div>
        </div>
      </section>

      {/* 3. Fayl talablari va 4. sanoq yonma yon: ikkalasi ham reklama beruvchi
          tayyorgarlik ko'radigan qism, bittasi faylni, ikkinchisi natijani belgilaydi. */}
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-2 md:py-16">
        <div>
          <h2 className="font-display text-2xl font-bold text-navy md:text-3xl">{t('files.heading')}</h2>
          <p className="mt-2 text-muted">{t('files.lead')}</p>
          <ul className="mt-5 space-y-3">
            {FILES.map((k) => (
              <li key={k} className="flex gap-3 text-[15px] leading-[1.55] text-ink/85">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" aria-hidden="true" />{t(`files.${k}`)}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold text-navy md:text-3xl">{t('counts.heading')}</h2>
          <p className="mt-2 text-muted">{t('counts.lead')}</p>
          <ul className="mt-5 space-y-3">
            {COUNTS.map(({ key, Icon }) => (
              <li key={key} className="flex gap-4 rounded-card border border-line bg-white p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-soft text-teal-ink"><Icon size={20} aria-hidden="true" /></span>
                <div>
                  <h3 className="font-semibold text-ink">{t(`counts.${key}.name`)}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{t(`counts.${key}.body`)}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-ink/85">{t('counts.privacy')}</p>
        </div>
      </section>

      {/* 5. Halol shartlar. Alohida bo'lim va oq fonda: bu qism ko'rishlar sonini
          kamaytiradi, ya'ni uni pastga kichik harfda yashirish keyin janjal keltiradi. */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-16">
          <h2 className="font-display text-2xl font-bold text-navy md:text-3xl">{t('honest.heading')}</h2>
          <p className="mt-2 max-w-[62ch] text-muted">{t('honest.lead')}</p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {HONEST.map((k) => (
              <li key={k} className="rounded-card border border-line bg-sand p-5">
                <h3 className="font-display text-lg font-bold text-navy">{t(`honest.${k}.name`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/85">{t(`honest.${k}.body`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 6. Rad etish qoidalari: qaysi banner qabul qilinmasligi oldindan aytiladi. */}
      <section className="mx-auto max-w-6xl px-6 py-14 md:py-16">
        <h2 className="font-display text-2xl font-bold text-navy md:text-3xl">{t('reject.heading')}</h2>
        <p className="mt-2 max-w-[62ch] text-muted">{t('reject.lead')}</p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {REJECT.map((k) => (
            <li key={k} className="flex gap-3 rounded-card border border-line bg-white p-4 text-[15px] leading-[1.5] text-ink/85">
              <ProhibitIcon size={20} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />{t(`reject.${k}`)}
            </li>
          ))}
        </ul>
      </section>

      {/* 7. Murojaat. Narx o'rniga bitta gap: nega yozilmagani ochiq aytiladi. */}
      <section className="bg-navy">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 md:grid-cols-[1.4fr_1fr] md:items-center md:py-20">
          <div>
            <h2 className="font-display text-2xl font-bold text-white md:text-3xl">{t('cta.heading')}</h2>
            <p className="mt-3 max-w-[56ch] text-white/70">{t('cta.body')}</p>
            <p className="mt-3 max-w-[56ch] text-sm text-white/55">{t('cta.price')}</p>
          </div>
          <div className="md:justify-self-end">
            <Link href="/contact" className={`${BTN.primary} inline-block`}>{t('cta.action')}</Link>
            <p className="mt-3 max-w-[28ch] text-sm text-white/55">{t('cta.note')}</p>
          </div>
        </div>
      </section>
    </>
  );
}
