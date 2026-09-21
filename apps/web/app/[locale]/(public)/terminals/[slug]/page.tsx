import { Link } from '@/i18n/navigation';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { REVIEW } from '@yuksaroy/domain';
import { sapi, sapiOrNull } from '@/lib/server-api';
import { DAYS, hoursSummary, isOpenNow, num, pricePer, som, uzTime, uzToday } from '@/lib/format';
import type { Slot, TerminalDetail } from '@/lib/types';
import { TerminalReviews } from '@/components/reviews/TerminalReviews';
import { Impressions } from '@/components/catalog/Impressions';
import { Ld, alt, breadcrumbs, url } from '@/lib/seo';
import { DashLink } from '@/components/site/DashLink';
import { PhoneReveal } from '@/components/catalog/PhoneReveal';
import { ChatLauncher } from '@/components/chat/ChatPanel';
import { MiniMap } from '@/components/catalog/MiniMap';
import { PIN } from '@/components/map/mapStyle';
import { CardPhoto } from '@/components/catalog/CardPhoto';
import { ClaimSiding } from '@/components/catalog/ClaimSiding';
import { RailPassportCard } from '@/components/catalog/RailPassport';

export const revalidate = 300;

// JSON-LD uchun hafta kunlari (lib/format DAYS tartibida)
const SCHEMA_DAY: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

type Params = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Params) {
  const { locale, slug } = await params;
  const [t, tm, tk] = await Promise.all([sapiOrNull<TerminalDetail>(`/terminals/${slug}`), getTranslations({ locale, namespace: 'meta.terminal' }), getTranslations({ locale, namespace: 'kind' })]);
  return t
    ? { title: tm('title', { name: t.name }), description: tm('description', { kind: tk(t.kind), station: t.station?.nameUz ?? t.stationNameRaw ?? '', hours: hoursSummary(t.hours, t.is24h, locale) }), ...alt(locale, `/terminals/${slug}`) }
    : { title: tm('notFound') };
}

