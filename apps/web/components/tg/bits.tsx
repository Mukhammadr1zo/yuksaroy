'use client';
// Mini App uchun mayda bo'laklar: tugma sinflari, skeleton, bo'sh holat, terminal va e'lon qatorlari (ixcham, 44px teginish), telefon kartasi.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowClockwiseIcon, ImageIcon } from '@phosphor-icons/react';
import { LISTING_LABELS, SEARCH_LABELS, type SearchLang } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { km, num, pricePer, tonne } from '@/lib/format';
import type { TerminalCard } from '@/lib/types';
import type { Me } from '@/lib/types-auth';
import type { ListingCard } from '@/lib/types-listing';
import { cardSrc } from '@/components/catalog/CardPhoto';
import { DemoBadge } from '@/components/market/bits';
import { BOT, haptic, useTg } from './TgProvider';
import { listingPrice, regionName, tgListingHref } from './labels';

export { listingPrice, regionName, tgListingHref };

// O'chiq holat so'nish bilan emas, kul rang bilan: oq matn so'ngan teal ustida o'qilmay qolardi
export const BTN = 'flex min-h-11 w-full items-center justify-center rounded-full bg-teal px-5 font-semibold text-white transition active:scale-[0.98] disabled:bg-line disabled:text-muted disabled:cursor-not-allowed';
export const BTN_GHOST = 'flex min-h-11 w-full items-center justify-center rounded-full border border-line bg-white px-5 font-semibold text-ink transition active:scale-[0.98] disabled:opacity-60';
export const INPUT = 'w-full min-h-11 rounded-xl border border-field bg-white px-4 py-2.5 text-base text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/25 disabled:opacity-60';
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
  return <div className="flex justify-between gap-4 py-1 text-sm"><dt className="text-muted">{k}</dt><dd className={`min-w-0 break-words text-right ${mono ? 'font-mono tabular-nums' : ''}`}>{v}</dd></div>;
}
export function Err({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{children}</p>;
}
/** Yuklab bo'lmadi: bir xil matn va 44px "Qayta urinish". "Ilovani qayta oching" demaydi, chunki odam shu yerning o'zida qayta urina oladi. */
export function LoadError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('tg.common');
  const ts = useTranslations('tg.state');
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-card border border-red-200 bg-red-50 py-1.5 pl-4 pr-1.5 text-sm text-red-700">
      <span>{t('loadFailed')}</span>
      <button type="button" onClick={() => { haptic(); onRetry(); }} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 font-semibold active:scale-[0.97]">
        <ArrowClockwiseIcon size={16} weight="bold" aria-hidden="true" />{ts('retry')}
      </button>
    </div>
  );
}
/** Topilmadi: matn va tegishli ro'yxatga yoki qidiruvga 44px havola, ko'cha tugamasin. */
export function Missing({ text, href, label }: { text: string; href: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-sm text-muted">{text}</p>
      <Link href={href} onClick={() => haptic()} className={`${BTN_GHOST} mt-4`}>{label}</Link>
    </div>
  );
}

/**
 * Terminal qatori: nom (namuna bo'lsa "Namuna" yorlig'i), tur, viloyat. Egasi bor terminalda bugungi bo'sh slot va narx "dan", baho.
 * Reestr shahobchasida (egasi tasdiqlamagan) slot va narx hammasida bir xil ("yo'q" / "so'rov bo'yicha"), shuning uchun
 * o'rniga ularni bir-biridan ajratadigan reestr raqamlari: sig'im, uzunlik, yo'llar va telefon bor-yo'qligi. Tor ustunda qatorlar sinmaydi.
 */
