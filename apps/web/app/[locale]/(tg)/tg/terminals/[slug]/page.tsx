import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SEARCH_LABELS, type SearchLang } from '@yuksaroy/domain';
import { sapi, sapiOrNull } from '@/lib/server-api';
import { hoursSummary, pricePer, som, stationName, uzTime, uzToday } from '@/lib/format';
import type { Slot, TerminalDetail } from '@/lib/types';
import { Link } from '@/i18n/navigation';
import { regionName } from '@/components/tg/labels';
import { TerminalCta } from '@/components/tg/TerminalCta';

// /tg/terminals/[slug]: ixcham tafsilot: nom, tur, viloyat, baho, tariflar ustuni, bugungi slotlar tasmasi, telefon (kirganlarga), bron va xarita tugmalari. MainButton = bron.
export const revalidate = 60;
type Params = { params: Promise<{ locale: string; slug: string }> };

export default async function TgTerminalPage({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const lang = locale as SearchLang;
  const [t, ts, tcl] = await Promise.all([getTranslations('tg.terminal'), getTranslations('service'), getTranslations('claim')]);
  const x = await sapiOrNull<TerminalDetail>(`/terminals/${slug}`, 60);
  if (!x) return <main className="mx-auto max-w-md px-4 py-10 text-center text-sm text-muted">{t('notFound')}</main>;
  const today = uzToday();
  const slots = x.rail !== null && !x.claimed ? [] : await sapi<Slot[]>(`/terminals/${x.id}/slots?from=${today}&to=${today}`, 60).catch(() => [] as Slot[]);
  const L = SEARCH_LABELS[lang];
  // Reestrdan kelgan, egasi tasdiqlanmagan temir yo'l terminali: tarif, slot va bron bo'lishi mumkin emas.
  // Ularni chizish "bo'sh terminal" taassurotini berardi, holbuki bu reestr yozuvi (veb sahifada ham shunday).
  const registryOnly = x.rail !== null && !x.claimed;

  return (
    <main className="mx-auto max-w-md px-4 pb-28 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-teal-soft px-3 py-1 text-xs font-semibold text-teal-ink">{L.kind[x.kind]}</span>
        {x.is24h ? <span className="rounded-full bg-teal px-3 py-1 font-mono text-xs font-semibold text-white">24/7</span> : null}
        <span className="font-mono text-xs text-muted">{x.ratingAvg != null ? `★ ${x.ratingAvg.toFixed(1)} (${x.ratingCount})` : t('noRating')}</span>
      </div>
      <h1 className="font-display mt-2 break-words text-xl font-bold">{x.name}</h1>
      <p className="mt-1 text-sm text-muted">{stationName(x)} · {regionName(x.regionCode, lang)}</p>
      {registryOnly ? <p className="mt-2 text-xs text-muted">{tcl('registryBadge')}</p>
        : !x.claimed ? <p className="mt-2 text-xs text-amber-ink">{t('unverified')}</p> : null}

      {registryOnly ? (
        <section className="mt-4 rounded-card border border-line bg-white p-4">
          <h2 className="text-sm font-bold">{tcl('passport')}</h2>
          <dl className="mt-2 text-sm">
            {([[tcl('registryNo'), x.rail?.registryNo], [tcl('length'), x.rail?.lengthM ? `${x.rail.lengthM} m` : null],
               [tcl('tracks'), x.rail?.trackCount], [tcl('capacity'), x.rail?.capacityWagons]] as [string, unknown][])
              .filter(([, v]) => v !== null && v !== undefined && v !== '')
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-1"><dt className="text-muted">{k}</dt><dd className="text-right font-mono tabular-nums">{String(v)}</dd></div>
              ))}
          </dl>
          {x.rail?.contactName ? <p className="mt-2 text-sm">{tcl('contactHeading')}: <span className="font-semibold">{x.rail.contactName}</span></p> : null}
          <Link href={`/terminals/${x.slug}`} className="mt-3 inline-block text-sm font-semibold text-teal-ink underline">{tcl('openFull')}</Link>
        </section>
      ) : (
      <section className="mt-4 rounded-card border border-line bg-white p-4">
        <h2 className="text-sm font-bold">{t('tariffs')}</h2>
        {x.tariffs.length === 0 ? <p className="mt-1 text-sm text-muted">{t('noTariffs')}</p> : (
          <ul className="mt-2 divide-y divide-line">
            {x.tariffs.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>{ts(r.serviceCode)}{r.cargoGroupCode ? <span className="ml-1 font-mono text-xs text-muted">{r.cargoGroupCode}</span> : null}</span>
                <span className="text-right font-mono tabular-nums"><span className="font-semibold text-navy">{pricePer(r.priceTiyin, r.unit, lang)}</span>{r.minTiyin ? <span className="block text-[11px] text-muted">min {som(r.minTiyin, lang)}</span> : null}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {registryOnly ? null : (
      <section className="mt-3 rounded-card border border-line bg-white p-4">
        <h2 className="text-sm font-bold">{t('slotsToday')}</h2>
        {slots.length === 0 ? <p className="mt-1 text-sm text-muted">{t('noSlots')}</p> : (
          <div className="tg-strip mt-2">
            {slots.map((s) => {
              const ok = s.status === 'OPEN' && s.free > 0;
              return (
                <div key={s.id} className={`min-w-[96px] rounded-xl px-2 py-2 text-center font-mono tabular-nums ${ok ? 'bg-teal-soft text-teal-ink' : 'bg-sand text-muted'}`}>
                  <div className="text-[11px]">{uzTime(s.startsAt)}-{uzTime(s.endsAt)}</div>
                  <div className="mt-0.5 text-sm font-semibold">{t('free', { count: ok ? s.free : 0 })}</div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      )}

      {registryOnly ? null : (
      <section className="mt-3 rounded-card border border-line bg-white p-4">
        <dl className="text-sm">
          <div className="flex justify-between gap-4 py-1"><dt className="text-muted">{t('hours')}</dt><dd className="text-right font-mono tabular-nums">{hoursSummary(x.hours, x.is24h, lang)}</dd></div>
          {x.address ? <div className="flex justify-between gap-4 py-1"><dt className="text-muted">·</dt><dd className="text-right">{x.address}</dd></div> : null}
        </dl>
      </section>
      )}

      {registryOnly ? null : <TerminalCta slug={x.slug} lat={x.lat} lng={x.lng} />}
    </main>
  );
}
