import { Link } from '@/i18n/navigation';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { REVIEW } from '@yuksaroy/domain';
import { sapi, sapiOrNull } from '@/lib/server-api';
import { DAYS, hoursSummary, isOpenNow, num, pricePer, som, uzTime, uzToday } from '@/lib/format';
import type { Page, Siding, Slot, TerminalDetail } from '@/lib/types';
import { TerminalReviews } from '@/components/reviews/TerminalReviews';
import { Impressions } from '@/components/catalog/Impressions';
import { Ld, alt, breadcrumbs, url } from '@/lib/seo';

export const revalidate = 300;

// JSON-LD uchun hafta kunlari (lib/format DAYS tartibida)
const SCHEMA_DAY: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

type Params = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Params) {
  const { locale, slug } = await params;
  const [t, tm, tk] = await Promise.all([sapiOrNull<TerminalDetail>(`/terminals/${slug}`), getTranslations({ locale, namespace: 'meta.terminal' }), getTranslations({ locale, namespace: 'kind' })]);
  return t
    ? { title: tm('title', { name: t.name }), description: tm('description', { kind: tk(t.kind), station: t.station.nameUz, hours: hoursSummary(t.hours, t.is24h) }), ...alt(locale, `/terminals/${slug}`) }
    : { title: tm('notFound') };
}

