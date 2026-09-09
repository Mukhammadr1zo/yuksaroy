import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { URGENT_KIND_LABELS, type SearchLang } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { sapiOrNull } from '@/lib/server-api';
import { uzDateTime } from '@/lib/format';
import type { UrgentStatusPublic } from '@/lib/types-urgent';
import { regionName } from '@/components/catalog/ListingCard';

type Params = { params: Promise<{ locale: string; token: string }> };
const TONE: Record<string, string> = { OPEN: 'bg-teal-soft text-teal-ink', AWARDED: 'bg-navy text-white', CLOSED: 'bg-line text-ink/70', CANCELLED: 'bg-red-50 text-red-700' };
const load = (token: string) => sapiOrNull<UrgentStatusPublic>(`/urgent/status/${encodeURIComponent(token)}`, 30);

export async function generateMetadata({ params }: Params) {
  const { locale, token } = await params;
  const [s, t] = await Promise.all([load(token), getTranslations({ locale, namespace: 'urgent.statusPage' })]);
  return { title: s ? `${s.no} · ${t('eyebrow')} · YukSaroy` : t('notFound'), robots: { index: false } };
}

/** Ochiq holat sahifasi: tur, viloyat, holat, tanlangan ijrochi, voqealar. Narx va telefon yo'q (API ham bermaydi). */
export default async function StatusPage({ params }: Params) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const s = await load(token);
  if (!s) notFound();
  const [t, ts] = await Promise.all([getTranslations('urgent.statusPage'), getTranslations('urgent.status')]);
  const lang = locale as SearchLang;
  const labels = URGENT_KIND_LABELS[lang] ?? URGENT_KIND_LABELS.uz;
  const provider = typeof s.awardedProvider === 'string' ? s.awardedProvider : s.awardedProvider?.name ?? null;
  const facts: [string, string][] = [
    [t('kind'), labels[s.kind] ?? s.kind],
    [t('region'), `${regionName(s.regionCode, lang)}${s.stationName ? `, ${s.stationName}` : ''}`],
    [t('offers'), String(s.offers ?? (s.timeline ?? []).filter((e) => String(e.event ?? '').toLowerCase() === 'offer').length)],
    [t('provider'), provider ?? t('noProvider')],
  ];
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <p className="font-mono text-xs uppercase tracking-wide text-teal-ink">{t('eyebrow')}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold text-navy">{s.no}</h1>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${TONE[s.status] ?? TONE.CLOSED}`}>{ts.has(s.status) ? ts(s.status) : s.status}</span>
      </div>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map(([k, v]) => (
          <div key={k} className="rounded-card border border-line bg-white px-4 py-3">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="mt-1 font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <section className="mt-8">
        <h2 className="text-lg font-bold">{t('timeline')}</h2>
        <ol className="mt-3 space-y-2">
          {(s.timeline ?? []).map((e, i) => {
            const ev = String(e.event ?? e.type ?? e.status ?? '').toUpperCase();
            return (
              <li key={i} className="flex flex-wrap items-baseline gap-3 rounded-card border border-line bg-white px-4 py-3 text-sm">
                <span className="font-mono text-xs text-muted tabular-nums">{uzDateTime(e.at)}</span>
                <span className="font-semibold">{t.has(`event.${ev}`) ? t(`event.${ev}`) : ev}</span>
              </li>
            );
          })}
        </ol>
      </section>
      <p className="mt-6 text-sm text-muted">{t('noPrice')}</p>
      <Link href="/" className="mt-4 inline-block text-sm font-semibold text-teal-ink hover:text-navy">{t('home')}</Link>
    </div>
  );
}
