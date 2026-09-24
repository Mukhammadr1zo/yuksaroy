import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SEARCH_LABELS, SERVICE_TYPE_LABELS, type RegionCode, type SearchLang } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { sapiOrNull } from '@/lib/server-api';
import { uzDate, uzDateTime } from '@/lib/format';
import type { MarketStatusPublic } from '@/lib/types-market';

type Params = { params: Promise<{ locale: string; token: string }> };
const TONE: Record<string, string> = { OPEN: 'bg-teal-soft text-teal-ink', AWARDED: 'bg-navy text-white', DONE: 'bg-teal text-white', CLOSED: 'bg-line text-ink/70', CANCELLED: 'bg-red-50 text-red-700' };
const load = (token: string) => sapiOrNull<MarketStatusPublic>(`/market/status/${encodeURIComponent(token)}`, 30);

export async function generateMetadata({ params }: Params) {
  const { locale, token } = await params;
  const [s, t] = await Promise.all([load(token), getTranslations({ locale, namespace: 'market.statusPage' })]);
  return { title: s ? `${s.no} · ${t('eyebrow')} · YukSaroy` : t('notFound'), robots: { index: false } };
}

/** Ochiq holat sahifasi: tur, joy, holat, tanlangan ijrochi, voqealar. Narx va telefon yo'q (API ham bermaydi). */
export default async function MarketStatusPage({ params }: Params) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const s = await load(token);
  if (!s) notFound();
  const [t, ts, tm] = await Promise.all([getTranslations('market.statusPage'), getTranslations('market.status'), getTranslations('market')]);
  const lang = (['uz', 'ru', 'en'].includes(locale) ? locale : 'uz') as SearchLang;
  const region = (c: string | null) => (c ? SEARCH_LABELS[lang].region[c as RegionCode] ?? c : '');
  const cargo = s.board === 'CARGO';
  const where = cargo ? `${region(s.fromRegion)} -> ${region(s.toRegion)}` : region(s.regionCode);
  const what = cargo ? `${s.cargoName ?? ''}${s.weightT ? `, ${s.weightT} t` : ''}${s.loadDate ? `, ${uzDate(s.loadDate, lang)}` : ''}` : s.serviceType ? SERVICE_TYPE_LABELS[lang][s.serviceType] : '';
  // Tashkilotsiz ijrochi (haydovchi) nomi ochiq sahifada chiqmaydi: faqat "tanlangan"
  const provider = s.awardedProvider?.name ?? (s.awarded ? t('providerPrivate') : t('noProvider'));
  const facts: [string, string][] = [
    [t('board'), `${t(cargo ? 'boardCARGO' : 'boardSERVICE')}${what ? ` · ${what}` : ''}`],
    [t('where'), where],
    [t('offers'), String(s.offers)],
    [t('provider'), provider],
  ];
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <p className="font-mono text-xs uppercase tracking-wide text-teal-ink">{t('eyebrow')}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold text-navy">{s.no}</h1>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${TONE[s.status] ?? TONE.CLOSED}`}>{ts.has(s.status) ? ts(s.status) : s.status}</span>
        {s.isDemo ? <span className="rounded-full border border-amber/40 bg-amber-soft px-2.5 py-0.5 text-[11px] font-semibold text-amber-ink">{tm('demo')}</span> : null}
      </div>
      <p className="mt-2 text-lg font-semibold wrap-anywhere">{s.title}</p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        {facts.map(([k, v]) => (
          <div key={k} className="min-w-0 rounded-card border border-line bg-white px-4 py-3">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="mt-1 font-semibold wrap-anywhere">{v}</dd>
          </div>
        ))}
      </dl>
      <section className="mt-8">
        <h2 className="text-lg font-bold">{t('timeline')}</h2>
        <ol className="mt-3 space-y-2">
          {s.timeline.map((e, i) => {
            const ev = e.event.toUpperCase();
            return (
              <li key={i} className="flex flex-wrap items-baseline gap-3 rounded-card border border-line bg-white px-4 py-3 text-sm">
                <span className="font-mono text-xs text-muted tabular-nums">{uzDateTime(e.at, lang)}</span>
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
