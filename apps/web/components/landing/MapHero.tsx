'use client';
// Hero: standardrail.com modeli. Xarita to'liq ekranda fon, chapda oq gradient ustida matn.
// Ustida karta yoki panel yo'q: qidiruv to'g'ridan-to'g'ri xaritada turadi. Matn ustunidan tashqarida
// sichqoncha xaritaga tegadi (pointer-events), shuning uchun xaritani surish va yaqinlashtirish mumkin.
import dynamic from 'next/dynamic';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { ArrowRightIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import { Link } from '@/i18n/navigation';
import { num } from '@/lib/format';
import type { MapState } from '@/components/map/state';
import { StripFrame } from '@/components/map/StripFrame';

const LightMap = dynamic(() => import('./LightMap'), { ssr: false });
const MapStrip = dynamic(() => import('@/components/map/MapView').then((m) => m.MapView), { ssr: false });
/**
 * Telefon tasmasining kadri qat'iy: tasma interaktiv emas, demak ostidagi rasm bilan piksel-piksel mos
 * (public/map/strip-{til}.webp, 574x298 @2x). Rasmni scripts/strip-poster.mjs yasaydi: kadr, tasma o'lchami,
 * light.json yoki mapStyle.ts dagi asos qatlamlari o'zgarsa qayta yuritiladi. Ilgari kadr nuqtalar
 * chegarasidan hisoblanardi va minZoom 4.5 ga tirab qolardi, ya'ni markaz o'sha chegaraning o'rtasi edi:
 * shahobchali stansiyalar 58.1..73.0 E, 37.2..43.4 N (seed reestri).
 */
const STRIP: MapState = { cat: [], region: '', corridor: '', near: null, radius: 0, q: '', c: [65.5, 40.3], z: 4.5 };
/** 1x1 shaffof GIF: keng ekranda tasma yashirin, rasm umuman yuklanmasin. */
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * Brauzer bo'shaganda true: xarita kutubxonasi (maplibre, ~260 KB) va nuqtalar so'rovi gidratatsiya
 * va birinchi bosish bilan bir vaqtda asosiy oqimni band qilmasin. "Ko'rinishga yaqinlashganda" sharti
 * bu yerda hech narsani kechiktirmasdi: hero xaritasi ham, telefon tasmasi ham birinchi ekranda.
 */
function useIdle() {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    // Safari da requestIdleCallback yo'q
    if (typeof window.requestIdleCallback !== 'function') {
      const t = window.setTimeout(() => setIdle(true), 200);
      return () => window.clearTimeout(t);
    }
    const id = window.requestIdleCallback(() => setIdle(true), { timeout: 2000 });
    return () => window.cancelIdleCallback(id);
  }, []);
  return idle;
}

