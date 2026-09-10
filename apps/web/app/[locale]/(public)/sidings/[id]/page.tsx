import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { SearchLang } from '@yuksaroy/domain';
import { sapi, sapiOrNull } from '@/lib/server-api';
import { num, rjuLabel } from '@/lib/format';
import type { ListingPage, SidingDetail } from '@/lib/types-listing';
import { ListingCard, regionName } from '@/components/catalog/ListingCard';
import { ClaimSiding } from '@/components/catalog/ClaimSiding';
import { MiniMap } from '@/components/catalog/MiniMap';
import { alt } from '@/lib/seo';

type Params = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Params) {
  const { locale, id } = await params;
  const [s, t] = await Promise.all([sapiOrNull<SidingDetail>(`/sidings/${id}`, 300), getTranslations({ locale, namespace: 'claim' })]);
  return s ? { title: `${t('title', { no: s.registryNo })} · ${s.station?.nameUz ?? s.stationNameRaw} · YukSaroy`, ...alt(locale, `/sidings/${id}`) } : { title: 'YukSaroy' };
}

/** Shahobcha yo'l sahifasi: reestr ma'lumoti, da'vo holati, egasi (APPROVED), shu yo'ldagi e'lonlar, xarita (koordinata taxminiy). */
export default async function SidingPage({ params }: Params) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const lang = locale as SearchLang;
  const s = await sapiOrNull<SidingDetail>(`/sidings/${id}`, 300);
  if (!s) notFound();
  const [t, ts, c] = await Promise.all([getTranslations('claim'), getTranslations('claimStatus'), cookies()]);
  const authed = c.has('ys_access') || c.has('ys_refresh');
  // ponytail: ochiq API'da sidingId filtri yo'q, viloyat bo'yicha 50 ta olib obyekt bo'yicha saralanadi; filtr qo'shilsa shu qator almashadi
  const listings = s.regionCode ? await sapi<ListingPage>(`/listings?region=${s.regionCode}&limit=50`, 60).then((d) => d.items.filter((l) => l.object?.type === 'siding' && l.object.id === s.id)).catch(() => []) : [];
  const station = s.station?.nameUz ?? s.stationNameRaw;
  const claimable = s.claimStatus === 'NONE' || s.claimStatus === 'REJECTED';
  const tone = s.claimStatus === 'APPROVED' ? 'bg-teal-soft text-teal-ink' : s.claimStatus === 'PENDING' ? 'bg-amber-soft text-amber-ink' : 'bg-sand text-muted';
  const facts: [string, React.ReactNode][] = [
    [t('registryNo'), s.registryNo],
    [t('station'), <>{station}{s.esrCode ? <span className="ml-1 text-muted">({s.esrCode})</span> : null}{s.rju ? <span className="ml-1 text-muted">· {rjuLabel(s.rju)}</span> : null}</>],
    [t('region'), regionName(s.regionCode, lang) || '·'],
    [t('length'), s.lengthM ? `${num(s.lengthM, lang)} m` : '·'],
    [t('unload'), t('wagons', { count: s.unloadCapacity })],
    [t('load'), t('wagons', { count: s.loadCapacity })],
    [t('status'), ts(s.claimStatus)],
    [t('owner'), s.owner ?? <span className="font-body font-normal text-muted">{t('ownerHidden')}</span>],
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <nav aria-label="Yo'l" className="font-mono text-xs text-muted"><Link href="/sidings" className="hover:text-navy">{t('breadcrumb')}</Link> / {station}</nav>
      <header className="mt-3 max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{ts(s.claimStatus)}</span>
          {s.regionCode ? <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-ink/80">{regionName(s.regionCode, lang)}</span> : null}
        </div>
        <h1 className="font-display mt-3 text-3xl font-bold text-navy md:text-4xl">{t('title', { no: s.registryNo })}</h1>
        <p className="mt-2 text-muted">{station}{s.owner ? ` · ${s.owner}` : ''}</p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-8">
          <dl className="overflow-hidden rounded-card border border-line bg-white">
            {facts.map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-4 border-t border-line/70 px-4 py-2.5 text-sm first:border-t-0">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-mono font-semibold text-navy tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <section>
            <h2 className="text-lg font-bold">{t('listings')}</h2>
            {listings.length ? <div className="mt-3 grid gap-4 md:grid-cols-2">{listings.map((l) => <ListingCard key={l.id} l={l} />)}</div> : <p className="mt-2 text-sm text-muted">{t('noListings')}</p>}
          </section>
        </div>

        <aside className="space-y-6">
          {claimable ? (
            <section className="rounded-card border border-line bg-white p-5">
              <h2 className="font-bold">{t('cta')}</h2>
              <div className="mt-3">
                {authed ? <ClaimSiding sidingId={s.id} /> : <Link href={`/login?next=/sidings/${s.id}`} className="block rounded-full bg-navy px-6 py-3 text-center font-semibold text-white transition hover:bg-navy-2 active:scale-[0.98]">{t('ctaLogin')}</Link>}
              </div>
              <p className="mt-4 border-t border-line/70 pt-3 text-xs text-muted"><b className="text-ink">{t('how')}.</b> {t('howBody')}</p>
            </section>
          ) : null}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('map')}</h2>
            {s.lat != null && s.lng != null ? <div className="mt-2"><MiniMap pins={[{ lat: s.lat, lng: s.lng, color: '#077F84' }]} zoom={12} /></div> : <p className="mt-2 text-sm text-muted">{t('noCoord')}</p>}
            <p className="mt-1 text-[11px] text-muted">{t('coordNote')} © OpenStreetMap, © CARTO</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