export function TerminalRow({ t, lang }: { t: TerminalCard; lang: SearchLang }) {
  const L = SEARCH_LABELS[lang];
  const tt = useTranslations('card');
  const tm = useTranslations('tg.terminal');
  const free = t.freeToday ?? 0;
  const registry = t.rail !== null && !t.claimed;
  const facts = registry
    ? [
        t.rail!.capacityWagons ? tm('capacity', { count: t.rail!.capacityWagons }) : null,
        t.rail!.lengthM ? tm('length', { count: num(t.rail!.lengthM, lang) }) : null,
        t.rail!.trackCount ? tm('tracks', { count: t.rail!.trackCount }) : null,
      ].filter(Boolean).join(' · ')
    : '';
  return (
    <Link href={`/tg/terminals/${t.slug}`} onClick={() => haptic()} className={`${CARD} block p-3 active:bg-sand`}>
      {/* flex-1: yorliqlar o'ngda yonma-yon turadi, qisqa nomda o'rtaga suzib ketmaydi */}
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate font-bold">{t.name}</p>
        {t.isDemo ? <DemoBadge /> : null}
        {t.is24h ? <span className="shrink-0 rounded-full bg-teal-soft px-2 py-0.5 font-mono text-[11px] font-semibold text-teal-ink">24/7</span> : null}
      </div>
      <p className="mt-0.5 truncate text-xs text-muted">{L.kind[t.kind]}</p>
      <p className="truncate text-xs text-muted">{regionName(t.regionCode, lang)}{t.distanceKm != null ? ` · ${km(t.distanceKm, lang)}` : ''}</p>
      {registry ? (
        <>
          {facts ? <p className="mt-2 break-words font-mono text-sm font-semibold text-navy">{facts}</p> : null}
          <span className={`mt-1.5 inline-block max-w-full truncate whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${t.rail!.hasPhone ? 'bg-teal-soft text-teal-ink' : 'bg-sand text-muted'}`}>
            {t.rail!.hasPhone ? tm('hasPhone') : tm('noPhone')}
          </span>
        </>
      ) : (
        <>
          <span className={`mt-2 inline-block max-w-full truncate whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${free > 0 ? 'bg-teal-soft text-teal-ink' : 'bg-sand text-muted'}`}>
            {free > 0 ? tt('slots.freeToday', { count: free }) : tt('slots.none')}
          </span>
          <p className="mt-1.5 truncate font-mono text-sm font-semibold text-navy tabular-nums">{t.fromPriceTiyin != null ? tt('price.from', { price: pricePer(t.fromPriceTiyin, 'PER_TON', lang) }) : tt('price.onRequest')}</p>
        </>
      )}
      {t.ratingAvg != null ? <p className="mt-1 font-mono text-[11px] text-muted">★ {t.ratingAvg.toFixed(1)} ({t.ratingCount})</p> : null}
    </Link>
  );
}


/** E'lon qatori: rasm yoki bo'sh, sarlavha (namuna bo'lsa "Namuna" yorlig'i), tur va yil, viloyat, narx. */
/** E'lon rasmi. Rasm bo'lmasa bo'sh katak emas, belgi turadi (qidiruv, E'lonlarim va Ishlarim shu bittasidan foydalanadi). */
export function ListingThumb({ photo }: { photo?: string | null }) {
  return (
    <div className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sand text-muted">
      {photo ? <img src={cardSrc(photo)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <ImageIcon size={24} weight="duotone" className="opacity-60" aria-hidden="true" />}
    </div>
  );
}

export function ListingRow({ l, lang }: { l: ListingCard; lang: SearchLang }) {
  const L = LISTING_LABELS[lang];
  const tc = useTranslations('tg.common');
  const tl = useTranslations('listing.card');
  const truck = l.kind === 'TRUCK';
  const sub = truck
    ? [l.truckType ? L.truckType[l.truckType as keyof typeof L.truckType] ?? l.truckType : null, l.tonnage ? tonne(l.tonnage, lang) : null]
    : [L.kind[l.kind], l.year, l.condition ? L.condition[l.condition] : null];
  return (
    <Link href={tgListingHref(l)} onClick={() => haptic()} className={`${CARD} flex gap-3 p-3 active:bg-sand`}>
      <ListingThumb photo={l.photo} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate font-bold">{l.title}</p>
          {/* Namuna qator hamma joyda belgilanadi: catalog DemoBadge server komponent, bu yerda client */}
          {l.isDemo ? <span className="shrink-0 rounded-full border border-dashed border-line bg-sand px-2 py-0.5 text-[11px] font-semibold text-muted">{tl('demo')}</span> : null}
        </div>
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
