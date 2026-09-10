import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CheckCircleIcon, InfoIcon } from '@phosphor-icons/react/dist/ssr';
import { LISTING, LISTING_KINDS, LISTING_LABELS, LISTING_RULES, type SearchLang } from '@yuksaroy/domain';
import { alt } from '@/lib/seo';
import { AuthOnly } from '@/components/site/AuthOnly';

type Params = { params: Promise<{ locale: string }> };
const FIELD = ['title', 'deal', 'year', 'condition', 'regionCode', 'photos', 'model', 'capacityT', 'priceTiyin', 'terminalId', 'responseHours', 'wagonType', 'qty', 'truckType', 'tonnage', 'serviceRegions', 'routes', 'fleetSize'] as const;
type Field = (typeof FIELD)[number];
const RULES = ['year', 'qty', 'tonnage', 'rentUnits', 'saleUnits', 'truckUnits', 'priceUnit', 'oneObject', 'serviceRegions', 'routes', 'photos', 'expire', 'review'] as const;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'standart' });
  return { ...{ title: `${t('title')} · YukSaroy`, description: t('lead') }, ...alt(locale, '/standards') };
}

/** E'lon standarti: LISTING_RULES jadvali (shart / tavsiya), egasi qoidasi (kim e'lon beradi), terminal va shahobcha qoidalari, muvofiqlik ro'yxati. Statik. */
export default async function StandartPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('standart');
  const labels = LISTING_LABELS[locale as SearchLang];
  const Level = ({ must }: { must: boolean }) => (
    <span className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${must ? 'bg-teal-soft text-teal-ink' : 'bg-sand text-muted'}`}>{must ? t('must') : t('should')}</span>
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-display text-3xl font-bold text-navy">{t('title')}</h1>
      <p className="mt-2 max-w-[64ch] text-muted">{t('lead')}</p>
      <p className="mt-4 flex max-w-[72ch] items-start gap-2 rounded-card border border-amber/40 bg-amber-soft px-4 py-3 text-sm text-ink/85">
        <InfoIcon size={18} className="mt-0.5 shrink-0 text-amber-ink" aria-hidden="true" />{t('notCert')}
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {LISTING_KINDS.map((k) => {
          const r = LISTING_RULES[k];
          const fields = [...r.must.map((f) => [f, true] as const), ...r.should.map((f) => [f, false] as const)];
          return (
            <section key={k} className="rounded-card border border-line bg-white p-5">
              <h2 className="font-display text-lg font-bold text-navy">{labels.kind[k]}</h2>
              <table className="mt-3 w-full text-sm">
                <thead className="text-left font-mono text-xs text-muted"><tr><th className="py-1 font-normal">{t('col.field')}</th><th className="py-1 text-right font-normal">{t('col.level')}</th></tr></thead>
                <tbody>
                  <tr><td className="py-1.5">{t('owner.label')}</td><td className="py-1.5 text-right text-xs font-semibold text-navy">{t(k === 'TRUCK' ? 'owner.any' : 'owner.org')}</td></tr>
                  {fields.map(([f, must]) => (
                    <tr key={f} className="border-t border-line/70"><td className="py-1.5">{t(`field.${f as Field}`)}</td><td className="py-1.5 text-right"><Level must={must} /></td></tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
        {(['terminal', 'siding'] as const).map((k) => (
          <section key={k} className="rounded-card border border-line bg-white p-5">
            <h2 className="font-display text-lg font-bold text-navy">{t(`${k}.title`)}</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex gap-3"><dt className="shrink-0"><Level must /></dt><dd>{t(`${k}.must`)}</dd></div>
              <div className="flex gap-3"><dt className="shrink-0"><Level must={false} /></dt><dd>{t(`${k}.should`)}</dd></div>
              <div className="flex gap-3"><dt className="shrink-0 rounded-full bg-sand px-2 py-0.5 font-mono text-[11px] font-semibold text-navy">{t('owner.label')}</dt><dd>{t(`${k}.owner`)}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted">{t(`${k}.note`)}</p>
          </section>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="font-display text-lg font-bold text-navy">{t('rules.heading')}</h2>
        <p className="mt-1 text-sm text-muted">{t('rules.lead')}</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {RULES.map((r) => (
            <li key={r} className="flex items-start gap-2 rounded-card border border-line bg-white px-4 py-3 text-sm">
              <CheckCircleIcon size={18} weight="fill" className="mt-0.5 shrink-0 text-teal" aria-hidden="true" />
              <span>{t(`rules.${r}`, { max: LISTING.maxPhotos, days: LISTING.expireDays })}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-white p-6">
        <p className="max-w-[56ch] text-sm text-muted">{t('ctaNote')}</p>
        <AuthOnly>
        <Link href="/dashboard/listings/new" className="rounded-full bg-teal px-6 py-3 font-semibold text-white transition hover:bg-teal-ink active:scale-[0.98]">{t('cta')}</Link>
        </AuthOnly>
      </section>
    </div>
  );
}
