'use client';
// Mini App bosh sahifasi: salom va telefon holati, qidiruv (/tg/search dagi bilan bir xil SearchBox), uch toifa sanoq bilan, vagon va shoshilinch so'rov, ochiq buyurtmalar, bugun bo'sh joyli terminallar.
// Bo'limlar orasidagi o'tish pastki tab panelida (TabBar).
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRightIcon, LightningIcon, TrainIcon, TrainRegionalIcon, TruckIcon, WarehouseIcon } from '@phosphor-icons/react';
import { EQUIPMENT_KINDS } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { som } from '@/lib/format';
import type { OrderCard, Page, Stats, TerminalCard } from '@/lib/types';
import type { ListingPage } from '@/lib/types-listing';
import { StatusPill } from '@/components/order/bits';
import { haptic, useTg } from '@/components/tg/TgProvider';
import { CARD, PhoneCard, TerminalRow, useLang } from '@/components/tg/bits';
import { SearchBox } from '@/components/tg/SearchBox';

type Counts = { terminal: number; equipment: number; truck: number };
const TILES = [
  { key: 'terminal', href: '/tg/search?cat=terminal', Icon: WarehouseIcon },
  { key: 'equipment', href: '/tg/search?cat=equipment', Icon: TrainIcon },
  { key: 'truck', href: '/tg/search?cat=truck', Icon: TruckIcon },
] as const;

export default function TgHome() {
  const t = useTranslations('tg.home');
  const { me } = useTg();
  const lang = useLang();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [bookable, setBookable] = useState<TerminalCard[] | null>(null);
  const [orders, setOrders] = useState<OrderCard[] | null>(null);

  useEffect(() => {
    // Sanoqlar: /stats (terminal, shahobcha ham shu ichida, namunasiz) + e'lonlar turi bo'yicha ikki so'rov.
    // Haqiqiy son = total - summary.demo (API butun filtrlangan to'plamdagi namunani sanaydi)
    const real = (p: ListingPage | null) => (p ? p.total - (p.summary.demo ?? 0) : 0);
    Promise.all([
      api<Stats>('/stats').catch(() => null),
      api<ListingPage>(`/listings?kind=${EQUIPMENT_KINDS.join(',')}&limit=1`).catch(() => null),
      api<ListingPage>('/listings?kind=TRUCK&limit=1').catch(() => null),
    ]).then(([s, eq, tr]) => setCounts({ terminal: s?.terminals ?? 0, equipment: real(eq), truck: real(tr) }));
    // 2026-11-02: namunaga joy band qilinmaydi, "bo'sh joyli" qatorida ham chiqmaydi
    api<Page<TerminalCard>>('/terminals?bookable=1&limit=6').then((r) => setBookable(r.items.filter((x) => !x.isDemo))).catch(() => setBookable([]));
    api<Page<OrderCard>>('/orders?scope=client&status=PENDING,CONFIRMED,IN_PROGRESS&limit=3').then((r) => setOrders(r.items)).catch(() => setOrders([]));
  }, []);

  const name = me?.fullName?.split(/\s+/)[0];

  return (
    <main id="main" className="mx-auto max-w-md px-4 pb-8 pt-4">
      <header>
        <h1 className="font-display text-xl font-bold">{name ? t('hello', { name }) : t('helloNoName')}</h1>
        {me?.phone ? <p className="mt-0.5 font-mono text-xs text-muted">{t('phoneOk', { phone: me.phone })}</p> : null}
      </header>
      <div className="mt-3"><PhoneCard /></div>

      <div className="mt-4"><SearchBox initial="" /></div>

      {/* Uch toifa bir qatorda, bir xil balandlikda (grid stretch). Nom bitta qatorda: eng uzun nom "Автотранспорт" Manrope 700 da
          13px = 98px; shrift ekran eniga bog'langan (3vw, 11-13px), shunda 360px dan boshlab uch tilda ham kesilmaydi */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {TILES.map(({ key, href, Icon }) => (
          <Link key={key} href={href} onClick={() => haptic()} className={`${CARD} flex min-h-[88px] min-w-0 flex-col justify-between px-2.5 py-3 active:bg-sand`}>
            <Icon size={24} weight="duotone" className="text-teal" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-[clamp(11px,3vw,13px)] font-bold leading-tight tracking-[-0.01em]">{t(`cats.${key}`)}</p>
              {/* Egasi qarori (2026-10-07): nol sanoq chizilmaydi, 1 va undan ko'pi asl soni bilan. Qator joyi
                  qoladi (h-4): sanoq kelganda yoki nol bo'lganda plitka balandligi o'zgarmaydi */}
              <p className="mt-0.5 h-4 font-mono text-xs leading-4 text-muted tabular-nums">{counts ? counts[key] || null : '…'}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Doimiy kartalar yuqorida, API dan keladigan bloklar (buyurtmalar, bo'sh joylar) pastda:
          ular kech kelsa ham yoki umuman chiqmasa ham yuqoridagi kartalar siljimaydi */}
      <Link href="/tg/wagon" onClick={() => haptic()} className={`${CARD} mt-4 flex items-center gap-3 p-4 active:bg-sand`}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-soft text-teal-ink"><TrainRegionalIcon size={22} weight="duotone" aria-hidden="true" /></span>
        <span className="min-w-0"><span className="block font-bold">{t('wagon')}</span><span className="block text-xs text-muted">{t('wagonHint')}</span></span>
        <ArrowRightIcon size={18} className="ml-auto shrink-0 text-muted" aria-hidden="true" />
      </Link>

      <Link href="/tg/urgent" onClick={() => haptic('medium')} className={`${CARD} mt-3 flex items-center gap-3 border-amber/40 p-4 active:bg-sand`}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-soft text-amber-ink"><LightningIcon size={22} weight="fill" aria-hidden="true" /></span>
        <span className="min-w-0"><span className="block font-bold">{t('urgent')}</span><span className="block text-xs text-muted">{t('urgentHint')}</span></span>
        <ArrowRightIcon size={18} className="ml-auto shrink-0 text-muted" aria-hidden="true" />
      </Link>

      {orders && orders.length ? (
        <section className="mt-6">
          <div className="mb-1 flex items-center justify-between"><h2 className="text-sm font-bold">{t('orders')}</h2><Link href="/tg/orders" onClick={() => haptic()} aria-label={`${t('ordersAll')}: ${t('orders')}`} className="-mr-2 inline-flex min-h-11 items-center px-2 text-xs font-semibold text-teal-ink">{t('ordersAll')}</Link></div>
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

      {/* Bo'sh joyli terminal bo'lmasa bo'lim umuman chiqmaydi: "yo'q" degan gap foydalanuvchiga hech narsa bermaydi */}
      {bookable && bookable.length ? (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold">{t('bookable')}</h2>
          <div className="tg-strip -mx-4 px-4">
            {bookable.map((x) => <div key={x.id} className="w-[272px]"><TerminalRow t={x} lang={lang} /></div>)}
          </div>
        </section>
      ) : null}
    </main>
  );
}
