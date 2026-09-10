import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CalculatorIcon, CalendarCheckIcon, ChatCircleTextIcon } from '@phosphor-icons/react/dist/ssr';
import { Link } from '@/i18n/navigation';
import { sapi, spost } from '@/lib/server-api';
import { pricePer, som, unitLabel, uzDayShort, uzTime, uzToday } from '@/lib/format';
import type { Page, QuoteResponse, Slot, Stats, TerminalCard } from '@/lib/types';
import { BTN, CtaBand } from '@/components/marketing/bits';
import { alt } from '@/lib/seo';
import { DashLink } from '@/components/site/DashLink';

export const revalidate = 300;
type Params = { params: Promise<{ locale: string }> };
// Misol yuki: bitta yarim vagon
const WEIGHT_T = 62;
const COLS = [
  { key: 'book', href: '/terminals', Icon: CalendarCheckIcon },
  { key: 'quote', href: '/quote', Icon: CalculatorIcon },
  { key: 'ask', href: '/equipment', Icon: ChatCircleTextIcon },
] as const;
// Holatlar zanjiri: LOADED va UNLOADED bitta qadam (operatsiyaga qarab)
const STEPS = ['ARRIVED', 'WEIGHED', 'HANDLED', 'DEPARTED'] as const;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'booking.meta' });
  return { ...{ title: t('title'), description: t('description') }, ...alt(locale, '/booking') };
}

/** Eng arzon faol terminal (tarifi bor): jonli misol va slot tasmasi uchun. */
async function pickTerminal() {
  const list = await sapi<Page<TerminalCard>>('/terminals?limit=50&sort=price', 300).catch(() => null);
  return list?.items.filter((x) => x.status === 'ACTIVE' && x.tariffs?.length).sort((a, b) => (a.fromPriceTiyin ?? Infinity) - (b.fromPriceTiyin ?? Infinity))[0] ?? null;
}