export default async function TerminalPage({ params }: Params) {
  const { locale, slug } = await params;
  const t = await sapiOrNull<TerminalDetail>(`/terminals/${slug}`);
  if (!t) notFound();
  const today = uzToday();
  // tr: terminal nomfazosi; tn nav, tc common, tk kind, ts service, trj rju, td hafta kunlari
  const [slots, c, tr, tn, tc, tk, ts, trj, td] = await Promise.all([
    sapi<Slot[]>(`/terminals/${t.id}/slots?from=${today}&to=${today}`, 60).catch(() => [] as Slot[]),
    cookies(),
    getTranslations('terminal'), getTranslations('nav'), getTranslations('common'), getTranslations('kind'), getTranslations('service'), getTranslations('rju'), getTranslations('format.day'),
  ]);
  const [trv, tcl] = await Promise.all([getTranslations('reviews'), getTranslations('claim')]);
  const station = t.station?.nameUz ?? t.stationNameRaw ?? '';
  // Obyektning o'z nuqtasi bo'lmasa stansiyaniki olinadi: reestrdan kelgan
  // shahobchalarning aksariyatida koordinata aynan stansiyada turadi.
  const mapPoint = t.lat != null && t.lng != null ? { lat: t.lat, lng: t.lng }
    : t.station?.lat != null && t.station?.lng != null ? { lat: t.station.lat, lng: t.station.lng }
    : null;
  // Reestrdan kelgan, hali egasi tasdiqlanmagan shahobcha: tarif, slot va baho yo'q, bo'lishi ham mumkin emas.
  // Ularni chizish "to'ldirilmagan terminal" taassurotini berardi, holbuki bu reestr yozuvi.
  const registryOnly = t.rail !== null && !t.claimed;
  const claimable = registryOnly && t.claimStatus !== 'PENDING';
  const authed = c.has('ys_access') || c.has('ys_refresh');
  const open = isOpenNow(t.hours, t.is24h);
  const p = t.passport ?? {};
  const yes = tc('yes');
  const no = tc('no');
  const ton = tc('unit.ton');
  const facts: [string, string][] = [
    [tr('passport.tracks'), p.tracks ? (p.tracksLengthM ? tr('passport.tracksValue', { count: p.tracks, length: num(p.tracksLengthM, locale) }) : `${p.tracks} ${tc('count.pieces')}`) : no],
    [tr('passport.cranes'), p.cranes?.length ? p.cranes.map((c) => `${c.type} ${c.capacityT} ${ton}`).join(', ') : no],
    [tr('passport.warehouse'), p.warehouseM2 ? `${num(p.warehouseM2, locale)} ${tc('unit.meter')}²` : no],
    [tr('passport.openArea'), p.openAreaM2 ? `${num(p.openAreaM2, locale)} ${tc('unit.meter')}²` : no],
    [tr('passport.scale'), p.hasScale ? (p.scaleT ? `${p.scaleT} ${ton}` : yes) : no],
    [tr('passport.svx'), p.hasSvx ? yes : no],
    ...(p.containerSlots ? [[tr('passport.containerSlots'), num(p.containerSlots, locale)] as [string, string]] : []),
    ...(p.customsPost ? [[tr('passport.customsPost'), yes] as [string, string]] : []),
  ];
  // To'ldirilmagan pasport oltita "yo'q" plitkasi bo'lib chiqardi: bo'sh qatorlar ko'rsatilmaydi
  const rows = facts.filter(([, v]) => v !== no);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Impressions kind="terminal" ids={[t.id]} surface="detail" />
      {/* JSON-LD: faqat haqiqiy maydonlar (koordinata, manzil, telefon, ish vaqti, reyting bo'lsa) */}
      <Ld data={{
        '@context': 'https://schema.org', '@type': 'LocalBusiness', name: t.name, url: url(locale, `/terminals/${t.slug}`),
        address: { '@type': 'PostalAddress', streetAddress: t.address ?? undefined, addressRegion: t.regionCode ?? undefined, addressCountry: 'UZ' },
        geo: t.lat != null && t.lng != null ? { '@type': 'GeoCoordinates', latitude: t.lat, longitude: t.lng } : undefined,
        openingHoursSpecification: t.is24h
          ? [{ '@type': 'OpeningHoursSpecification', dayOfWeek: DAYS.map((d) => SCHEMA_DAY[d]), opens: '00:00', closes: '23:59' }]
          : DAYS.flatMap((d) => (t.hours?.[d] ?? []).map(([opens, closes]) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: SCHEMA_DAY[d], opens, closes }))),
        aggregateRating: t.ratingAvg != null ? { '@type': 'AggregateRating', ratingValue: t.ratingAvg, reviewCount: t.ratingCount } : undefined,
      }} />
      <Ld data={breadcrumbs(locale, [{ name: tn('terminals'), path: '/terminals' }, { name: t.name, path: `/terminals/${t.slug}` }])} />
      <nav aria-label={tr('breadcrumb.aria')} className="font-mono text-xs text-muted"><Link href="/terminals" className="hover:text-navy">{tn('terminals')}</Link>{station ? ` / ${station}` : ''}</nav>
      <header className="mt-3 flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-2xl break-words">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-teal-soft px-3 py-1 text-xs font-semibold text-teal-ink">{tk(t.kind)}</span>
            {registryOnly ? null : <span className={`rounded-full px-3 py-1 font-mono text-xs font-semibold ${open ? 'bg-teal text-white' : 'bg-line text-ink/70'}`}>{tr(open ? 'status.openNow' : 'status.closedNow')} · {hoursSummary(t.hours, t.is24h, locale)}</span>}
            {registryOnly ? <span className="rounded-full bg-sand px-3 py-1 text-xs font-semibold text-muted">{t.claimStatus === 'PENDING' ? tcl('pendingBadge') : tcl('registryBadge')}</span>
              : !t.claimed ? <span className="rounded-full bg-amber-soft px-3 py-1 text-xs font-semibold text-amber">{tr('badge.unverifiedPassport')}</span> : null}
            {registryOnly ? null : <a href="#reviews" className={`rounded-full border border-line bg-white px-3 py-1 font-mono text-xs font-semibold tabular-nums ${t.ratingAvg != null ? 'text-navy' : 'text-muted'}`}>{t.ratingAvg != null ? `★ ${t.ratingAvg.toFixed(1)} (${t.ratingCount})` : t.ratingCount ? trv('hidden', { count: t.ratingCount, min: REVIEW.minToShow }) : trv('none')}</a>}
          </div>
          <h1 className="font-display mt-3 text-3xl font-bold md:text-4xl">{t.name}</h1>
          <p className="mt-2 text-muted">{station ? <>{station} {tr('station.suffix')} </> : null}{t.station?.esrCode ?? t.rail?.esrCode ? <span className="font-mono">({t.station?.esrCode ?? t.rail?.esrCode})</span> : null}{t.station?.rju ?? t.rail?.rju ? <> · {trj((t.station?.rju ?? t.rail?.rju)!)} {tr('rju.suffix')}</> : null}{t.address ? ` · ${t.address}` : ''}</p>
          {t.description ? <p className="mt-4 text-ink/85">{t.description}</p> : null}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-64">
          <div className="aspect-[16/10] overflow-hidden rounded-card border border-line bg-navy">
            <CardPhoto kind={t.kind} slug={t.slug} photo={t.photos[0]} alt={t.name} />
          </div>
          {registryOnly ? null : (
            <>
              <Link href={`/quote?terminal=${t.id}`} className="rounded-full bg-teal px-6 py-3 text-center font-semibold text-white hover:bg-teal-ink">{tr('cta.quote')}</Link>
              <DashLink href={`/dashboard/orders/new?terminal=${t.slug}`} className="rounded-full border border-navy px-6 py-3 text-center font-semibold text-navy hover:bg-white">{tr('cta.bookSlot')}</DashLink>
            </>
          )}
          {/* Raqam obunachiga, bosilganda: sahifa keshlangan, raqam brauzerdan olinadi (PhoneReveal) */}
          {t.hasPhone ? <span className="text-center"><PhoneReveal kind="terminal" targetId={t.slug} next={`/terminals/${t.slug}`} /></span> : null}
          {/* Yozishma ham kerak: hujjat yuboriladi va kelishuv izi qoladi.
              Egasi tasdiqlanmagan obyektda javobni platforma beradi. */}
          <ChatLauncher target={{ kind: 'terminal', slug: t.slug, title: t.name, ownerless: registryOnly }} next={`/terminals/${t.slug}`} />
        </div>
      </header>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-8">
          {t.rail ? <RailPassportCard rail={t.rail} /> : null}
          <section hidden={registryOnly}>
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
                        <td className="px-4 py-2 text-right font-mono tabular-nums">{pricePer(x.priceTiyin, x.unit, locale)}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-muted tabular-nums">{x.minTiyin ? som(x.minTiyin, locale) : no}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {t.tariffs[0]?.note ? <p className="border-t border-line/70 px-4 py-2 text-xs text-muted">{t.tariffs[0].note}</p> : null}
              </div>
            )}
          </section>

          <section hidden={registryOnly || t.serviceDetails.length === 0}>
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

          <section hidden={rows.length === 0}>
            <h2 className="text-lg font-bold">{tr('passport.heading')}</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              {rows.map(([k, v]) => (
                <div key={k} className="rounded-xl border border-line bg-white px-4 py-3"><dt className="text-xs text-muted">{k}</dt><dd className="mt-0.5 font-semibold">{v}</dd></div>
              ))}
            </dl>
          </section>

          {registryOnly ? null : <div id="reviews" className="scroll-mt-24"><TerminalReviews slug={t.slug} /></div>}
        </div>

        <aside className="space-y-6">
          {claimable ? (
            <section className="rounded-card border border-line bg-white p-5">
              <h2 className="font-bold">{tcl('cta')}</h2>
              <div className="mt-3">
                {authed ? <ClaimSiding sidingId={t.id} /> : <Link href={`/login?next=/terminals/${t.slug}`} className="block rounded-full bg-navy px-6 py-3 text-center font-semibold text-white transition hover:bg-navy-2 active:scale-[0.98]">{tcl('ctaLogin')}</Link>}
              </div>
              <p className="mt-4 border-t border-line/70 pt-3 text-xs text-muted"><b className="text-ink">{tcl('how')}.</b> {tcl('howBody')}</p>
            </section>
          ) : null}
          <section hidden={registryOnly} className="rounded-card border border-line bg-white p-5">
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
            <DashLink href={`/dashboard/orders/new?terminal=${t.slug}`} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-teal px-5 py-2.5 text-sm font-semibold text-white transition duration-150 hover:bg-teal-ink active:scale-[0.98]">{tr('slots.book')}</DashLink>
          </section>
          <section hidden={registryOnly} className="rounded-card border border-line bg-white p-5">
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
          {/* Reestrdan kelgan shahobchada stansiya bog'lanmagan bo'lishi mumkin: shunda xom nom bilan chiqadi */}
          {station ? (
            <section className="rounded-card border border-line bg-white p-5">
              <h2 className="text-sm font-bold">{tc('station')}</h2>
              <p className="mt-2 font-semibold">{station} {t.station?.nameRu ? <span className="font-normal text-muted">{t.station.nameRu}</span> : null}</p>
              <dl className="mt-2 space-y-1 font-mono text-xs text-muted">
                <div className="flex justify-between"><dt>{tr('stationCard.esr')}</dt><dd>{t.station?.esrCode ?? t.rail?.esrCode ?? '·'}</dd></div>
                <div className="flex justify-between"><dt>{tr('stationCard.rju')}</dt><dd>{t.station?.rju ?? t.rail?.rju ? trj((t.station?.rju ?? t.rail?.rju)!) : '·'}</dd></div>
              </dl>
              {/* Koordinata raqami va stansiya turi o'rniga xarita: raqam odamga hech narsa
                  aytmaydi, joyini esa bir qarashda ko'rsatadi. Xarita qimirlamaydi,
                  chunki bu joyni bildirish uchun, kezish uchun emas. */}
              {mapPoint ? (
                <div className="mt-3">
                  <MiniMap pins={[{ lat: mapPoint.lat, lng: mapPoint.lng, color: PIN.siding }]} zoom={12} className="h-36 w-full" />
                </div>
              ) : null}
              {/* station parametri ESR yoki stansiya id ni qabul qiladi: ESR bo'lmasa id bilan ketamiz,
                  aks holda bo'sh qiymat filtr hisoblanmay, hamma temir yo'l terminali chiqib ketardi */}
              {t.station ? <Link href={`/terminals?station=${t.station.esrCode ?? t.station.id}&kind=RAIL`} className="mt-3 inline-block text-sm font-semibold text-teal-ink underline">{tcl('sameStation')}</Link> : null}
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
