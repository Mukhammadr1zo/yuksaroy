'use client';
// Menga kelgan talabnomalar: taxta (4 ustun, har 30 s yangilanadi) yoki ro'yxat.
// Har kartada shu holat uchun kerakli harakat bor, ortiqchasi yo'q. Sarlavha ota sahifada.
import { Link } from '@/i18n/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ORDER_EVENT_LABELS, ORDER_STUCK_DAYS, type OrderEventCode, type OrderStatus } from '@yuksaroy/domain';
import { ApiError, api, post } from '@/lib/api';
import { som, uzTime } from '@/lib/format';
import type { Order, OrderCard, Page } from '@/lib/types';
import type { Board, BoardColumn } from '@/lib/types-dashboard';
import { StatusPill, slotLabel } from '@/components/order/bits';
import { SlaTimer } from '@/components/order/SlaTimer';
import { CHIP, useLang } from '@/components/kabinet/bits';

type View = 'board' | 'list';
type Summary = { terminals: number; byStatus: Record<string, number> };
const COLS = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'DONE'] as const satisfies readonly BoardColumn[];
const DOT: Record<(typeof COLS)[number], string> = { PENDING: 'bg-amber', CONFIRMED: 'bg-teal', IN_PROGRESS: 'bg-navy', DONE: 'bg-teal-ink/40' };
const TABS: { key: string; status: OrderStatus[] }[] = [
  { key: 'PENDING', status: ['PENDING'] },
  { key: 'CONFIRMED', status: ['CONFIRMED'] },
  { key: 'IN_PROGRESS', status: ['IN_PROGRESS'] },
  { key: 'CLOSED', status: ['DONE', 'REJECTED', 'EXPIRED', 'CANCELLED'] },
];
const EVENTS: Record<'LOAD' | 'UNLOAD', OrderEventCode[]> = {
  LOAD: ['ARRIVED', 'WEIGHED', 'LOADED', 'DEPARTED'],
  UNLOAD: ['ARRIVED', 'UNLOADED', 'WEIGHED', 'DEPARTED'],
};

export function TerminalBoard() {
  const t = useTranslations('dashboard2.board');
  const [view, setView] = useState<View>('board');
  const [tab, setTab] = useState('PENDING');
  const [terminals, setTerminals] = useState(1);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const loadCounts = useCallback(async () => {
    const s = await api<Summary>('/orders/summary');
    setCounts(s.byStatus); setTerminals(s.terminals);
  }, []);
  useEffect(() => { loadCounts().catch(() => {}); }, [loadCounts]);

  if (terminals === 0) {
    return <p className="rounded-card border border-dashed border-line bg-white p-10 text-center text-muted">{t.rich('noTerminal', { link: (c) => <Link href="/terminals" className="underline">{c}</Link> })}</p>;
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{t('lead')}</p>
        <div role="group" aria-label={t('view.board')} className="flex rounded-full border border-line bg-white p-0.5">
          {(['board', 'list'] as View[]).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${view === v ? 'bg-navy text-white' : 'text-muted hover:text-ink'}`}>
              {t(`view.${v}`)}
            </button>
          ))}
        </div>
      </div>

      {view === 'board'
        ? <BoardView onChange={loadCounts} showClosed={() => { setTab('CLOSED'); setView('list'); }} />
        : <ListView tab={tab} setTab={setTab} counts={counts} onChange={loadCounts} />}
    </>
  );
}

function BoardView({ onChange, showClosed }: { onChange: () => Promise<void>; showClosed: () => void }) {
  const t = useTranslations('dashboard2.board');
  const [board, setBoard] = useState<Board | null>(null);
  const [at, setAt] = useState<Date | null>(null);
  const [err, setErr] = useState(false);

  const load = useCallback(() => api<Board>('/orders/board?scope=terminal').then((b) => { setBoard(b); setAt(new Date()); setErr(false); }).catch(() => setErr(true)), []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load]);
  const refresh = useCallback(() => { void load(); void onChange().catch(() => {}); }, [load, onChange]);

  return (
    <>
      {err ? <p role="alert" className="mt-6 text-sm text-red-700">{t('loadFailed')}</p> : null}
      {!board && !err ? <p className="mt-6 text-sm text-muted">{t('loading')}</p> : null}
      {board ? (
        <>
          <div className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 no-scrollbar xl:snap-none">
            {COLS.map((col) => {
              const cards = board.columns[col];
              return (
                <section key={col} aria-label={t(`col.${col}`)} className="flex w-[300px] shrink-0 snap-start flex-col rounded-card border border-line bg-white xl:w-auto xl:min-w-0 xl:flex-1">
                  <header className="flex items-center gap-2 border-b border-line px-4 py-3">
                    <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${DOT[col]}`} />
                    <h2 className="font-semibold">{t(`col.${col}`)}</h2>
                    <span className="ml-auto font-mono text-sm tabular-nums text-muted">{board.counts[col]}</span>
                  </header>
                  <ul className="flex-1 space-y-2 bg-sand/70 p-2">
                    {cards.map((c) => <li key={c.no}><OrderRow card={c} onDone={refresh} compact /></li>)}
                    {cards.length === 0 ? <li className="py-10 text-center text-sm text-muted">{t('emptyCol')}</li> : null}
                  </ul>
                </section>
              );
            })}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 font-mono text-xs text-muted">
            {at ? <span>{t('updated', { time: uzTime(at) })}</span> : null}
            {board.counts.OTHER ? <span>{t('other', { n: board.counts.OTHER })} <button type="button" onClick={showClosed} className="underline hover:text-ink">{t('showClosed')}</button></span> : null}
          </p>
        </>
      ) : null}
    </>
  );
}

