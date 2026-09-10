import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import { sapi, qs } from '@/lib/server-api';
import type { Page, Siding } from '@/lib/types';
import { RegionFilter } from '@/components/catalog/RegionFilter';
import { NearMeButton } from '@/components/catalog/NearMeButton';
import { RegionChips } from '@/components/catalog/RegionChips';
import { SidingsTable } from '@/components/catalog/SidingsTable';
import { alt } from '@/lib/seo';

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
        <p className="font-mono text-sm text-muted">{t('count', { count: data.total })} · <Link href={mapHref} className="font-body text-xs font-semibold text-teal-ink underline decoration-dotted hover:text-navy">{th('viewOnMap')}</Link></p>
      </div>

      <form className="mt-6 grid gap-3 rounded-card border border-line bg-white p-4 md:grid-cols-[1.2fr_1.4fr_auto]" action="/sidings">
        <RegionFilter value={f.region} />
        <input name="q" defaultValue={f.q} placeholder={t('search.placeholder')} className="rounded-xl border border-line bg-white px-3 py-3 text-sm" />
        <button className="rounded-xl bg-navy px-5 py-3 font-semibold text-white hover:bg-navy-2">{tf('apply')}</button>
      </form>

      <div className="mt-3"><NearMeButton path="/sidings" radiusKm={25} /></div>

      <div className="mt-6"><SidingsTable items={data.items} /></div>

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
