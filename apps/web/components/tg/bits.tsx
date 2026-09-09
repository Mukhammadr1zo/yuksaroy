'use client';
// Mini App uchun mayda bo'laklar: tugma sinflari, skeleton, bo'sh holat, terminal va e'lon qatorlari (ixcham, 44px teginish), telefon kartasi.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LISTING_LABELS, SEARCH_LABELS, type SearchLang } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { pricePer } from '@/lib/format';
import type { TerminalCard } from '@/lib/types';
import type { Me } from '@/lib/types-auth';
import type { ListingCard } from '@/lib/types-listing';
import { BOT, haptic, useTg } from './TgProvider';
import { listingPrice, regionName, tgListingHref } from './labels';

export { listingPrice, regionName, tgListingHref };

export const BTN = 'flex min-h-11 w-full items-center justify-center rounded-full bg-teal px-5 font-semibold text-white transition active:scale-[0.98] disabled:opacity-60';
export const BTN_GHOST = 'flex min-h-11 w-full items-center justify-center rounded-full border border-line bg-white px-5 font-semibold text-ink transition active:scale-[0.98] disabled:opacity-60';
export const INPUT = 'w-full min-h-11 rounded-xl border border-line bg-white px-4 py-2.5 text-base text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/25 disabled:opacity-60';
export const CHIP = (on: boolean) => `min-h-11 rounded-full px-4 text-sm font-semibold transition active:scale-[0.97] ${on ? 'bg-navy text-white' : 'border border-line bg-white text-ink'}`;
export const CARD = 'rounded-card border border-line bg-white';

export const useLang = (): SearchLang => { const l = useLocale(); return (l in SEARCH_LABELS ? l : 'uz') as SearchLang; };

