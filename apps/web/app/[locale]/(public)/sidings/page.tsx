import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import { sapi, qs } from '@/lib/server-api';
import type { Page, Siding } from '@/lib/types';
import { RegionFilter } from '@/components/catalog/RegionFilter';
import { NearMeButton } from '@/components/catalog/NearMeButton';
import { RegionChips } from '@/components/catalog/RegionChips';
import { SidingsTable } from '@/components/catalog/SidingsTable';
import { alt } from '@/lib/seo';
import { DashLink } from '@/components/site/DashLink';
import { MapTrifoldIcon } from '@phosphor-icons/react/dist/ssr';

export const revalidate = 300;

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta.sidings' });
  return { ...{ title: t('title'), description: t('description') }, ...alt(locale, '/sidings') };
}

export default async function SidingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  // t: sidings nomfazosi; tn nav, tf filter, tp pagination, th hubs
  const [sp, t, tn, tf, tp, th] = await Promise.all([searchParams, getTranslations('sidings'), getTranslations('nav'), getTranslations('filter'), getTranslations('pagination'), getTranslations('hubs')]);
  const tg = await getTranslations('marketing.common');
  const f = {
    region: one(sp.region), q: one(sp.q), near: one(sp.near), radius: one(sp.radius), station: one(sp.station),
    page: Number(one(sp.page)) || 1,
  };
  const data = await sapi<Page<Siding>>(`/sidings${qs({ ...f, limit: 30 })}`, 300);
  const pages = Math.max(1, Math.ceil(data.total / data.limit));
  // Diapazondan tashqari ?page= bo'sh jadval ustida "200 / 47" ko'rsatardi
  const cur = Math.min(data.page, pages);
  const mapHref = `/map${qs({ cat: 'siding', region: f.region, near: f.near, radius: f.radius, q: f.q })}`;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">{tn('sidings')}</h1>
          <p className="mt-2 max-w-2xl text-muted">{t('lead')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-mono text-sm text-muted">{t('count', { count: data.total })}</p>
          <Link href={mapHref} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-2 text-sm font-semibold text-navy transition-colors duration-150 hover:border-teal hover:text-teal-ink"><MapTrifoldIcon size={16} weight="duotone" className="text-teal" aria-hidden="true" />{th('viewOnMap')}</Link>
        </div>
      </div>

      <form className="mt-6 grid gap-3 rounded-card border border-line bg-white p-4 md:grid-cols-[1.2fr_1.4fr_auto]" action="/sidings">
        <RegionFilter value={f.region} />
        <input name="q" defaultValue={f.q} placeholder={t('search.placeholder')} className="rounded-xl border border-line bg-white px-3 py-3 text-sm" />
        <button className="rounded-xl bg-navy px-5 py-3 font-semibold text-white hover:bg-navy-2">{tf('apply')}</button>
      </form>

      <div className="mt-3"><NearMeButton path="/sidings" radiusKm={25} /></div>

      {data.total === 0 && !f.q && !f.region && !f.station ? (
        <div className="mt-6 rounded-card border border-dashed border-line bg-white p-10 text-center">
          <p className="mx-auto max-w-[52ch] text-muted">{t('emptyOwner')}</p>
          <DashLink href="/dashboard/sidings" className="mt-4 inline-block rounded-full bg-teal px-6 py-2.5 font-semibold text-white transition hover:bg-teal-ink active:scale-[0.98]" signupLabel={tg('guestCta')}>{t('emptyOwnerCta')}</DashLink>
        </div>
      ) : null}

      {data.total || f.q || f.region || f.station ? <div className="mt-6"><SidingsTable items={data.items} /></div> : null}

      {pages > 1 && (
        <nav aria-label={tp('aria')} className="mt-6 flex flex-wrap items-center justify-center gap-2 font-mono text-sm">
          {cur > 1 ? <Link href={`/sidings${qs({ ...f, page: cur - 1 })}`} className="rounded-full border border-line bg-white px-3 py-1 hover:bg-sand">{tp('prev')}</Link> : null}
          <span className="px-2 text-muted">{cur} / {pages}</span>
          {cur < pages ? <Link href={`/sidings${qs({ ...f, page: cur + 1 })}`} className="rounded-full border border-line bg-white px-3 py-1 hover:bg-sand">{tp('next')}</Link> : null}
        </nav>
      )}
      <RegionChips base="/sidings" />
    </div>
  );
}
