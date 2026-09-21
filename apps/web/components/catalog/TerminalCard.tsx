import { Link } from '@/i18n/navigation';
import { REVIEW } from '@yuksaroy/domain';
import { getLocale, getTranslations } from 'next-intl/server';
import { hoursSummary, num, pricePer } from '@/lib/format';
import type { TerminalCard as T } from '@/lib/types';
import { CompareCheck } from '@/components/compare/CompareCheck';
import { CardPhoto } from '@/components/catalog/CardPhoto';

// Kartadagi tarif ustuni: shu tartibda, bor bo'lganlari
const STACK = ['LOAD', 'UNLOAD', 'STORAGE'] as const;

/** Katalog kartasi: ravoq rasm (96×72), nom, 24/7 chip, xizmatlar, tarif ustuni, bugungi bo'sh slot, masofa. */
export async function TerminalCard({ t }: { t: T }) {
  const locale = await getLocale();
  // Bitta ildiz tarjimon: card, kind, service, region, filter nomfazolari
  const c = await getTranslations();
  const shown = t.services.slice(0, 3);
  const stack = STACK.map((s) => t.tariffs?.find((x) => x.serviceCode === s)).filter((x) => x !== undefined);
  // Shahobchada tarif ham, ish vaqti ham yo'q: uning o'rniga reestr raqamlari qaror qildiradi
  const r = t.rail;
  const railFacts: [string, string][] = r === null || r === undefined ? [] : ([
    [c('claim.length'), r.lengthM ? `${num(r.lengthM, locale)} ${c('common.unit.meter')}` : ''],
    [c('claim.cardTracks'), r.trackCount ? String(r.trackCount) : ''],
    [c('claim.cardAtOnce'), r.capacityWagons ? `${r.capacityWagons} ${c('common.unit.wagonShort')}` : ''],
    [c('claim.cardLoadUnload'), r.loadCapacity || r.unloadCapacity ? `${r.unloadCapacity} / ${r.loadCapacity} ${c('common.unit.wagonShort')}` : ''],
  ] as [string, string][]).filter(([, v]) => v);
  const station = t.station?.nameUz ?? t.stationNameRaw;
  const owner = r?.ownerNameRaw ?? null;
  // Solishtirish belgisi Link tashqarisida (a ichida input bo'lmasin): karta pastida 36px joy, belgi o'ng burchakda
  return (
    <div className="relative min-w-0">
    <Link href={`/terminals/${t.slug}`} className="group flex h-full min-w-0 gap-4 rounded-card border border-line bg-white p-4 pb-10 text-ink transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative h-[72px] w-20 shrink-0 overflow-hidden rounded-t-[48px] rounded-b-md bg-navy sm:w-[96px]">
        <CardPhoto kind={t.kind} slug={t.slug} photo={t.photos[0]} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-bold group-hover:text-teal-ink">{t.name}</h3>
          {/* Namuna terminal ro'yxatda ham belgilanadi: kartani haqiqiy taklif deb o'ylamasin */}
          {t.isDemo ? <span className="shrink-0 rounded-full border border-amber/40 bg-amber-soft px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-ink">{c('terminal.demoBadge')}</span> : null}
          {t.is24h ? <span className="shrink-0 rounded-full bg-teal-soft px-2 py-0.5 font-mono text-[11px] font-semibold text-teal-ink">24/7</span> : null}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="truncate text-xs text-muted">{c(`kind.${t.kind}`)}{station ? ` · ${station}` : ''}{t.regionCode && c.has(`region.${t.regionCode}`) ? ` · ${c(`region.${t.regionCode}`)}` : ''}</p>
          {t.distanceKm != null ? <span className="shrink-0 font-mono text-xs text-muted tabular-nums">{c('card.distance', { km: Math.round(t.distanceKm) })}</span> : null}
        </div>

        {/* Reestr shahobchasi: ish vaqti, tarif, slot va baho yo'q. O'rniga pasport raqamlari va egasi. */}
        {railFacts.length ? (
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
            {railFacts.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="truncate text-[11px] text-muted">{k}</dt>
                <dd className="font-mono text-sm font-semibold tabular-nums text-navy">{v}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {!t.rail && !t.is24h ? <p className="mt-1 truncate text-xs text-muted">{hoursSummary(t.hours, t.is24h, locale)}</p> : null}
        {shown.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {shown.map((s) => <span key={s} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink/80">{c(`service.${s}`)}</span>)}
            {t.services.length > 3 ? <span className="rounded-full px-1 py-0.5 text-[11px] text-muted">+{t.services.length - 3}</span> : null}
          </div>
        ) : null}
        {stack.length ? (
          <ul className="mt-2 space-y-0.5 font-mono text-xs tabular-nums">
            {stack.map((x) => <li key={x.serviceCode} className="flex min-w-0 justify-between gap-3"><span className="truncate text-muted">{c(`service.${x.serviceCode}`)}</span><span className="shrink-0 font-semibold text-navy">{pricePer(x.priceTiyin, x.unit, locale)}</span></li>)}
          </ul>
        ) : null}
        {!t.rail && t.freeToday !== undefined ? (
          <p className={`mt-2 text-xs font-semibold ${t.freeToday > 0 ? 'text-teal-ink' : 'text-muted'}`}>{t.freeToday > 0 ? c('card.slots.freeToday', { count: t.freeToday }) : c('card.slots.none')}</p>
        ) : null}

        {t.rail ? (
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-line/70 pt-2">
            <span className="min-w-0 truncate text-xs text-muted">{t.orgName ?? (owner !== t.name ? owner : null) ?? c('claim.cardUnclaimed')}</span>
            {t.rail.contactName ? <span className="shrink-0 text-[11px] text-teal-ink">{c('claim.cardContact')}</span> : null}
          </div>
        ) : (
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-muted" aria-label={c('filter.sort.rating')}>{t.ratingAvg != null ? `★ ${t.ratingAvg.toFixed(1)} (${t.ratingCount})` : t.ratingCount ? c('reviews.hidden', { count: t.ratingCount, min: REVIEW.minToShow }) : c('card.rating.none')}</span>
            {/* Tarif ustuni bo'lsa "... dan" takror bo'lardi, shuning uchun faqat ustun bo'lmaganda */}
            {stack.length ? null : <span className="font-mono text-sm font-semibold text-navy tabular-nums">{t.fromPriceTiyin !== null ? c('card.price.from', { price: pricePer(t.fromPriceTiyin, 'PER_TON', locale) }) : c('card.price.onRequest')}</span>}
          </div>
        )}
        {!t.claimed && !t.rail ? <p className="mt-1 text-[11px] text-amber-ink">{c('card.unverifiedPassport')}</p> : null}
      </div>
    </Link>
    <CompareCheck cat="terminals" slug={t.slug} name={t.name} className="absolute bottom-3 right-3" />
    </div>
  );
}