export function Skeleton({ n = 3, h = 'h-20' }: { n?: number; h?: string }) {
  return <div className="space-y-2" aria-busy="true">{Array.from({ length: n }, (_, i) => <div key={i} className={`${h} animate-pulse rounded-card bg-line/60`} />)}</div>;
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-card border border-dashed border-line p-6 text-center text-sm text-muted">{children}</div>;
}
export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline justify-between gap-3"><h2 className="text-sm font-bold">{title}</h2>{aside}</div>
      {children}
    </section>
  );
}
export function Row({ k, v, mono }: { k: string; v: ReactNode; mono?: boolean }) {
  return <div className="flex justify-between gap-4 py-1 text-sm"><dt className="text-muted">{k}</dt><dd className={`text-right ${mono ? 'font-mono tabular-nums' : ''}`}>{v}</dd></div>;
}
export function Err({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{children}</p>;
}

/** Terminal qatori: nom, tur, viloyat, bugungi bo'sh slot (bitta qatorli tabletka), narx "dan", baho. Tor ustunda ham qatorlar sinmaydi. */
export function TerminalRow({ t, lang }: { t: TerminalCard; lang: SearchLang }) {
  const L = SEARCH_LABELS[lang];
  const tt = useTranslations('card');
  const free = t.freeToday ?? 0;
  return (
    <Link href={`/tg/terminals/${t.slug}`} onClick={() => haptic()} className={`${CARD} block p-3 active:bg-sand`}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate font-bold">{t.name}</p>
        {t.is24h ? <span className="shrink-0 rounded-full bg-teal-soft px-2 py-0.5 font-mono text-[11px] font-semibold text-teal-ink">24/7</span> : null}
      </div>
      <p className="mt-0.5 truncate text-xs text-muted">{L.kind[t.kind]}</p>
      <p className="truncate text-xs text-muted">{regionName(t.regionCode, lang)}{t.distanceKm != null ? ` · ${Math.round(t.distanceKm)} km` : ''}</p>
      <span className={`mt-2 inline-block max-w-full truncate whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${free > 0 ? 'bg-teal-soft text-teal-ink' : 'bg-sand text-muted'}`}>
        {free > 0 ? tt('slots.freeToday', { count: free }) : tt('slots.none')}
      </span>
      <p className="mt-1.5 truncate font-mono text-sm font-semibold text-navy tabular-nums">{t.fromPriceTiyin != null ? tt('price.from', { price: pricePer(t.fromPriceTiyin, 'PER_TON') }) : tt('price.onRequest')}</p>
      {t.ratingAvg != null ? <p className="mt-1 font-mono text-[11px] text-muted">★ {t.ratingAvg.toFixed(1)} ({t.ratingCount})</p> : null}
    </Link>
  );
}


/** E'lon qatori: rasm yoki bo'sh, sarlavha, tur va yil, viloyat, narx. */
export function ListingRow({ l, lang }: { l: ListingCard; lang: SearchLang }) {
  const L = LISTING_LABELS[lang];
  const tc = useTranslations('tg.common');
  const truck = l.kind === 'TRUCK';
  const sub = truck
    ? [l.truckType ? L.truckType[l.truckType as keyof typeof L.truckType] ?? l.truckType : null, l.tonnage ? `${l.tonnage} t` : null]
    : [L.kind[l.kind], l.year, l.condition ? L.condition[l.condition] : null];
  return (
    <Link href={tgListingHref(l)} onClick={() => haptic()} className={`${CARD} flex gap-3 p-3 active:bg-sand`}>
      <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-sand">{l.photo ? <img src={l.photo} alt="" className="h-full w-full object-cover" /> : null}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{l.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted">{sub.filter((x) => x != null && x !== '').join(' · ')}{l.deal ? ` · ${SEARCH_LABELS[lang].deal[l.deal]}` : ''}</p>
        <p className="mt-0.5 truncate text-xs text-muted">{regionName(l.regionCode, lang)} · {l.owner.name}</p>
        <p className="mt-1 font-mono text-sm font-semibold text-navy tabular-nums">{l.priceTiyin != null ? listingPrice(l.priceTiyin, l.priceUnit, lang) : tc('onRequest')}</p>
      </div>
    </Link>
  );
}

/**
 * Telefon kartasi (needsPhone): requestContact -> bot kontaktni oladi va telefonni bog'laydi -> /auth/me har 3 s, 60 s gacha.
 * Vaqt tugasa xabar va "Qayta urinish": qayta kirish shu tugmadan (relogin sahifani almashtiradi, avtomatik chaqirilsa xabar ko'rinmay qoladi).
 */
export function PhoneCard() {
  const t = useTranslations('tg.phone');
  const tb = useTranslations('tg.boot');
  const { tg, me, needsPhone, setMe, relogin } = useTg();
  const [phase, setPhase] = useState<'idle' | 'waiting' | 'timeout' | 'declined' | 'done'>('idle');
  const timer = useRef<number | null>(null);
  const alive = useRef(true);

  useEffect(() => { alive.current = true; return () => { alive.current = false; if (timer.current) window.clearInterval(timer.current); }; }, []);
  if (!me || (!needsPhone && phase !== 'done')) return null;

  const poll = () => {
    if (!alive.current) return; // relogin sahifani qayta chizsa, karta yangidan boshlanadi
    const started = Date.now();
    setPhase('waiting');
    timer.current = window.setInterval(async () => {
      const m = await api<Me>('/auth/me').catch(() => null);
      if (m?.phone) { window.clearInterval(timer.current!); setMe(m); setPhase('done'); haptic('medium'); return; }
      if (Date.now() - started > 60_000) { window.clearInterval(timer.current!); setPhase('timeout'); }
    }, 3000);
  };
  const ask = () => {
    if (!tg?.requestContact) { tg?.openTelegramLink(`https://t.me/${BOT}?start=login`); return; }
    haptic();
    setPhase('waiting');
    tg.requestContact((sent) => { if (sent) poll(); else setPhase('declined'); });
  };
  // Qayta urinish: yangi sessiya (bot raqamni boshqa foydalanuvchiga bog'lagan bo'lishi mumkin), so'ng yana kutish
  const retry = async () => { haptic(); await relogin(); poll(); };

  if (phase === 'done') return <p className="rounded-card border border-teal/30 bg-teal-soft px-4 py-3 text-sm font-semibold text-teal-ink">{t('done', { phone: me.phone ?? '' })}</p>;
  return (
    <section className={`${CARD} border-amber/40 p-4`}>
      <h2 className="font-bold">{t('title')}</h2>
      <p className="mt-1 text-sm text-muted">{tg?.requestContact ? t('body') : t('unsupported')}</p>
      {phase === 'timeout' ? <p className="mt-2 text-xs text-amber-ink">{t('timeout')}</p> : phase === 'declined' ? <p className="mt-2 text-xs text-amber-ink">{t('declined')}</p> : null}
      {phase === 'timeout' ? (
        <button type="button" onClick={retry} className={`${BTN} mt-3`}>{tb('retry')}</button>
      ) : (
        <button type="button" onClick={ask} disabled={phase === 'waiting'} className={`${BTN} mt-3`}>
          {phase === 'waiting' ? t('waiting') : tg?.requestContact ? t('cta') : t('openBot')}
        </button>
      )}
    </section>
  );
}
