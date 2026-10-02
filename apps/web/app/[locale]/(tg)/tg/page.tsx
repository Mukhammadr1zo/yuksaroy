'use client';
// Mini App bosh sahifasi: salom va telefon holati, qidiruv, to'rt toifa sanoq bilan, bugun bo'sh slotli terminallar, ochiq buyurtmalar, shoshilinch so'rov.
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRightIcon, LightningIcon, MagnifyingGlassIcon, MapTrifoldIcon, TrainIcon, TrainRegionalIcon, TruckIcon, UserIcon, WarehouseIcon, ClipboardTextIcon, MegaphoneIcon } from '@phosphor-icons/react';
import { EQUIPMENT_KINDS } from '@yuksaroy/domain';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { som } from '@/lib/format';
import type { OrderCard, Page, Stats, TerminalCard } from '@/lib/types';
import type { ListingPage } from '@/lib/types-listing';
import { StatusPill } from '@/components/order/bits';
import { haptic, useTg } from '@/components/tg/TgProvider';
import { CARD, PhoneCard, Skeleton, TerminalRow, useLang } from '@/components/tg/bits';

type Counts = { terminal: number; equipment: number; truck: number };
const TILES = [
  { key: 'terminal', href: '/tg/search?cat=terminal', Icon: WarehouseIcon },
  { key: 'equipment', href: '/tg/search?cat=equipment', Icon: TrainIcon },
  { key: 'truck', href: '/tg/search?cat=truck', Icon: TruckIcon },
] as const;
const LINKS = [
  { key: 'orders', href: '/tg/orders', Icon: ClipboardTextIcon },
  { key: 'listings', href: '/tg/listings', Icon: MegaphoneIcon },
  { key: 'map', href: '/tg/map', Icon: MapTrifoldIcon },
  { key: 'profile', href: '/tg/profile', Icon: UserIcon },
] as const;