/** lg va undan keng: fon xaritasi (desktop hero); torroq: fon sand, qidiruv ostida 300px xarita tasmasi. null = hali noma'lum (SSR). */
function useWide() {
  const [wide, setWide] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const f = () => setWide(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  return wide;
}

const BROWSE = [
  { href: '/terminals', key: 'terminalServices' },
  { href: '/equipment', key: 'railEquipment' },
  { href: '/carriers', key: 'truck' },
] as const;

const DOORS = [
  { href: '/terminals', key: 'shipper', muted: false },
  { href: '/login?next=/dashboard', key: 'owner', muted: false },
  { href: '/map', key: 'map', muted: true },
] as const;

/** terminals: ochiq katalogdagi hamma terminal (shahobcha yo'llar ham shu ichida). */
export function MapHero({ terminals }: { terminals: number | null }) {
  const t = useTranslations('hero');
  const tm = useTranslations('map');
  const locale = useLocale();
  const wide = useWide();
  const idle = useIdle();

  return (
    <section className="relative min-h-[min(760px,100dvh)] overflow-hidden bg-sand">
      {/* Fon xaritasi faqat lg da (desktop hero o'zgarmagan); telefonda o'rniga pastdagi tasma.
          Kadri jonli nuqtalar va oyna kengligidan hisoblanadi, shuning uchun bu yerda rasm qo'yilmaydi
          (almashuvda sakrardi): xarita oldingidek qum fon ustida paydo bo'ladi, faqat brauzer bo'shagach */}
      <div className="absolute inset-0">
        {wide && idle ? <LightMap /> : null}
      </div>

      {/* Matn ustuni ostidagi oqartirish: xarita qanday bo'lsa ham matn o'qiladi */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(241,244,248,0.97)_0%,rgba(241,244,248,0.88)_46%,rgba(241,244,248,0.72)_100%)] lg:bg-[linear-gradient(90deg,rgba(241,244,248,0.98)_0%,rgba(241,244,248,0.93)_34%,rgba(241,244,248,0.55)_52%,rgba(241,244,248,0)_72%)]" />

      {/* Legenda: ranglar nimani bildirishini aytadi, faqat xarita ko'rinadigan keng ekranda */}
      <ul
        className="pointer-events-none absolute right-4 top-4 hidden items-center gap-3 rounded-full border border-line bg-white/90 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.08em] text-muted lg:flex"
        aria-label={t('map.legend.aria')}
      >
        <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-0 w-4 border-t-2 border-dashed border-navy" />{t('map.legend.rail')}</li>
        <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-[2px] w-4 rounded bg-[#F39C1F]" />{t('map.legend.road')}</li>
        <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#FD7B03] ring-1 ring-white" />{t('map.legend.terminal')}</li>
      </ul>

      {/* Plitka litsenziyasi (ODbL, CARTO) attributsiyani talab qiladi: tugma o'rniga mayda matn qatori */}
      <p className="pointer-events-none absolute bottom-2 right-3 hidden font-mono text-[10px] text-muted/70 lg:block">
        <a className="pointer-events-auto hover:text-navy" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
        {', '}
        <a className="pointer-events-auto hover:text-navy" href="https://carto.com/attributions" target="_blank" rel="noreferrer">© CARTO</a>
      </p>

      <div className="pointer-events-none relative mx-auto flex min-h-[min(760px,100dvh)] max-w-6xl flex-col justify-center px-6 py-16">
        <div className="pointer-events-auto max-w-[36rem]">
          <h1 className="font-display text-[clamp(2.25rem,5vw,3.9rem)] font-bold leading-[1.02] tracking-tight text-navy">{t('title')}</h1>
          <p className="font-display mt-3 text-[clamp(1.1rem,2.2vw,1.6rem)] font-bold leading-tight text-ink">{t('subtitle')}</p>
          <p className="mt-4 max-w-[46ch] text-[17px] leading-relaxed text-muted">{t('lead')}</p>

          <form action="/search" className="mt-7 flex max-w-[34rem] items-center gap-2 rounded-full border border-line bg-white p-1.5 shadow-sm">
            <MagnifyingGlassIcon size={20} weight="regular" aria-hidden="true" className="ml-3 shrink-0 text-muted" />
            <input
              name="q"
              type="search"
              placeholder={t('search.placeholder')}
              aria-label={t('search.aria')}
              className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] outline-none placeholder:text-muted/70"
            />
            <button className="shrink-0 rounded-full bg-teal px-6 py-2.5 text-[15px] font-semibold text-white transition duration-200 hover:bg-teal-ink active:scale-[0.98]">
              {t('search.submit')}
            </button>
          </form>
          <p className="mt-2.5 font-mono text-[12px] text-teal-ink">{t('search.note')}</p>

          {/* Telefon: 300px xarita tasmasi, bosish -> /map. Ramka, tugma va xaritaning rasmi darhol
              (server HTML), jonli xarita brauzer bo'shagach ustiga chiqadi: asos bir xil, faqat pinlar qo'shiladi */}
          <div className="mt-5 lg:hidden">
            <StripFrame>
              <picture>
                <source media="(min-width: 1024px)" srcSet={BLANK} />
                <img src={`/map/strip-${locale}.webp`} alt="" width={1148} height={596} className="absolute inset-0 h-full w-full object-cover" />
              </picture>
              {wide === false && idle ? <MapStrip compact bare initial={STRIP} /> : null}
            </StripFrame>
          </div>

          <p className="mt-7 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">{t('browse.heading')}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {BROWSE.map((b) => (
              <li key={b.href}>
                <Link
                  href={b.href}
                  className="inline-block rounded-full border border-line bg-white/90 px-4 py-2 text-sm font-semibold text-ink/85 transition duration-200 hover:border-teal hover:text-teal-ink"
                >
                  {t(`browse.${b.key}`)}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3">
            {DOORS.map((d) => (
              <Link
                key={d.key}
                href={d.href}
                className={`group inline-flex items-center gap-2 text-[15px] font-semibold transition-colors duration-200 ${d.muted ? 'text-muted hover:text-navy' : 'text-navy hover:text-teal-ink'}`}
              >
                {d.key === 'map' ? tm('open') : t(`door.${d.key}`)}
                <ArrowRightIcon size={16} weight="bold" aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            ))}
          </div>

          {/* Sanoqlar kelmasa (API javob bermadi) qator butunlay chizilmaydi: nol ko'rsatishdan yaxshiroq */}
          {terminals !== null ? (
            <dl className="mt-9 flex flex-wrap gap-x-8 gap-y-3 border-t border-line/80 pt-5">
              {[
                [num(terminals, locale), t('stat.terminals')],
                ['8', t('stat.serviceTypes')],
              ].map(([v, l]) => (
                <div key={l} className="flex items-baseline gap-2">
                  <dd className="font-mono text-lg font-semibold tabular-nums text-navy">{v}</dd>
                  <dt className="text-sm text-muted">{l}</dt>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>
    </section>
  );
}
