import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MagnifyingGlassIcon, MapPinIcon } from '@phosphor-icons/react/dist/ssr';
import { YORDAMCHI, chipLabel, formatSom, type SearchChip, type SearchLang } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { qs, spost } from '@/lib/server-api';
import { BTN } from '@/components/marketing/bits';
import { alt } from '@/lib/seo';

type Params = { params: Promise<{ locale: string }> };
/** POST /search/parse javobi (kerakli qismi); source va quota 6-bosqichda qo'shiladi. */
type Parsed = {
  filters: { bookable: boolean; confidence: number };
  chips: SearchChip[];
  query: Record<string, string>;
  decision: { terminals: number; freeToday: number; cheapestTiyin: number | null };
  source?: 'dictionary' | 'llm';
};
// Statik zaxira: API javob bermasa ham misol ko'rinadi (real so'rovning lug'at natijasi)
const FALLBACK: Parsed = {
  filters: { bookable: true, confidence: 0.8 },
  chips: [{ key: 'region:UZ-TK', type: 'region', value: 'UZ-TK' }, { key: 'service:CONTAINER', type: 'service', value: 'CONTAINER' }, { key: 'bookable:1', type: 'bookable', value: '1' }],
  query: { region: 'UZ-TK', service: 'CONTAINER' },
  decision: { terminals: 0, freeToday: 0, cheapestTiyin: null },
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'features.assistant.meta' });
  return { ...{ title: t('title'), description: t('description') }, ...alt(locale, '/features/assistant') };
}

/** Yordamchi: bitta real misol (so'rov -> chiplar -> xarita ko'rinishi, /search/parse dan jonli), qoida (lug'at avval, AI 0.6 dan past), limitlar (YORDAMCHI). */
export default async function AssistantPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('features.assistant');
  const lang = locale as SearchLang;
  const q = t('example.query');
  const live = await spost<Parsed>('/search/parse', { q, lang }, 300).catch(() => null);
  const r = live ?? FALLBACK;
  const href = `/terminals${qs({ ...r.query, bookable: r.filters.bookable ? 1 : undefined })}`;

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
        <h2 className="font-display text-2xl font-bold text-navy md:text-3xl">{t('example.heading')}</h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <div className="rounded-card border border-line bg-white p-5">
            {/* Qidiruv qatori ko'rinishi: haqiqiy so'rov matni */}
            <div className="flex items-center gap-3 rounded-xl border border-line bg-sand px-4 py-3">
              <MagnifyingGlassIcon size={18} className="shrink-0 text-muted" aria-hidden="true" />
              <span className="min-w-0 break-words text-ink">{q}</span>
            </div>
            <p className="mt-5 text-xs font-semibold text-muted">{t('example.chips')}</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {r.chips.map((c) => <li key={c.key} className="rounded-full bg-teal-soft px-3 py-1 text-sm font-semibold text-teal-ink">{chipLabel(c, lang)}</li>)}
            </ul>
            <p className="mt-4 font-mono text-xs text-muted">{t(`example.source.${r.source ?? 'dictionary'}`)} · {r.filters.confidence.toFixed(2)}</p>
            {!live ? <p className="mt-1 text-xs text-amber-ink">{t('example.unavailable')}</p> : null}
          </div>

          {/* Xarita ko'rinishi: HTML bilan chizilgan (tasvir emas), ustida real qaror qatori */}
          <div className="relative min-h-[260px] overflow-hidden rounded-card border border-line bg-sand" aria-hidden="true">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent_0_39px,rgba(0,35,82,0.05)_39px_40px),repeating-linear-gradient(90deg,transparent_0_39px,rgba(0,35,82,0.05)_39px_40px)]" />
            <div className="absolute left-[-10%] top-[58%] w-[120%] rotate-[-8deg] border-t-2 border-dashed border-navy/50" />
            <div className="absolute left-[-10%] top-[34%] w-[120%] rotate-[14deg] border-t-2 border-[#F39C1F]/70" />
            <div className="absolute left-[54%] top-[44%] flex -translate-x-1/2 -translate-y-full flex-col items-center">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber text-white ring-2 ring-white"><MapPinIcon size={16} weight="fill" aria-hidden="true" /></span>
            </div>
            {/* Sonlar namunasiz keladi. Egasi qarori (2026-10-07): nol sanoq chizilmaydi, shuning uchun
                haqiqiy terminal topilmasa natija qutisi yo'q, bo'sh joy 0 bo'lsa xabar o'sha bo'lakni tashlaydi */}
            {r.decision.terminals > 0 ? (
              <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-line bg-white/95 px-4 py-3">
                <p className="text-xs font-semibold text-muted">{t('example.result')}</p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-navy tabular-nums">
                  {t('example.decision', { terminals: r.decision.terminals, free: r.decision.freeToday })}
                  {r.decision.cheapestTiyin ? ` · ${t('example.cheapest', { price: formatSom(r.decision.cheapestTiyin) })}` : ''}
                </p>
              </div>
            ) : null}
          </div>
        </div>
        <Link href={href} className={`mt-4 inline-block ${BTN.outline}`}>{t('example.open')}</Link>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.4fr_1fr] md:py-16">
          <div>
            <h2 className="font-display text-2xl font-bold text-navy md:text-3xl">{t('rule.heading')}</h2>
            <ol className="mt-6 space-y-4">
              {([1, 2, 3, 4] as const).map((i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sand font-mono text-xs text-muted">{i}</span>
                  <span className="text-[15px] leading-[1.5] text-ink/85">{t(`rule.r${i}`, { threshold: YORDAMCHI.llmThreshold })}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-card border border-line bg-sand p-6">
            <h2 className="font-display text-lg font-bold text-navy">{t('limits.heading')}</h2>
            <dl className="mt-4 space-y-3">
              <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
                <dt className="text-sm text-ink/85">{t('limits.guest', { n: YORDAMCHI.guestDaily })}</dt>
                <dd className="font-display text-2xl font-bold tabular-nums text-navy">{YORDAMCHI.guestDaily}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-ink/85">{t('limits.user', { n: YORDAMCHI.userDaily })}</dt>
                <dd className="font-display text-2xl font-bold tabular-nums text-navy">{YORDAMCHI.userDaily}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-muted">{t('limits.note')}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={`/terminals${qs({ q })}`} className={BTN.primary}>{t('cta.primary')}</Link>
              <Link href="/login?next=/terminals" className={BTN.outline}>{t('cta.secondary')}</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
