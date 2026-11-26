'use client';
// Ishlarim: buyurtmalar, o'z so'rovlarim, kelgan so'rovlar va e'lonlarim bitta joyda. To'rt bo'lim parallel va mustaqil yuklanadi:
// har birining o'z skeleti va o'z xato qutisi bor, biri yiqilsa qolganlari ko'rinaveradi. Qatorlar ro'yxat sahifalaridagi bilan bir xil.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LightningIcon, MagnifyingGlassIcon, PlusIcon, TrayIcon } from '@phosphor-icons/react';
import { LISTING_LABELS } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';
import { ApiError, api } from '@/lib/api';
import { som, tonne, uzDate, uzDateTime } from '@/lib/format';
import type { OrderCard, Page } from '@/lib/types';
import type { Membership, OwnerListing } from '@/lib/types-kabinet';
import { asList, type UrgentRequest } from '@/lib/types-urgent';
import { StatusPill, slotLabel } from '@/components/order/bits';
import { SlaTimer } from '@/components/order/SlaTimer';
import { UrgentStatusPill, useUrgentLabels } from '@/components/kabinet/UrgentBits';
import { ListingStatusPill } from '@/components/kabinet/bits';
import { haptic } from '@/components/tg/TgProvider';
import { BTN, BTN_GHOST, CARD, ListingThumb, LoadError, Skeleton, listingPrice, useLang } from '@/components/tg/bits';

// keep: bo'sh bo'lsa ham bo'lim ko'rinsinmi (xizmat ko'rsatuvchi tashkilotga "kelgan so'rov yo'q" degan qator kerak)
type Got<T> = { items: T[]; keep?: boolean };
type St<T> = { s: 'load' } | { s: 'err' } | ({ s: 'ok' } & Got<T>);

const loadOrders = () => api<Page<OrderCard>>('/orders?scope=client&limit=3').then((r) => ({ items: r.items }));
const loadMine = () => api<unknown>('/urgent?scope=mine').then((r) => ({ items: asList<UrgentRequest>(r) }));
const loadListings = () => api<OwnerListing[]>('/listings/mine').then((items) => ({ items }));
/**
 * Kelgan so'rovlar faqat xizmat ko'rsatuvchilarga. 403 yoki bo'sh javob bo'lsa bo'lim yashiriladi,
 * lekin tashkiloti bor foydalanuvchiga bo'sh qator ko'rsatiladi: u bo'lim borligini bilsin.
 */
async function loadIncoming(): Promise<Got<UrgentRequest>> {
  try {
    const items = asList<UrgentRequest>(await api<unknown>('/urgent?scope=provider'));
    if (items.length) return { items };
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 403)) throw e;
  }
  const orgs = await api<Membership[]>('/orgs/mine').catch(() => [] as Membership[]);
  return { items: [], keep: orgs.length > 0 };
}

function useSection<T>(load: () => Promise<Got<T>>): [St<T>, () => void] {
  const [st, setSt] = useState<St<T>>({ s: 'load' });
  const run = useCallback(() => {
    setSt({ s: 'load' });
    load().then((r) => setSt({ s: 'ok', ...r })).catch(() => setSt({ s: 'err' }));
  }, [load]);
  useEffect(run, [run]);
  return [st, run];
}

