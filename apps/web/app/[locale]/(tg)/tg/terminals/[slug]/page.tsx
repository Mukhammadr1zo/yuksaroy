import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SEARCH_LABELS, type SearchLang } from '@yuksaroy/domain';
import { qs, sapi, sapiOrNull } from '@/lib/server-api';
import { hoursSummary, num, pricePer, som, stationName, uzTime, uzToday } from '@/lib/format';
import type { Page, Slot, TerminalCard, TerminalDetail } from '@/lib/types';
import { regionName } from '@/components/tg/labels';
import { Missing } from '@/components/tg/bits';
import { ClaimOnSite, RegistryCta, TerminalCta } from '@/components/tg/TerminalCta';
import { Impressions } from '@/components/catalog/Impressions';
import { RailPassportCard } from '@/components/catalog/RailPassport';

// /tg/terminals/[slug]: ixcham tafsilot: nom, tur, viloyat, baho, tariflar ustuni, bugungi slotlar tasmasi, telefon (kirganlarga), bron va xarita tugmalari. MainButton = bron.
// Reestr shahobchasi (egasi tasdiqlamagan): tarif va bron yo'q, shuning uchun sahifa tupik bo'lmasin: telefon, platformaga yozish, xarita, shu stansiyadagi boshqalar, pasport va da'vo.
export const revalidate = 60;
type Params = { params: Promise<{ locale: string; slug: string }> };