/** Bron sahifasi: uch ustun, real terminal tarifidan jonli hisob (POST /quote), bo'sh slot tasmasi, holatlar zanjiri, CTA. */
export default async function BookingPage({ params }: Params) {
  const { locale } = await params;
  setRequestLocale(locale);
  const today = uzToday();
  const to = new Date(Date.parse(today) + 14 * 864e5).toISOString().slice(0, 10);
  const [t, ts, stats, term] = await Promise.all([getTranslations('booking'), getTranslations('service'), sapi<Stats>('/stats', 60).catch(() => null), pickTerminal()]);
  const [quote, slots] = term ? await Promise.all([
    spost<QuoteResponse>('/quote', { terminalId: term.id, operation: 'LOAD', weightKg: WEIGHT_T * 1000, wagonCount: 1, services: ['WEIGH'] }).catch(() => null),
    sapi<Slot[]>(`/terminals/${term.id}/slots?from=${today}&to=${to}`, 60).catch(() => [] as Slot[]),
  ]) : [null, [] as Slot[]];
  const offer = quote?.offers.find((o) => o.terminal.id === term?.id) ?? null;
  // Slot tasmasi: bugun bo'lsa bugun, bo'lmasa eng yaqin ochiq kun
  const byDay = new Map<string, Slot[]>();
  for (const s of slots) byDay.set(s.localDate, [...(byDay.get(s.localDate) ?? []), s]);
  const day = byDay.has(today) ? today : [...byDay.keys()].sort().find((d) => byDay.get(d)!.some((s) => s.status === 'OPEN' && s.free > 0)) ?? null;
  const strip = day ? byDay.get(day)! : [];
  const facts = stats ? [t('facts.terminals', { count: stats.terminals }), t('facts.freeSlots', { count: stats.freeSlotsToday ?? 0 }), t('facts.sidings', { count: stats.sidings })] : [];
  const commission = t('example.commission', { pct: (offer?.commissionPct ?? 0) / 100 });

  return (
    <>
      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-teal-ink">{t('eyebrow')}</p>
          <h1 className="mt-3 font-display text-3xl font-bold leading-[1.08] text-navy md:text-5xl">{t('title')}</h1>
          <p className="mt-4 max-w-[58ch] text-lg text-muted">{t('lead')}</p>
          {facts.length ? <p className="mt-6 font-mono text-sm text-navy tabular-nums">{facts.join(' · ')}</p> : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/terminals?bookable=1" className={BTN.primary}>{t('cta.bookable')}</Link>
            <Link href="/signup" className={BTN.outline}>{t('cta.signup')}</Link>
          </div>
        </div>
      </section>

      {/* Uch ustun: bron, taklif, narx so'rash */}
      <section className="mx-auto max-w-6xl px-6 py-14 md:py-16">
        <ul className="grid gap-4 md:grid-cols-3">
          {COLS.map(({ key, href, Icon }) => (
            <li key={key} className="flex flex-col rounded-card border border-line bg-white p-5 transition duration-200 hover:border-teal/50">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-soft text-teal-ink"><Icon size={22} aria-hidden="true" /></span>
              <h2 className="mt-4 font-display text-lg font-bold text-navy">{t(`cols.${key}.title`)}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{t(`cols.${key}.body`)}</p>
              <Link href={href} className="mt-4 text-sm font-semibold text-teal-ink underline decoration-dotted hover:text-navy">{t(`cols.${key}.link`)} →</Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Jonli misol va slot tasmasi: real faol terminal, API hisobi */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 md:py-16 lg:grid-cols-[1.5fr_1fr]">
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-bold text-navy md:text-3xl">{t('example.heading')}</h2>
            {term && offer ? (
              <>
                <p className="mt-2 max-w-[62ch] text-muted">{t('example.lead', { terminal: term.name, weight: WEIGHT_T })}</p>
                <div className="mt-5 overflow-x-auto rounded-card border border-line">
                  <table className="w-full text-sm">
                    <thead className="bg-sand text-left font-mono text-xs text-muted">
                      <tr><th className="px-4 py-2 font-normal">{t('example.col.line')}</th><th className="px-4 py-2 font-normal">{t('example.col.formula')}</th><th className="px-4 py-2 text-right font-normal">{t('example.col.amount')}</th></tr>
                    </thead>
                    <tbody>
                      {offer.lines.map((l) => (
                        <tr key={l.serviceCode} className="border-t border-line/70">
                          <td className="px-4 py-2 font-semibold">{ts(l.serviceCode)}</td>
                          <td className="px-4 py-2 font-mono text-xs text-muted whitespace-nowrap">{l.qty} {unitLabel(l.unit)} × {pricePer(l.unitPriceTiyin, l.unit)}{l.minApplied ? ` (${t('example.min')})` : ''}</td>
                          <td className="px-4 py-2 text-right font-mono tabular-nums whitespace-nowrap">{som(l.amountTiyin)}</td>
                        </tr>
                      ))}
                      {offer.commissionPayer === 'CLIENT' && offer.commissionTiyin > 0 ? (
                        <tr className="border-t border-line/70"><td className="px-4 py-2" colSpan={2}>{commission}</td><td className="px-4 py-2 text-right font-mono tabular-nums whitespace-nowrap">{som(offer.commissionTiyin)}</td></tr>
                      ) : null}
                      <tr className="border-t-2 border-line bg-sand/60">
                        <td className="px-4 py-3 font-semibold" colSpan={2}>{t('example.total')}<span className="ml-2 font-mono text-xs font-normal text-muted">{commission}</span></td>
                        <td className="px-4 py-3 text-right font-display text-lg font-bold text-navy tabular-nums whitespace-nowrap">{som(offer.totalTiyin)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-muted">{t('example.note')}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href={`/quote?terminal=${term.id}`} className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-2">{t('cta.quote')}</Link>
                  <Link href={`/terminals/${term.slug}`} className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-navy transition hover:border-teal">{t('cta.terminal')}</Link>
                </div>
              </>
            ) : <p className="mt-2 max-w-[62ch] text-muted">{t('example.empty')}</p>}
          </div>

          {term ? (
            <aside className="rounded-card border border-line bg-sand p-5">
              <h2 className="text-sm font-bold text-navy">{t('slots.heading', { terminal: term.name })}</h2>
              {strip.length ? (
                <>
                  <p className="mt-1 font-mono text-xs text-muted">{day === today ? t('slots.today') : uzDayShort(strip[0]!.startsAt)}</p>
                  <ul className="mt-3 grid grid-cols-3 gap-2">
                    {strip.map((s) => {
                      const ok = s.status === 'OPEN' && s.free > 0;
                      return (
                        <li key={s.id} className={`rounded-xl px-2 py-2 text-center font-mono tabular-nums ${ok ? 'bg-teal-soft text-teal-ink' : 'bg-white text-muted'}`}>
                          <div className="text-[11px]">{uzTime(s.startsAt)}-{uzTime(s.endsAt)}</div>
                          <div className="mt-0.5 text-sm font-semibold">{t('slots.free', { count: ok ? s.free : 0 })}</div>
                        </li>
                      );
                    })}
                  </ul>
                  {day !== today ? <p className="mt-2 text-xs text-muted">{t('slots.notToday')}</p> : null}
                </>
              ) : <p className="mt-2 text-sm text-muted">{t('slots.none')}</p>}
              {/* Mehmon ro'yxatdan o'tish sahifasiga boradi (kabinet manzili ko'rsatilmaydi) */}
              <DashLink href={`/dashboard/orders/new?terminal=${term.slug}`} className="mt-4 inline-block text-sm font-semibold text-teal-ink underline">{t('slots.book')} →</DashLink>
            </aside>
          ) : null}
        </div>
      </section>

      {/* Holatlar zanjiri: gorizontal stepper, telefonda ustun */}
      <section className="mx-auto max-w-6xl px-6 py-14 md:py-16">
        <h2 className="font-display text-2xl font-bold text-navy md:text-3xl">{t('chain.heading')}</h2>
        <p className="mt-2 max-w-[62ch] text-muted">{t('chain.lead')}</p>
        <p className="mt-8"><span className="rounded-full bg-amber-soft px-3 py-1 font-mono text-xs font-semibold text-amber-ink">{t('chain.before')}</span></p>
        <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s} className="relative rounded-card border border-line bg-white p-5 lg:after:absolute lg:after:left-full lg:after:top-9 lg:after:h-px lg:after:w-3 lg:after:bg-line lg:last:after:hidden">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy font-mono text-sm font-semibold text-white">{i + 1}</span>
              <h3 className="mt-3 font-semibold text-ink">{t(`chain.steps.${s}.title`)}</h3>
              <p className="mt-1 text-sm text-muted">{t(`chain.steps.${s}.body`)}</p>
            </li>
          ))}
        </ol>
        <p className="mt-3"><span className="rounded-full bg-teal px-3 py-1 font-mono text-xs font-semibold text-white">{t('chain.after')}</span></p>
      </section>

      <CtaBand title={t('band.title')} body={t('band.body')} primary={{ href: '/terminals?bookable=1', label: t('cta.bookable') }} secondary={{ href: '/signup', label: t('cta.signup') }} />
    </>
  );
}