export default function TgMyPage() {
  const t = useTranslations('tg.my');
  const [orders, reOrders] = useSection(loadOrders);
  const [mine, reMine] = useSection(loadMine);
  const [incoming, reIncoming] = useSection(loadIncoming);
  const [listings, reListings] = useSection(loadListings);
  const [allMine, setAllMine] = useState(false);

  // Bo'sh holat faqat to'rttasi ham kelib, hammasi bo'sh bo'lganda: yuklanish paytida "hech narsa yo'q" miltillamaydi
  const all = [orders, mine, incoming, listings];
  const empty = all.every((x) => x.s === 'ok' && x.items.length === 0);

  return (
    <main id="main" className="mx-auto max-w-md px-4 pb-8 pt-4">
      <h1 className="font-display text-xl font-bold">{t('title')}</h1>
      <p className="mt-0.5 text-sm text-muted">{t('lead')}</p>

      {empty ? <EmptyHub /> : null}

      <Block title={t('orders')} st={orders} retry={reOrders} aside={<AllLink href="/tg/orders" title={t('orders')} />}>
        {(items) => items.map((o) => <OrderRow key={o.no} o={o} />)}
      </Block>

      <Block
        title={t('mine')}
        st={mine}
        retry={reMine}
        aside={mine.s === 'ok' && mine.items.length > 3 && !allMine ? (
          <button type="button" onClick={() => { haptic(); setAllMine(true); }} aria-label={`${t('all')}: ${t('mine')}`} className={ASIDE}>{t('all')}</button>
        ) : null}
      >
        {(items) => (allMine ? items : items.slice(0, 3)).map((r) => <MineRow key={r.id} r={r} />)}
      </Block>

      <Block title={t('listings')} st={listings} retry={reListings} aside={<AllLink href="/tg/listings" title={t('listings')} />}>
        {(items) => (
          <>
            {items.slice(0, 3).map((l) => <ListingRow key={l.id} l={l} />)}
            <li><Link href="/tg/listings/new" onClick={() => haptic()} className={BTN_GHOST}><PlusIcon size={18} weight="bold" className="mr-1.5" aria-hidden="true" />{t('newListing')}</Link></li>
          </>
        )}
      </Block>

      {/* Kelgan so'rovlar oxirida: ko'pchilik xizmat ko'rsatuvchi emas, skelet yo'qolganda yuqoridagi bo'limlar siljimaydi */}
      <Block
        title={t('incoming')}
        st={incoming}
        retry={reIncoming}
        aside={incoming.s === 'ok' && incoming.items.length ? <AllLink href="/tg/urgent/offers" title={t('incoming')} /> : null}
        emptyLine={t('incomingEmpty')}
      >
        {(items) => items.slice(0, 3).map((r) => <IncomingRow key={r.id} r={r} />)}
      </Block>
    </main>
  );
}

// Sarlavha yonidagi matnli havola: ko'rinishi kichik, teginish maydoni 44px
const ASIDE = '-my-2 -mr-2 inline-flex min-h-11 items-center px-2 text-sm font-semibold text-teal-ink';
// aria-label ko'rinadigan "Hammasi" bilan boshlanadi va bo'lim nomini qo'shadi: ekran o'qigichda havolalar bir xil eshitilmaydi
function AllLink({ href, title }: { href: string; title: string }) {
  const t = useTranslations('tg.my');
  return <Link href={href} onClick={() => haptic()} aria-label={`${t('all')}: ${title}`} className={ASIDE}>{t('all')}</Link>;
}

/** Bitta bo'lim: yuklanayotganda skelet, xatoda qayta urinish, bo'sh bo'lsa yashirin (keep bo'lsa emptyLine). */
function Block<T>({ title, st, retry, aside, emptyLine, children }: { title: string; st: St<T>; retry: () => void; aside?: ReactNode; emptyLine?: string; children: (items: T[]) => ReactNode }) {
  const t = useTranslations('tg.my');
  if (st.s === 'ok' && st.items.length === 0 && !st.keep) return null;
  return (
    <section className="mt-6" aria-busy={st.s === 'load' || undefined}>
      <div className="mb-2 flex min-h-6 items-center justify-between gap-3"><h2 className="text-sm font-bold">{title}</h2>{st.s === 'ok' ? aside : null}</div>
      {st.s === 'load' ? <Skeleton n={2} h="h-[76px]" /> : st.s === 'err' ? (
        <LoadError onRetry={retry} />
      ) : st.items.length === 0 ? (
        <p className="rounded-card border border-dashed border-line px-4 py-3 text-sm text-muted">{emptyLine}</p>
      ) : (
        <ul className="space-y-2">{children(st.items)}</ul>
      )}
    </section>
  );
}

function EmptyHub() {
  const t = useTranslations('tg.my.empty');
  return (
    <section className={`${CARD} mt-6 p-5 text-center`}>
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-soft text-teal-ink"><TrayIcon size={28} weight="duotone" aria-hidden="true" /></span>
      <h2 className="mt-3 font-bold">{t('title')}</h2>
      <p className="mx-auto mt-1 max-w-[32ch] text-sm text-muted">{t('body')}</p>
      <div className="mt-4 space-y-2">
        <Link href="/tg/search" onClick={() => haptic()} className={BTN}><MagnifyingGlassIcon size={18} weight="bold" className="mr-1.5" aria-hidden="true" />{t('search')}</Link>
        <Link href="/tg/urgent" onClick={() => haptic()} className={BTN_GHOST}><LightningIcon size={18} weight="fill" className="mr-1.5 text-amber" aria-hidden="true" />{t('urgent')}</Link>
        <Link href="/tg/listings/new" onClick={() => haptic()} className={BTN_GHOST}><PlusIcon size={18} weight="bold" className="mr-1.5" aria-hidden="true" />{t('listing')}</Link>
      </div>
    </section>
  );
}