export default function TgHome() {
  const t = useTranslations('tg.home');
  const tp = useTranslations('tg.common');
  const { me } = useTg();
  const lang = useLang();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [counts, setCounts] = useState<Counts | null>(null);
  const [bookable, setBookable] = useState<TerminalCard[] | null>(null);
  const [orders, setOrders] = useState<OrderCard[] | null>(null);

  useEffect(() => {
    // Sanoqlar: /stats (terminal, shahobcha ham shu ichida) + e'lonlar turi bo'yicha ikki qisqa so'rov
    Promise.all([
      api<Stats>('/stats').catch(() => null),
      api<ListingPage>(`/listings?kind=${EQUIPMENT_KINDS.join(',')}&limit=1`).catch(() => null),
      api<ListingPage>('/listings?kind=TRUCK&limit=1').catch(() => null),
    ]).then(([s, eq, tr]) => setCounts({ terminal: s?.terminals ?? 0, equipment: eq?.total ?? 0, truck: tr?.total ?? 0 }));
    api<Page<TerminalCard>>('/terminals?bookable=1&limit=6').then((r) => setBookable(r.items)).catch(() => setBookable([]));
    api<Page<OrderCard>>('/orders?scope=client&status=PENDING,CONFIRMED,IN_PROGRESS&limit=3').then((r) => setOrders(r.items)).catch(() => setOrders([]));
  }, []);

  const submit = (e: React.FormEvent) => { e.preventDefault(); if (q.trim()) { haptic(); router.push(`/tg/search?q=${encodeURIComponent(q.trim())}`); } };
  const name = me?.fullName?.split(/\s+/)[0];

  return (
    <main id="main" className="mx-auto max-w-md px-4 pb-8 pt-4">
      <header>
        <h1 className="font-display text-xl font-bold">{name ? t('hello', { name }) : t('helloNoName')}</h1>
        {me?.phone ? <p className="mt-0.5 font-mono text-xs text-muted">{t('phoneOk', { phone: me.phone })}</p> : null}
      </header>
      <div className="mt-3"><PhoneCard /></div>

      <form onSubmit={submit} role="search" aria-label={t('searchAria')} className="mt-4 flex gap-2">
        <label className="relative min-w-0 flex-1">
          <MagnifyingGlassIcon size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPh')} enterKeyHint="search" className="min-h-12 w-full rounded-full border border-field bg-white pl-10 pr-4 text-base text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/25" />
        </label>
        <button type="submit" aria-label={t('search')} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal text-white active:scale-[0.96]"><ArrowRightIcon size={20} weight="bold" /></button>
      </form>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {TILES.map(({ key, href, Icon }) => (
          <Link key={key} href={href} onClick={() => haptic()} className={`${CARD} flex min-h-[84px] flex-col justify-between p-3 active:bg-sand`}>
            <Icon size={24} weight="duotone" className="text-teal" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold">{t(`cats.${key}`)}</p>
              <p className="font-mono text-xs text-muted tabular-nums">{counts ? counts[key] : '…'}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Vagon qidiruvi: asbob, lekin pastdagi to'rt ustunli LINKS qatoriga qo'shilmadi.
          Beshinchi katak 390px ekranda ustunni 65px ga tushirar va "Buyurtmalar" yozuvi
          kesilardi. Shu sababli alohida qator karta, shoshilinch so'rov kartasi bilan bir xil. */}
      <Link href="/tg/wagon" onClick={() => haptic()} className={`${CARD} mt-4 flex items-center gap-3 p-4 active:bg-sand`}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-soft text-teal-ink"><TrainRegionalIcon size={22} weight="duotone" aria-hidden="true" /></span>
        <span className="min-w-0"><span className="block font-bold">{t('wagon')}</span><span className="block text-xs text-muted">{t('wagonHint')}</span></span>
        <ArrowRightIcon size={18} className="ml-auto shrink-0 text-muted" aria-hidden="true" />
      </Link>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-bold">{t('bookable')}</h2>
        {bookable === null ? <Skeleton n={1} h="h-24" /> : bookable.length === 0 ? <p className="text-sm text-muted">{t('bookableEmpty')}</p> : (
          <div className="tg-strip -mx-4 px-4">
            {bookable.map((x) => <div key={x.id} className="w-[272px]"><TerminalRow t={x} lang={lang} /></div>)}
          </div>
        )}
      </section>

      {orders && orders.length ? (
        <section className="mt-6">
          <div className="mb-2 flex items-baseline justify-between"><h2 className="text-sm font-bold">{t('orders')}</h2><Link href="/tg/orders" className="text-xs font-semibold text-teal-ink">{t('ordersAll')}</Link></div>
          <ul className="space-y-2">
            {orders.map((o) => (
              <li key={o.no}>
                <Link href={`/tg/orders/${o.no}`} onClick={() => haptic()} className={`${CARD} block p-3 active:bg-sand`}>
                  <div className="flex items-center gap-2"><span className="font-mono text-sm font-bold">{o.no}</span><StatusPill status={o.status} /><span className="ml-auto font-mono text-sm font-semibold tabular-nums">{som(o.totalTiyin, lang)}</span></div>
                  <p className="mt-1 truncate text-sm">{o.terminal.name}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Link href="/tg/urgent" onClick={() => haptic('medium')} className={`${CARD} mt-6 flex items-center gap-3 border-amber/40 p-4 active:bg-sand`}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-soft text-amber-ink"><LightningIcon size={22} weight="fill" aria-hidden="true" /></span>
        <span className="min-w-0"><span className="block font-bold">{t('urgent')}</span><span className="block text-xs text-muted">{t('urgentHint')}</span></span>
        <ArrowRightIcon size={18} className="ml-auto shrink-0 text-muted" aria-hidden="true" />
      </Link>

      <nav aria-label={tp('all')} className="mt-6 grid grid-cols-4 gap-2">
        {LINKS.map(({ key, href, Icon }) => (
          <Link key={key} href={href} onClick={() => haptic()} className={`${CARD} flex min-h-[64px] flex-col items-center justify-center gap-1 p-2 text-center active:bg-sand`}>
            <Icon size={20} className="text-teal-ink" aria-hidden="true" />
            <span className="text-[11px] font-semibold">{t(`links.${key}`)}</span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
