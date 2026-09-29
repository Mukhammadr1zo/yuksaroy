import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CheckIcon } from '@phosphor-icons/react/dist/ssr';
import { SUBSCRIPTION_GRANTS } from '@yuksaroy/domain';
import { DashLink } from '@/components/site/DashLink';
import { num } from '@/lib/format';
import { subscriptionPrice } from '@/lib/subscription-price';
import { BTN, Faq } from '@/components/marketing/bits';
import { alt } from '@/lib/seo';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pricing.meta' });
  return { ...{ title: t('title'), description: t('description') }, ...alt(locale, '/pricing') };
}

/**
 * Kartalar: Bepul, sotuvdagi har bir tarif, Jamoa. Komissiya qatori va 7 savol.
 *
 * O'rtadagi tarif kartalari bazadan: nom, tavsif va narxni admin "Tariflar" bo'limida
 * belgilaydi, kod emas. Ilgari narx sozlamada, tarif esa alohida turardi va ikkisi zid
 * ketardi: admin tarifni arzonlashtirsa bu sahifa eski narxni ko'rsatardi. Endi obuna
 * kartasi ham, bu sahifa ham bitta ro'yxatni chizadi. Tarif hali yaratilmagan bo'lsa
 * tarjima faylidagi umumiy "Obuna" kartasi chiqadi: sahifa bo'sh qolmasin.
 *
 * Bepul va Jamoa kartalari matndan iborat: e'lon soni chegarasi kodda yo'q, do'kon sahifasi
 * faqat egalikni so'raydi, jamoa hisobi esa qurilmagan (har kim o'zi buyurtma beradi,
 * tashkilot bitta o'tkazma qiladi).
 */
type Card = { key: string; name: string; priceSom: number | null; note: string; features: string[]; href: string; cta: string; hot: boolean };

export default async function PricingPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('pricing');
  const sub = await subscriptionPrice();

  const vars = { phones: sub.phoneRevealDaily, free: sub.wagonSearchFree };
  const fromI18n = (key: 'free' | 'subscription' | 'team', n: number, href: string, priceSom: number | null): Card => ({
    key, name: t(`${key}.name`), priceSom, note: t(`${key}.note`), href, cta: t(`${key}.cta`), hot: key === 'subscription',
    features: Array.from({ length: n }, (_, i) => t(`${key}.f${i + 1}`, vars)),
  });
  // Ajratilgan karta serverdagi sukut tarif bilan bir xil: hamma ruxsatni beradigan birinchi
  // tarif. Shunchaki birinchisi olinsa, admin arzon vagon tarifini oldinga qo'yganda unga
  // "Hammasi ichida" yorlig'i tushardi. To'liq tarif yo'q bo'lsa birinchisi
  const full = sub.plans.findIndex((p) => SUBSCRIPTION_GRANTS.every((g) => p.grants.includes(g)));
  const hotIdx = full === -1 ? 0 : full;
  const planCards: Card[] = sub.plans.length
    ? sub.plans.map((p, i) => ({
      key: p.code, name: p.name[locale] ?? p.name.uz ?? p.code, priceSom: p.priceMonthSom, note: t('subscription.note'),
      features: p.features[locale] ?? p.features.uz ?? [], href: '/dashboard/subscription', cta: t('subscription.cta'), hot: i === hotIdx,
    }))
    : [fromI18n('subscription', 5, '/dashboard/subscription', sub.pricePerMonthSom)];
  const cards = [fromI18n('free', 4, '/dashboard/listings/new', null), ...planCards, fromI18n('team', 3, '/contact?topic=partner', null)];

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
        <ul className="grid gap-4 lg:grid-cols-3">
          {cards.map((p) => (
            <li key={p.key} className={`relative flex flex-col rounded-card border bg-white p-6 ${p.hot ? 'border-navy' : 'border-line'}`}>
              {p.hot ? <span className="absolute -top-3 left-6 rounded-full bg-navy px-3 py-1 font-mono text-[11px] font-semibold text-white">{t('subscription.badge')}</span> : null}
              <h2 className="font-display text-lg font-bold text-navy">{p.name}</h2>
              <p className="mt-3 font-display text-3xl font-bold tabular-nums text-navy">
                {p.priceSom !== null ? <>{num(p.priceSom, locale)} <span className="font-mono text-base font-normal text-muted">{t('perMonth')}</span></> : t(`${p.key}.price`)}
              </p>
              <p className="mt-1 text-sm text-muted">{p.note}</p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-sm text-ink/85">
                    <CheckIcon size={16} weight="bold" className="mt-0.5 shrink-0 text-teal-ink" aria-hidden="true" />{f}
                  </li>
                ))}
              </ul>
              <DashLink href={p.href} className={`mt-6 ${p.hot ? BTN.primary : BTN.outline}`}>{p.cta}</DashLink>
              {/* Eslatma faqat asosiy kartada: har kartada takrorlansa sahifa cho'zilib ketadi */}
              {p.hot ? <p className="mt-3 text-xs leading-relaxed text-muted">{t('subscription.hint')}</p> : null}
            </li>
          ))}
        </ul>

        <div className="mt-8 rounded-card border border-line bg-sand p-6">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-teal-ink">{t('commission.heading')}</h2>
          <p className="mt-2 max-w-[70ch] text-lg font-semibold text-navy">{t('commission.line')}</p>
          <p className="mt-2 max-w-[70ch] text-sm text-muted">{t('commission.note')}</p>
        </div>
      </section>

      <Faq ns="pricing.faq" count={7} />
    </>
  );
}