export default async function TerminalPage({ params }: Params) {
  const { locale, slug } = await params;
  const t = await sapiOrNull<TerminalDetail>(`/terminals/${slug}`);
  if (!t) notFound();
  const today = uzToday();
  // tr: terminal nomfazosi; tn nav, tc common, tk kind, ts service, trj rju, td hafta kunlari
  const [sidings, slots, tr, tn, tc, tk, ts, trj, td] = await Promise.all([
    sapi<Page<Siding>>(`/sidings?station=${t.station.id}&limit=1`, 300).catch(() => null),
    sapi<Slot[]>(`/terminals/${t.id}/slots?from=${today}&to=${today}`, 60).catch(() => [] as Slot[]),
    getTranslations('terminal'), getTranslations('nav'), getTranslations('common'), getTranslations('kind'), getTranslations('service'), getTranslations('rju'), getTranslations('format.day'),
  ]);
  const trv = await getTranslations('reviews');
  const open = isOpenNow(t.hours, t.is24h);
  const p = t.passport ?? {};
  const yes = tc('yes');
  const no = tc('no');
  const ton = tc('unit.ton');
  const facts: [string, string][] = [
    [tr('passport.tracks'), p.tracks ? (p.tracksLengthM ? tr('passport.tracksValue', { count: p.tracks, length: num(p.tracksLengthM) }) : `${p.tracks} ${tc('count.pieces')}`) : no],
    [tr('passport.cranes'), p.cranes?.length ? p.cranes.map((c) => `${c.type} ${c.capacityT} ${ton}`).join(', ') : no],
    [tr('passport.warehouse'), p.warehouseM2 ? `${num(p.warehouseM2)} m²` : no],
    [tr('passport.openArea'), p.openAreaM2 ? `${num(p.openAreaM2)} m²` : no],
    [tr('passport.scale'), p.hasScale ? (p.scaleT ? `${p.scaleT} ${ton}` : yes) : no],
    [tr('passport.svx'), p.hasSvx ? yes : no],
    ...(p.containerSlots ? [[tr('passport.containerSlots'), num(p.containerSlots)] as [string, string]] : []),
    ...(p.customsPost ? [[tr('passport.customsPost'), yes] as [string, string]] : []),
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Impressions kind="terminal" ids={[t.id]} surface="detail" />
      {/* JSON-LD: faqat haqiqiy maydonlar (koordinata, manzil, telefon, ish vaqti, reyting bo'lsa) */}
      <Ld data={{
        '@context': 'https://schema.org', '@type': 'LocalBusiness', name: t.name, url: url(locale, `/terminals/${t.slug}`),
        address: { '@type': 'PostalAddress', streetAddress: t.address ?? undefined, addressRegion: t.regionCode ?? undefined, addressCountry: 'UZ' },
        geo: t.lat != null && t.lng != null ? { '@type': 'GeoCoordinates', latitude: t.lat, longitude: t.lng } : undefined,
        telephone: t.phone ?? undefined,
        openingHoursSpecification: t.is24h
          ? [{ '@type': 'OpeningHoursSpecification', dayOfWeek: DAYS.map((d) => SCHEMA_DAY[d]), opens: '00:00', closes: '23:59' }]
          : DAYS.flatMap((d) => (t.hours?.[d] ?? []).map(([opens, closes]) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: SCHEMA_DAY[d], opens, closes }))),
        aggregateRating: t.ratingAvg != null ? { '@type': 'AggregateRating', ratingValue: t.ratingAvg, reviewCount: t.ratingCount } : undefined,
      }} />
      <Ld data={breadcrumbs(locale, [{ name: tn('terminals'), path: '/terminals' }, { name: t.name, path: `/terminals/${t.slug}` }])} />
      <nav aria-label={tr('breadcrumb.aria')} className="font-mono text-xs text-muted"><Link href="/terminals" className="hover:text-navy">{tn('terminals')}</Link> / {t.station.nameUz}</nav>
      <header className="mt-3 flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-teal-soft px-3 py-1 text-xs font-semibold text-teal-ink">{tk(t.kind)}</span>
            <span className={`rounded-full px-3 py-1 font-mono text-xs font-semibold ${open ? 'bg-teal text-white' : 'bg-line text-ink/70'}`}>{tr(open ? 'status.openNow' : 'status.closedNow')} · {hoursSummary(t.hours, t.is24h)}</span>
            {!t.claimed ? <span className="rounded-full bg-amber-soft px-3 py-1 text-xs font-semibold text-amber">{tr('badge.unverifiedPassport')}</span> : null}
            <a href="#reviews" className={`rounded-full border border-line bg-white px-3 py-1 font-mono text-xs font-semibold tabular-nums ${t.ratingAvg != null ? 'text-navy' : 'text-muted'}`}>{t.ratingAvg != null ? `★ ${t.ratingAvg.toFixed(1)} (${t.ratingCount})` : t.ratingCount ? trv('hidden', { count: t.ratingCount, min: REVIEW.minToShow }) : trv('none')}</a>
          </div>
          <h1 className="font-display mt-3 text-3xl font-bold md:text-4xl">{t.name}</h1>
          <p className="mt-2 text-muted">{t.station.nameUz} {tr('station.suffix')} {t.station.esrCode ? <span className="font-mono">({t.station.esrCode})</span> : null} · {trj(t.station.rju)} {tr('rju.suffix')}{t.address ? ` · ${t.address}` : ''}</p>
          {t.description ? <p className="mt-4 text-ink/85">{t.description}</p> : null}
        </div>
        <div className="flex flex-col gap-2">
          <Link href={`/quote?terminal=${t.id}`} className="rounded-full bg-teal px-6 py-3 text-center font-semibold text-white hover:bg-teal-ink">{tr('cta.quote')}</Link>
          <Link href={`/dashboard/orders/new?terminal=${t.slug}`} className="rounded-full border border-navy px-6 py-3 text-center font-semibold text-navy hover:bg-white">{tr('cta.bookSlot')}</Link>
          {t.phone ? <a href={`tel:${t.phone}`} className="text-center font-mono text-sm text-muted">{t.phone}</a> : null}
        </div>
      </header>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-bold">{tr('tariffs.heading')}</h2>
            {t.tariffs.length === 0 ? <p className="mt-2 text-sm text-muted">{tr('tariffs.empty')}</p> : (
              <div className="mt-3 overflow-x-auto rounded-card border border-line bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-sand text-left font-mono text-xs text-muted"><tr><th className="px-4 py-2">{tr('tariffs.col.service')}</th><th className="px-4 py-2">{tr('tariffs.col.cargoGroup')}</th><th className="px-4 py-2 text-right">{tc('price')}</th><th className="px-4 py-2 text-right">{tr('tariffs.col.min')}</th></tr></thead>
                  <tbody>
                    {t.tariffs.map((x) => (
                      <tr key={x.id} className="border-t border-line/70">
                        <td className="px-4 py-2 font-semibold">{ts(x.serviceCode)}</td>
                        <td className="px-4 py-2 font-mono text-xs text-muted">{x.cargoGroupCode ?? tr('tariffs.allCargo')}</td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums">{pricePer(x.priceTiyin, x.unit)}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-muted tabular-nums">{x.minTiyin ? som(x.minTiyin) : no}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {t.tariffs[0]?.note ? <p className="border-t border-line/70 px-4 py-2 text-xs text-muted">{t.tariffs[0].note}</p> : null}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-bold">{tr('services.heading')}</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {t.serviceDetails.map((s) => (
                <li key={s.serviceCode} className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-2 text-sm">
                  <span>{ts(s.serviceCode)}</span>
                  <span className="font-mono text-xs text-muted">{s.leadTimeMin ? tr('services.leadTime', { minutes: s.leadTimeMin }) : tr('services.immediate')}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold">{tr('passport.heading')}</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              {facts.map(([k, v]) => (
                <div key={k} className="rounded-xl border border-line bg-white px-4 py-3"><dt className="text-xs text-muted">{k}</dt><dd className="mt-0.5 font-semibold">{v}</dd></div>
              ))}
            </dl>
          </section>

          <div id="reviews" className="scroll-mt-24"><TerminalReviews slug={t.slug} /></div>
        </div>

        <aside className="space-y-6">
          <section className="rounded-card border border-line bg-white p-5">
            <h2 className="text-sm font-bold">{tr('slots.heading')}</h2>
            {slots.length === 0 ? <p className="mt-2 text-sm text-muted">{tr('slots.none')}</p> : (
              <ul className="mt-3 grid grid-cols-3 gap-2">
                {slots.map((s) => {
                  const ok = s.status === 'OPEN' && s.free > 0;
                  return (
                    <li key={s.id} className={`rounded-xl px-2 py-2 text-center font-mono tabular-nums ${ok ? 'bg-teal-soft text-teal-ink' : 'bg-sand text-muted'}`}>
                      <div className="text-[11px]">{uzTime(s.startsAt)}-{uzTime(s.endsAt)}</div>
                      <div className="mt-0.5 text-sm font-semibold">{tr('slots.free', { count: ok ? s.free : 0 })}</div>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link href={`/dashboard/orders/new?terminal=${t.slug}`} className="mt-3 inline-block text-sm font-semibold text-teal-ink underline">{tr('slots.book')} →</Link>
          </section>
          <section className="rounded-card border border-line bg-white p-5">
            <h2 className="text-sm font-bold">{tr('hours.heading')}</h2>
            {t.is24h ? <p className="mt-2 font-display text-2xl font-bold text-teal-ink">24/7</p> : (
              <table className="mt-2 w-full text-sm">
                <tbody>
                  {DAYS.map((d) => {
                    const w = t.hours?.[d] ?? [];
                    return <tr key={d} className="border-t border-line/60"><td className="py-1 font-mono text-xs text-muted">{td(d)}</td><td className="py-1 text-right font-mono tabular-nums">{w.length ? w.map(([a, b]) => `${a}-${b}`).join(', ') : tr('hours.dayOffShort')}</td></tr>;
                  })}
                </tbody>
              </table>
            )}
          </section>
          <section className="rounded-card border border-line bg-white p-5">
            <h2 className="text-sm font-bold">{tc('station')}</h2>
            <p className="mt-2 font-semibold">{t.station.nameUz} <span className="font-normal text-muted">{t.station.nameRu}</span></p>
            <dl className="mt-2 space-y-1 font-mono text-xs text-muted">
              <div className="flex justify-between"><dt>{tr('stationCard.esr')}</dt><dd>{t.station.esrCode ?? '·'}</dd></div>
              <div className="flex justify-between"><dt>{tr('stationCard.rju')}</dt><dd>{trj(t.station.rju)}</dd></div>
              <div className="flex justify-between"><dt>{tr('stationCard.typeClass')}</dt><dd>{t.station.stationType ?? '·'} / {t.station.classRank ?? '·'}</dd></div>
              {t.lat && t.lng ? <div className="flex justify-between"><dt>{tr('stationCard.coords')}</dt><dd><a className="underline" href={`https://www.openstreetmap.org/?mlat=${t.lat}&mlon=${t.lng}#map=15/${t.lat}/${t.lng}`} target="_blank" rel="noreferrer">{t.lat}, {t.lng}</a></dd></div> : null}
            </dl>
            {sidings ? <Link href={`/sidings?station=${t.station.id}`} className="mt-3 inline-block text-sm font-semibold text-teal-ink underline">{tr('sidingsLink', { count: sidings.total })}</Link> : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