function ListView({ tab, setTab, counts, onChange }: { tab: string; setTab: (k: string) => void; counts: Record<string, number>; onChange: () => Promise<void> }) {
  const t = useTranslations('dashboard2.board');
  const [items, setItems] = useState<OrderCard[] | null>(null);
  const [err, setErr] = useState(false);

  const load = useCallback(async () => {
    const cur = TABS.find((x) => x.key === tab)!;
    const [page] = await Promise.all([api<Page<OrderCard>>(`/orders?scope=terminal&limit=50&status=${cur.status.join(',')}`), onChange()]);
    setItems(page.items);
  }, [tab, onChange]);

  useEffect(() => { setItems(null); load().catch(() => setErr(true)); }, [load]);
  // Faqat yangi talabnomalar navbati o'zi yangilanadi: boshqa bo'limlarda xodim ishlab turgan karta yo'qolmasin
  useEffect(() => {
    if (tab !== 'PENDING') return;
    const timer = setInterval(() => void load().catch(() => {}), 30_000);
    return () => clearInterval(timer);
  }, [tab, load]);

  return (
    <>
      <div className="mt-5 flex flex-wrap gap-2">
        {TABS.map((x) => {
          const n = x.status.reduce((a, s) => a + (counts[s] ?? 0), 0);
          return (
            <button key={x.key} type="button" onClick={() => setTab(x.key)} aria-pressed={tab === x.key} className={CHIP(tab === x.key)}>
              {t(`col.${x.key}`)}{n ? <span className={`ml-1.5 font-mono text-xs ${tab === x.key ? 'text-white/70' : 'text-muted'}`}>{n}</span> : null}
            </button>
          );
        })}
      </div>

      {err ? <p role="alert" className="mt-6 text-sm text-red-700">{t('loadFailed')}</p> : null}
      {!items && !err ? <p className="mt-6 text-sm text-muted">{t('loading')}</p> : null}
      {items?.length === 0 ? <p className="mt-6 rounded-card border border-dashed border-line bg-white p-10 text-center text-muted">{t('empty')}</p> : null}

      <ul className="mt-6 max-w-5xl space-y-3">
        {items?.map((o) => <li key={o.no}><OrderRow card={o} onDone={() => void onChange().catch(() => {})} /></li>)}
      </ul>
    </>
  );
}

