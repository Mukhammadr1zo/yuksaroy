import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SEARCH_LABELS, SERVICE_TYPE_LABELS, type KycStatus, type RegionCode, type SearchLang } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { sapiOrNull } from '@/lib/server-api';
import { uzDate } from '@/lib/format';
import type { ServiceProfileCard } from '@/lib/types-market';
import { KycBadge } from '@/components/catalog/KycBadge';
import { MarketPhone } from '@/components/market/bits';
import { ReportButton } from '@/components/site/ReportButton';

type Params = { params: Promise<{ locale: string; id: string }> };
const load = (id: string) => sapiOrNull<ServiceProfileCard>(`/services/profiles/${encodeURIComponent(id)}`, 120);

export async function generateMetadata({ params }: Params) {
  const { locale, id } = await params;
  const [p, t] = await Promise.all([load(id), getTranslations({ locale, namespace: 'services.detail' })]);
  return { title: p ? `${p.title} · YukSaroy` : t('notFound'), description: p?.description.slice(0, 160) };
}

/** Xizmat profili: nima qiladi, qayerda, tajriba, narx; telefon obunachiga; "So'rov qoldirish" shu tur bilan. */
export default async function ServiceProfilePage({ params }: Params) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const p = await load(id);
  if (!p) notFound();
  const [t, tg, tsv] = await Promise.all([getTranslations('services.detail'), getTranslations('services.grid'), getTranslations('services')]);
  const lang = (['uz', 'ru', 'en'].includes(locale) ? locale : 'uz') as SearchLang;
  const regions = p.regions.length ? p.regions.map((r) => SEARCH_LABELS[lang].region[r as RegionCode] ?? r).join(', ') : tg('regionsAll');
  const facts: [string, string][] = [
    [t('regions'), regions],
    [t('experience'), p.experienceYears != null ? tg('years', { n: p.experienceYears }) : '-'],
    [t('price'), p.priceNote ?? tg('noPrice')],
    [t('since'), uzDate(p.createdAt, lang)],
  ];
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/services" className="text-sm font-semibold text-teal-ink hover:text-navy">{t('back')}</Link>
      <p className="mt-4 font-mono text-xs uppercase tracking-wide text-teal-ink">{SERVICE_TYPE_LABELS[lang][p.serviceType]}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display min-w-0 text-3xl font-bold text-navy wrap-anywhere">{p.title}</h1>
        {p.isDemo ? <span className="rounded-full border border-amber/40 bg-amber-soft px-2.5 py-0.5 text-[11px] font-semibold text-amber-ink">{tsv('demo')}</span> : null}
      </div>
      {p.owner ? <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">{p.owner}{p.ownerOrg ? <KycBadge kyc={p.ownerOrg.kyc as KycStatus} /> : null}</p> : null}
      {/* Faqat noldan katta bo'lsa. Jadvalga (facts) qo'yilmaydi: bo'sh qiymatli qator "-" bo'lib turardi */}
      {p.doneCount ? <p className="mt-2 font-mono text-sm font-semibold tabular-nums text-teal-ink">{tg('done', { count: p.doneCount })}</p> : null}
      {p.isDemo ? <p className="mt-4 rounded-card border border-amber/30 bg-amber-soft px-4 py-3 text-sm text-amber-ink">{t('demoNote')}</p> : null}

      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        {facts.map(([k, v]) => (
          <div key={k} className="min-w-0 rounded-card border border-line bg-white px-4 py-3">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="mt-1 font-semibold wrap-anywhere">{v}</dd>
          </div>
        ))}
      </dl>
      <section className="mt-4 rounded-card border border-line bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('about')}</h2>
        <p className="mt-2 whitespace-pre-line text-sm wrap-anywhere">{p.description}</p>
      </section>
      {p.hasPhone && !p.isDemo ? (
        <section className="mt-4 rounded-card border border-line bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('phone')}</h2>
          <div className="mt-2"><MarketPhone kind="service" targetId={p.id} next={`/services/${p.id}`} /></div>
        </section>
      ) : null}

      <section className="mt-8 rounded-card border border-teal/40 bg-sand p-5">
        <h2 className="font-display text-xl font-bold text-navy">{t('askTitle')}</h2>
        <p className="mt-1 max-w-[62ch] text-sm text-muted">{t('askBody')}</p>
        <Link href={`/services/request?type=${p.serviceType}`} className="mt-4 inline-block rounded-full bg-teal px-6 py-2.5 font-semibold text-white transition hover:bg-teal-ink active:scale-[0.98]">{t('askCta')}</Link>
      </section>
      {p.isDemo ? null : <div className="mt-8"><ReportButton kind="service" targetId={p.id} /></div>}
    </div>
  );
}