// Qatorlar: tg/orders, tg/urgent, tg/urgent/offers va tg/listings sahifalaridagi belgilash bilan bir xil
function OrderRow({ o }: { o: OrderCard }) {
  const t = useTranslations('tg.orders');
  const locale = useLocale();
  return (
    <li>
      <Link href={`/tg/orders/${o.no}`} onClick={() => haptic()} className={`${CARD} block p-3 active:bg-sand`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-bold">{o.no}</span>
          <StatusPill status={o.status} />
          <span className="ml-auto font-mono text-sm font-semibold tabular-nums">{som(o.totalTiyin, locale)}</span>
        </div>
        {o.status === 'PENDING' && o.slaConfirmUntil ? <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">{t('sla')} <SlaTimer until={o.slaConfirmUntil} /></p> : null}
        <p className="mt-1.5 truncate font-semibold">{o.terminal.name}</p>
        <p className="mt-0.5 truncate text-xs text-muted">{o.station.name} · {o.cargoName ?? t('noCargo')} · {tonne((o.weightKg / 1000).toLocaleString('ru-RU'), locale)}{o.slot ? ` · ${slotLabel(o.slot.startsAt, o.slot.endsAt)}` : ''}</p>
      </Link>
    </li>
  );
}

function MineRow({ r }: { r: UrgentRequest }) {
  const t = useTranslations('tg.urgent');
  const locale = useLocale();
  const L = useUrgentLabels();
  return (
    <li>
      <Link href={`/tg/urgent/${r.id}`} onClick={() => haptic()} className={`${CARD} block p-3 active:bg-sand`}>
        <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-bold">{r.no}</span><UrgentStatusPill status={r.status} /><span className="ml-auto font-mono text-xs text-muted">{t('offersCount', { count: r.offersCount ?? r.offers?.length ?? 0 })}</span></div>
        <p className="mt-1 truncate text-sm">{L.kind[r.kind] ?? r.kind} · {L.region(r.regionCode)}{r.stationName ? ` · ${r.stationName}` : ''}</p>
        <p className="mt-0.5 font-mono text-xs text-muted">{uzDateTime(r.createdAt, locale)}</p>
      </Link>
    </li>
  );
}

function IncomingRow({ r }: { r: UrgentRequest }) {
  const locale = useLocale();
  const L = useUrgentLabels();
  return (
    <li>
      <Link href={`/tg/urgent/offers?id=${r.id}`} onClick={() => haptic()} className={`${CARD} block p-3 active:bg-sand`}>
        <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-bold">{r.no}</span><UrgentStatusPill status={r.status} /><span className="ml-auto font-mono text-xs text-muted">{uzDateTime(r.createdAt, locale)}</span></div>
        <p className="mt-1 truncate text-sm font-semibold">{L.kind[r.kind] ?? r.kind} · {L.region(r.regionCode)}{r.stationName ? ` · ${r.stationName}` : ''}</p>
        <p className="mt-0.5 truncate text-sm text-muted">{r.description}</p>
      </Link>
    </li>
  );
}

// O'z e'loni uchun Mini App da alohida sahifa yo'q (tahrirlash saytda): qator E'lonlarim ro'yxatiga olib boradi
function ListingRow({ l }: { l: OwnerListing }) {
  const t = useTranslations('tg.listings');
  const tc = useTranslations('tg.common');
  const lang = useLang();
  const L = LISTING_LABELS[lang];
  return (
    <li>
      <Link href="/tg/listings" onClick={() => haptic()} className={`${CARD} flex gap-3 p-3 active:bg-sand`}>
        <ListingThumb photo={l.photo} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2"><p className="truncate font-bold">{l.title}</p><ListingStatusPill status={l.status} /></div>
          <p className="mt-0.5 truncate text-xs text-muted">{L.kind[l.kind]} · {l.priceTiyin != null ? listingPrice(l.priceTiyin, l.priceUnit, lang) : tc('onRequest')}</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted">{t('views', { count: l.views })} · {uzDate(l.updatedAt, lang)}</p>
        </div>
      </Link>
    </li>
  );
}