/** Bitta talabnoma: holatga mos tez harakatlar. `compact`: taxta ustuni uchun tor joylashuv. */
function OrderRow({ card, onDone, compact }: { card: OrderCard; onDone: () => void; compact?: boolean }) {
  const lang = useLang();
  const t = useTranslations('dashboard2.board');
  const [o, setO] = useState<OrderCard | Order>(card);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<OrderEventCode[]>([]);

  useEffect(() => { setO(card); }, [card]);

  async function act(path: string, body: unknown, tag: string) {
    setBusy(tag); setErr(null);
    try { setO(await post<Order>(`/orders/${card.no}/${path}`, body)); onDone(); }
    catch (e) {
      const code = e instanceof ApiError ? String(e.body?.code ?? '') : '';
      // WRONG_ACTOR ham "holat o'zgargan": eski sahifada CONFIRMED dan yakunlash bosilsa shu keladi
      // (jadvalda CONFIRMED -> DONE endi faqat mijozniki), qayta urinish esa hech qachon yordam bermaydi
      setErr(code === 'TRANSITION_NOT_ALLOWED' || code === 'TRANSITION_WRONG_ACTOR' ? t('err.TRANSITION_NOT_ALLOWED')
        : code === 'ORDER_NOT_ACTIVE' ? t(`err.${code}`)
        : code === 'NO_SHOW_TOO_LATE' ? t('err.NO_SHOW_TOO_LATE', { days: ORDER_STUCK_DAYS }) : t('err.failed'));
      // Optimistik belgi qaytariladi: tag hodisa kodi bilan bir xil, boshqa amallar uchun zararsiz
      setDone((d) => d.filter((x) => x !== tag));
    } finally { setBusy(null); }
  }

  const s = o.status;
  // Muddatni server beradi (noShowUntil): undan keyin "Kelmadi" rad etiladi, shuning uchun tugma chiqmaydi
  const noShow = s === 'CONFIRMED' && !(o.noShowUntil && Date.parse(o.noShowUntil) <= Date.now());
  return (
    <article className={`rounded-card border border-line bg-white ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link href={`/dashboard/orders/${o.no}`} className="font-mono text-sm font-bold hover:underline">{o.no}</Link>
        {compact ? null : <StatusPill status={s} />}
        {s === 'PENDING' && o.slaConfirmUntil ? <SlaTimer until={o.slaConfirmUntil} prefix={t('sla')} onExpire={onDone} /> : null}
        <span className="ml-auto font-mono font-semibold tabular-nums">{som(o.totalTiyin, lang)}</span>
      </div>

      <p className="mt-2 font-semibold">{o.shipper.name}</p>
      <p className="mt-0.5 text-sm text-muted">
        {o.operation === 'LOAD' ? t('load') : t('unload')} · {o.cargoName ?? t('noCargo')} · {(o.weightKg / 1000).toLocaleString('ru-RU')} t · {o.wagonCount} {t('wagons')}
      </p>
      {o.slot ? <p className="mt-0.5 font-mono text-sm tabular-nums">{slotLabel(o.slot.startsAt, o.slot.endsAt)}</p> : null}

      {err ? <p role="alert" className="mt-2 text-sm text-red-700">{err}</p> : null}

      {s === 'PENDING' ? (
        rejecting ? (
          <div className="mt-3 space-y-2">
            <label className="block text-sm font-semibold">{t('rejectReason')}
              <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder={t('rejectPlaceholder')} className="mt-1 w-full rounded-xl border border-field px-4 py-2.5 text-base font-normal" />
            </label>
            <div className="flex gap-2">
              <button type="button" disabled={!reason.trim() || busy === 'reject'} onClick={() => act('reject', { reason: reason.trim() }, 'reject')} className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">{t('reject')}</button>
              <button type="button" onClick={() => setRejecting(false)} className="rounded-full border border-line px-5 py-2 text-sm font-semibold hover:bg-sand">{t('cancel')}</button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy === 'confirm'} onClick={() => act('confirm', {}, 'confirm')} className="rounded-full bg-teal px-6 py-2 text-sm font-semibold text-white transition hover:bg-teal-ink active:scale-[0.98] disabled:opacity-60">
              {busy === 'confirm' ? t('confirming') : t('confirm')}
            </button>
            <button type="button" onClick={() => setRejecting(true)} className="rounded-full border border-line px-5 py-2 text-sm font-semibold hover:bg-sand">{t('reject')}</button>
          </div>
        )
      ) : null}

      {s === 'CONFIRMED' || s === 'IN_PROGRESS' ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {EVENTS[o.operation].map((c) => (
            <button
              key={c} type="button" disabled={busy === c || done.includes(c)}
              onClick={() => { setDone((d) => [...d, c]); void act('events', { code: c }, c); }}
              className="rounded-full border border-line px-3 py-1.5 text-sm transition hover:border-navy hover:bg-sand disabled:opacity-40"
            >
              {ORDER_EVENT_LABELS[lang][c]}
            </button>
          ))}
          {/* Ajratgich faqat ortidan tugma kelsa: aks holda qator oxirida yolg'iz chiziq qolardi */}
          {s === 'IN_PROGRESS' || noShow ? <span className="mx-1 h-5 w-px bg-line" /> : null}
          {/* Yakunlash faqat ish boshlangandan keyin: holat-mashinasida terminal CONFIRMED dan
              DONE ga o'ta olmaydi, birinchi hodisa (masalan "Yetib keldi") buyurtmani boshlaydi.
              Ilgari tugma CONFIRMED da ham turardi va har bosilganda xato berardi. */}
          {s === 'IN_PROGRESS' ? (
            <button type="button" disabled={busy === 'complete'} onClick={() => act('complete', {}, 'complete')} className="rounded-full bg-navy px-5 py-1.5 text-sm font-semibold text-white transition hover:bg-navy-2 disabled:opacity-60">{t('complete')}</button>
          ) : null}
          {/* Muddat o'tgach tugma o'rnida sababi turadi: aks holda xodim "Kelmadi" nega yo'qolganini bilmaydi.
              Xato chiqib turganda yashirin: eski kartadagi tugma rad etilsa aynan shu matn qizilda turadi */}
          {noShow ? (
            <button type="button" disabled={busy === 'NO_SHOW'} onClick={() => act('events', { code: 'NO_SHOW' }, 'NO_SHOW')} className="text-sm text-muted underline hover:text-red-700">{t('noShow')}</button>
          ) : s === 'CONFIRMED' && !err ? (
            <span className="basis-full text-xs text-muted">{t('err.NO_SHOW_TOO_LATE', { days: ORDER_STUCK_DAYS })}</span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