export default async function TgTerminalPage({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const lang = locale as SearchLang;
  const [t, ts, tcl, tr, tst] = await Promise.all([getTranslations('tg.terminal'), getTranslations('service'), getTranslations('claim'), getTranslations('terminal'), getTranslations('tg.state')]);
  const x = await sapiOrNull<TerminalDetail>(`/terminals/${slug}`, 60);
  if (!x) return <main id="main" className="mx-auto max-w-md px-4 py-10"><Missing text={t('notFound')} href="/tg/search" label={tst('search')} /></main>;
  const today = uzToday();
  const slots = x.rail !== null && !x.claimed ? [] : await sapi<Slot[]>(`/terminals/${x.id}/slots?from=${today}&to=${today}`, 60).catch(() => [] as Slot[]);
  const L = SEARCH_LABELS[lang];
  // Reestrdan kelgan, egasi tasdiqlanmagan temir yo'l terminali: tarif, slot va bron bo'lishi mumkin emas.
  // Ularni chizish "bo'sh terminal" taassurotini berardi, holbuki bu reestr yozuvi (veb sahifada ham shunday).
  const registryOnly = x.rail !== null && !x.claimed;
  // Reestr yozuvidagi farqlovchi raqamlar bir qatorda: odam sahifani ochmay terminal kerakmi-yo'qmi bilib olsin
  const rl = registryOnly ? x.rail : null;
  const facts = rl ? [
    rl.capacityWagons ? t('capacity', { count: rl.capacityWagons }) : null,
    rl.lengthM ? t('length', { count: num(rl.lengthM, lang) }) : null,
    rl.trackCount ? t('tracks', { count: rl.trackCount }) : null,
  ].filter(Boolean).join(' · ') : '';
  // Faqat noldan katta qismlar: 0 "noma'lum" degani, "yuklay olmaydi" emas (pasport kartasi ham nolni yashiradi)
  const loadUnload = rl ? [rl.loadCapacity ? t('loads', { count: rl.loadCapacity }) : null, rl.unloadCapacity ? t('unloads', { count: rl.unloadCapacity }) : null].filter(Boolean).join(' / ') || null : null;
  // Shu stansiyadagi boshqalar: stansiya + viloyat bo'yicha ro'yxat API si bilan bir xil so'rov (qidiruvdagi havola ham shu paramlar), o'zi va namunalar sanalmaydi
  // Ikkilamchi son: so'rov yiqilsa butun sahifa emas, faqat shu qator yashiriladi
  const near = rl && x.station ? await sapi<Page<TerminalCard>>(`/terminals${qs({ station: x.station.id, region: x.regionCode, limit: 1 })}`, 300).catch(() => null) : null;
  const moreN = near ? near.total - (near.summary?.demo ?? 0) - 1 : 0;
  const more = moreN > 0 && x.station ? { n: moreN, href: `/tg/search?cat=terminal${x.regionCode ? `&region=${x.regionCode}` : ''}&station=${x.station.id}` } : null;
  // Obyektning o'z nuqtasi bo'lmasa stansiyaniki (reestr shahobchalarining aksariyatida nuqta stansiyada turadi), veb sahifadagidek
  const point = x.lat != null && x.lng != null ? { lat: x.lat, lng: x.lng } : x.station?.lat != null && x.station?.lng != null ? { lat: x.station.lat, lng: x.station.lng } : null;

  return (
    <main id="main" className="mx-auto max-w-md px-4 pb-28 pt-4">
      {/* Botdagi ochilish ham sanalsin: veb terminal sahifasi bilan bir xil mayoq */}
      <Impressions kind="terminal" ids={[x.id]} surface="detail" />
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-teal-soft px-3 py-1 text-xs font-semibold text-teal-ink">{L.kind[x.kind]}</span>
        {/* Namuna saytdagi terminal sahifasidagidek belgilanadi (o'sha yorliq va izoh) */}
        {x.isDemo ? <span className="rounded-full border border-amber/40 bg-amber-soft px-3 py-1 text-xs font-semibold text-amber-ink">{tr('demoBadge')}</span> : null}
        {x.is24h ? <span className="rounded-full bg-teal px-3 py-1 font-mono text-xs font-semibold text-white">24/7</span> : null}
        {registryOnly ? null : <span className="font-mono text-xs text-muted">{x.ratingAvg != null ? `★ ${x.ratingAvg.toFixed(1)} (${x.ratingCount})` : t('noRating')}</span>}
      </div>
      <h1 className="font-display mt-2 break-words text-xl font-bold">{x.name}</h1>
      <p className="mt-1 text-sm text-muted">{stationName(x)} · {regionName(x.regionCode, lang)}</p>
      {registryOnly ? <p className="mt-2 text-xs text-muted">{tcl('registryBadge')}</p>
        : !x.claimed ? <p className="mt-2 text-xs text-amber-ink">{t('unverified')}</p> : null}
      {x.isDemo ? <p className="mt-2 rounded-xl border border-dashed border-line bg-sand px-3 py-2 text-xs text-muted">{tr('demoNote')}</p> : null}

      {registryOnly && rl ? (
        <>
          {facts ? <p className="mt-3 break-words font-mono text-sm font-semibold text-navy">{facts}</p> : null}
          {loadUnload ? <p className="mt-1 text-xs text-muted">{loadUnload}</p> : null}
          <RegistryCta id={x.id} slug={x.slug} name={x.name} point={point} hasPhone={x.hasPhone} isDemo={!!x.isDemo} more={more} />
          {/* mineRef yo'q: "raqam meniki" havolasi saytning /contact sahifasiga olib chiqardi, ilovadan chiqmaslik kerak */}
          <div className="mt-4"><RailPassportCard rail={rl} mineRef={null} /></div>
          {x.claimStatus !== 'PENDING' ? <ClaimOnSite slug={x.slug} /> : null}
        </>
      ) : (
      <section className="mt-4 rounded-card border border-line bg-white p-4">
        <h2 className="text-sm font-bold">{t('tariffs')}</h2>
        {x.tariffs.length === 0 ? <p className="mt-1 text-sm text-muted">{t('noTariffs')}</p> : (
          <ul className="mt-2 divide-y divide-line">
            {x.tariffs.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>{ts(r.serviceCode)}{r.cargoGroupCode ? <span className="ml-1 font-mono text-xs text-muted">{r.cargoGroupCode}</span> : null}</span>
                <span className="text-right font-mono tabular-nums"><span className="font-semibold text-navy">{pricePer(r.priceTiyin, r.unit, lang)}</span>{r.minTiyin ? <span className="block text-[11px] text-muted">{t('minSum', { sum: som(r.minTiyin, lang) })}</span> : null}</span>
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
          {x.address ? <div className="flex justify-between gap-4 py-1"><dt className="text-muted">{t('address')}</dt><dd className="text-right">{x.address}</dd></div> : null}
        </dl>
      </section>
      )}

      {registryOnly ? null : <TerminalCta id={x.id} slug={x.slug} lat={x.lat} lng={x.lng} hasPhone={x.hasPhone} isDemo={!!x.isDemo} />}
    </main>
  );
}
