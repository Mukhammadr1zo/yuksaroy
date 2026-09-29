'use client';
/**
 * Pul 3.0 (faqat ega): takroriy pul (MRR), tugayotganlar, bank bilan solishtiruv, bekorlar.
 *
 * To'rt yorliq bitta manzilda (?tab=): har biri o'z so'rovini faqat ochilganda yuboradi,
 * filtrlari URL da (useListQuery), shunda "30 kunda tugayotganlar" havolasi ulashiladi va
 * bosh sahifadagi karta to'g'ri yorliqqa olib keladi.
 *
 * Qoida: har son yonida qaror matni (revenue.decision.*) yoki son chizilmaydi. To'lovsiz
 * bazada kartalar umuman yo'q: nolga qarab qaror chiqmaydi. Sonlar tiyin, ekranga so'm.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { BellRingingIcon } from '@phosphor-icons/react';
import { Link } from '@/i18n/navigation';
import { ApiError, api, post } from '@/lib/api';
import { num, som, uzDate, uzDateTime, uzMonthYear } from '@/lib/format';
import { phoneDisplay } from '@/components/ui/fields';
import {
  BTN, BTN_GHOST, CARD, type Col, DataTable, ExportLink, INPUT, Labeled, LoadError, type MenuItem, Notice, PageHead, Pager, type Paged, Pill,
  Skeleton, Toolbar, errText, useActionText, useAdminList, useListQuery,
} from '@/components/admin/kit';
import { useAdminMe } from '@/components/admin/context';

type Person = { id: string; fullName: string | null; phone: string | null };
type RevenueMonth = {
  month: string; totalTiyin: number; subsTiyin: number; premiumTiyin: number; payments: number; renewals: number;
  mrrTiyin: number; activeUsers: number; newUsers: number; churnedUsers: number;
  /** Joriy oy: oy oxirigacha uzaytirganlar keyin qo'shiladi */
  forecast: boolean;
};
type Revenue = {
  now: { mrrTiyin: number; activeUsers: number; mrrEndTiyin: number; activeEndUsers: number; atRiskUsers: number; atRiskTiyin: number };
  /** 12 oy, yangisi birinchi, to'lovsiz oy nol bilan */
  months: RevenueMonth[];
};
type Expiring = {
  id: string; no: string; months: number; amountTiyin: number; endsAt: string; remindedAt: string | null; lastManualAt: string | null; remindedToday: boolean;
  user: Person; plan: { code: string; name: Record<string, string> } | null;
};
type Reconcile = {
  id: string; at: string; subscriptionId: string; no: string | null; user: Person | null;
  expectedTiyin: number | null; receivedTiyin: number | null; payRef: string | null; actor: Person | null;
};
type Refund = {
  id: string; at: string; action: 'subscription.revoke' | 'subscription.cancel'; subscriptionId: string; no: string | null; amountTiyin: number | null;
  moneyReceived: boolean | null; reason: string | null; wasEndsAt: string | null; user: Person | null; actor: Person | null;
};
// useAdminList tanani Paged deb yozadi, server esa summary ni ham qo'shib beradi: shu yerda kengaytiriladi
type ExpPage = Paged<Expiring> & { summary: { count: number; amountTiyin: number } };
type RecPage = Paged<Reconcile> & { summary: { confirmed: number; expectedTiyin: number; receivedTiyin: number; noReceived: number; diffCount: number; shortTiyin: number; overTiyin: number } };
type RefPage = Paged<Refund> & { summary: { revokes: number; revokesPaid: number; revokesPaidTiyin: number; cancels: number } };

const TABS = ['overview', 'expiring', 'reconcile', 'refunds'] as const;
type Tab = (typeof TABS)[number];
const DAYS = [7, 14, 30];
const LIMIT = 30;
const DAY = 86_400_000;
const F0 = { tab: 'overview', days: 7, q: '', diff: '', kind: '', page: 1 };
/** Sarlavhadagi eksport havolasi: yorliq o'z yo'li, filtri va jami sonini yuqoriga aytadi. */
type Exp = { path: string; filters: Record<string, string | number | undefined>; total: number };
type TabProps = { f: typeof F0; set: (patch: Partial<typeof F0>) => void; onExport: (tab: Tab, e: Exp) => void };
/** Har ustunga bir qator izoh: son nimaga kerakligi jadval ostida turadi. */
const LEGEND = ['total', 'subs', 'payments', 'renewals', 'mrr', 'active', 'new', 'churned'] as const;

const chip = (on: boolean) => `shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors duration-150 ${on ? 'bg-navy text-white' : 'border border-line bg-white text-muted hover:border-teal hover:text-ink'}`;
const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / DAY));

/** Foiz farqi nishoni (bosh sahifadagi nusxasi). Oldingi nol bo'lsa foiz yo'q: "yangi". warnAt: shundan past tushish sariq. */
function Delta({ cur, prev, warnAt }: { cur: number; prev: number; warnAt: number }) {
  const th = useTranslations('admin.home');
  if (!prev) return cur > 0 ? <Pill tone="ok">{th('deltaNew')}</Pill> : null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  return <Pill tone={pct > 0 ? 'ok' : pct < warnAt ? 'warn' : 'neutral'}>{th('delta', { pct: pct > 0 ? `+${pct}` : String(pct) })}</Pill>;
}

/** Bitta son kartasi (bosh sahifadagi Stat nusxasi): son, nomi, taqqos satri, nishon va qaror matni. */
function Stat({ href, value, label, sub, pill, note }: {
  href?: string; value: React.ReactNode; label: string; sub?: React.ReactNode; pill?: React.ReactNode; note?: React.ReactNode;
}) {
  const cls = `${CARD} block min-w-0 p-4 ${href ? 'transition duration-150 hover:-translate-y-0.5 hover:border-teal hover:shadow-md' : ''}`;
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="font-display text-2xl font-bold tabular-nums text-navy">{value}</span>
        {pill}
      </div>
      <span className="mt-0.5 block text-sm text-ink">{label}</span>
      {sub ? <span className="mt-1 block font-mono text-[11px] text-muted">{sub}</span> : null}
      {note ? <span className="mt-2 block text-xs text-muted">{note}</span> : null}
    </>
  );
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

/** Odam kataki: ism (yo'q bo'lsa "Ism yozilmagan"), ostida telefon, butun katak foydalanuvchi sahifasiga. */
function PersonCell({ p }: { p: Person | null }) {
  const ts = useTranslations('admin.subs');
  if (!p) return <span className="text-muted">-</span>;
  return (
    <Link href={`/admin/users/${p.id}`} className="block hover:underline">
      <span className="block font-semibold text-navy">{p.fullName || ts('noName')}</span>
      {p.phone ? <span className="block font-mono text-[11px] text-muted">{phoneDisplay(p.phone)}</span> : null}
    </Link>
  );
}

/** Uch yorliqda bir xil qator menyusi: obuna varag'i, foydalanuvchi, jurnal. */
function useRowMenu() {
  const tm = useTranslations('admin.revenue.menu');
  return (subId: string, userId?: string | null): MenuItem[] => [
    { label: tm('open'), href: `/admin/subscriptions?open=${subId}` },
    ...(userId ? [{ label: tm('user'), href: `/admin/users/${userId}` }] : []),
    { label: tm('history'), href: `/admin/audit?entity=Subscription&entityId=${subId}` },
  ];
}

export default function AdminRevenuePage() {
  const t = useTranslations('admin');
  const tr = useTranslations('admin.revenue');
  const { isOwner } = useAdminMe();
  const { f, set } = useListQuery(F0);
  const tab: Tab = (TABS as readonly string[]).includes(f.tab) ? (f.tab as Tab) : 'overview';
  const [exp, setExp] = useState<(Exp & { tab: Tab }) | null>(null);
  const onExport = useCallback((k: Tab, e: Exp) => setExp({ tab: k, ...e }), []);

  // Operator uchun so'rov umuman ketmaydi: server 403 berardi, ekranda esa "faqat ega" matni yetadi (tizim sahifasi bilan bir xil)
  if (!isOwner) return <Notice tone="warn">{t('forbidden')}</Notice>;

  // Yorliq almashganda filtrlar sukutga: "faqat farqli" bekorlar yorlig'ida ma'nosiz. replace: tarixda iz qolmasin
  const go = (k: Tab) => set({ tab: k, days: 7, q: '', diff: '', kind: '' }, 'replace');
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const i = (TABS.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
    go(TABS[i]!);
    (e.currentTarget.children[i] as HTMLElement | undefined)?.focus();
  };

  return (
    <>
      <PageHead title={t('nav.revenue')} lead={tr('lead')}>
        {exp && exp.tab === tab ? <ExportLink path={exp.path} filters={exp.filters} total={exp.total} /> : null}
      </PageHead>

      {/* Yorliqlar telefonda yon tomonga aylanadi: to'rtta nom bir qatorga sig'maydi, sahifa esa surilmasin */}
      <div className="mt-5 flex gap-2 overflow-x-auto pb-1" onKeyDown={onKey}>
        {TABS.map((k) => (
          <button key={k} type="button" aria-pressed={tab === k} onClick={() => go(k)} className={chip(tab === k)}>{tr(`tabs.${k}`)}</button>
        ))}
      </div>

      {tab === 'overview' ? <Overview onExport={onExport} />
        : tab === 'expiring' ? <ExpiringTab f={f} set={set} onExport={onExport} />
        : tab === 'reconcile' ? <ReconcileTab f={f} set={set} onExport={onExport} />
        : <RefundsTab f={f} set={set} onExport={onExport} />}
    </>
  );
}

/** Umumiy: to'rt karta (hozir, oy oxiri, xavf, shu oy tushum) va 12 oylik jadval. */
function Overview({ onExport }: { onExport: TabProps['onExport'] }) {
  const tr = useTranslations('admin.revenue');
  const locale = useLocale();
  const [data, setData] = useState<Revenue | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setData(null); setErr(null);
    api<Revenue>('/admin/revenue').then(setData).catch(setErr);
  }, [tick]);
  useEffect(() => { if (data) onExport('overview', { path: '/admin/revenue', filters: {}, total: data.months.length }); }, [data, onExport]);

  if (err) return <LoadError err={err} onRetry={() => setTick((n) => n + 1)} />;
  if (!data) {
    return (
      <>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className={`${CARD} p-4`}><Skeleton rows={3} /></div>)}
        </div>
        <div className={`${CARD} mt-4 p-4`}><Skeleton rows={6} /></div>
      </>
    );
  }
  const { now, months } = data;
  // Hech qachon to'lov bo'lmagan: nol kartalar qaror bermaydi, bitta bo'sh holat yetadi
  if (months.every((m) => !m.totalTiyin && !m.mrrTiyin)) {
    return <div className={`${CARD} mt-5 border-dashed px-6 py-12 text-center text-sm text-muted`}>{tr('empty')}</div>;
  }
  const cur = months[0]!;
  const prev = months[1];
  const hasPremium = months.some((m) => m.premiumTiyin > 0);
  // Oy kaliti "2026-09": kun o'rtasi olinadi, shunda hech bir mintaqada oy chegarasidan sakramaydi
  const label = (m: string) => uzMonthYear(new Date(`${m}-01T12:00:00Z`), locale);
  const cols: Col<RevenueMonth>[] = [
    { key: 'month', head: tr('month'), cell: (r) => <span className="inline-flex flex-wrap items-center gap-1.5">{label(r.month)}{r.forecast ? <Pill tone="neutral">{tr('forecast')}</Pill> : null}</span> },
    { key: 'total', head: tr('total'), num: true, cell: (r) => som(r.totalTiyin, locale) },
    { key: 'subs', head: tr('subs'), num: true, cell: (r) => som(r.subsTiyin, locale) },
    ...(hasPremium ? [{ key: 'premium', head: tr('premium'), num: true, cell: (r: RevenueMonth) => som(r.premiumTiyin, locale) }] : []),
    { key: 'payments', head: tr('payments'), num: true, cell: (r) => num(r.payments, locale) },
    { key: 'renewals', head: tr('renewals'), num: true, cell: (r) => num(r.renewals, locale) },
    { key: 'mrr', head: tr('cols.mrr'), num: true, cell: (r) => som(r.mrrTiyin, locale) },
    { key: 'active', head: tr('cols.active'), num: true, cell: (r) => num(r.activeUsers, locale) },
    { key: 'new', head: tr('cols.new'), num: true, cell: (r) => num(r.newUsers, locale) },
    // Ketgan yangidan ko'p bo'lsa qizil: o'sish emas, oqish
    { key: 'churned', head: tr('cols.churned'), num: true, cell: (r) => <span className={r.churnedUsers > r.newUsers ? 'font-semibold text-red-700' : ''}>{num(r.churnedUsers, locale)}</span> },
  ];

  return (
    <>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat value={som(now.mrrTiyin, locale)} label={tr('mrrNow')} sub={tr('activeNow', { n: now.activeUsers })} note={tr('decision.mrr')} />
        {/* Nishon faqat tushganda: oy oxirida ko'p qolsa bu yaxshi holat, unga belgi kerak emas */}
        <Stat value={som(now.mrrEndTiyin, locale)} label={tr('mrrEnd')} sub={tr('activeEnd', { n: now.activeEndUsers })}
          pill={now.mrrEndTiyin < now.mrrTiyin ? <Delta cur={now.mrrEndTiyin} prev={now.mrrTiyin} warnAt={0} /> : null} note={tr('decision.mrrEnd')} />
        <Stat href="/admin/revenue?tab=expiring&days=30" value={num(now.atRiskUsers, locale)} label={tr('atRisk')}
          sub={tr('atRiskSub', { n: now.atRiskUsers, sum: som(now.atRiskTiyin, locale) })} note={tr('decision.atRisk')} />
        <Stat value={som(cur.totalTiyin, locale)} label={tr('revenueMonth')} sub={prev ? tr('prevMonth', { sum: som(prev.totalTiyin, locale) }) : undefined}
          pill={prev ? <Delta cur={cur.totalTiyin} prev={prev.totalTiyin} warnAt={0} /> : null}
          note={<>{tr('decision.revenue')} <Link href="/admin/moderation?tab=subscription" className="font-semibold text-teal-ink hover:underline">{tr('pendingLink')}</Link></>} />
      </div>

      <DataTable cols={cols} rows={months} keyOf={(r) => r.month} empty={tr('empty')} screen="revenue" />
      <ul className="mt-3 space-y-1 text-xs text-muted">
        {LEGEND.map((k) => <li key={k}>{tr(`decision.col.${k}`)}</li>)}
        {!hasPremium ? <li>{tr('noPremium')}</li> : null}
      </ul>
    </>
  );
}

/** Tugayotganlar: 7/14/30 kun oynasi, qatorda qo'lda eslatma tugmasi. Uzaytirgan odam serverda chiqarib tashlangan. */
function ExpiringTab({ f, set, onExport }: TabProps) {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const tr = useTranslations('admin.revenue');
  const locale = useLocale();
  const menu = useRowMenu();
  const days = DAYS.includes(f.days) ? f.days : 7;
  const { data, pages, loading, err, reload } = useAdminList<Expiring>('/admin/revenue/expiring', { days, page: f.page, limit: LIMIT });
  const summary = (data as ExpPage | null)?.summary;
  useEffect(() => { if (data) onExport('expiring', { path: '/admin/revenue/expiring', filters: { days }, total: data.total }); }, [data, days, onExport]);

  // Yuborilgan eslatma qatorga darhol yoziladi, ro'yxat qayta so'ralmaydi: id -> sentAt;
  // null = faqat "bugun yuborilgan" belgisi (409: bugun avto eslatma ketgan, qo'lda vaqt o'zgarmaydi)
  const [sent, setSent] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const rows = useMemo(
    () => (data?.items ?? []).map((r) => (r.id in sent ? { ...r, lastManualAt: sent[r.id] ?? r.lastManualAt, remindedToday: true } : r)),
    [data, sent],
  );

  /** Bir bosqichli: qaytarilmas zarar yo'q, kunlik chegara serverda. */
  async function remind(r: Expiring) {
    setBusy(r.id); setMsg(null);
    try {
      const { sentAt } = await post<{ sentAt: string }>(`/admin/subscriptions/${r.id}/remind`, {});
      setSent((s) => ({ ...s, [r.id]: sentAt }));
      setMsg({ tone: 'ok', text: tr('expiring.sent', { phone: phoneDisplay(r.user.phone ?? '') }) });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && (e.body as { code?: string } | null)?.code === 'REMIND_TODAY') setSent((s) => ({ ...s, [r.id]: null }));
      setMsg({ tone: 'err', text: errText(e, t, t.has, tc('saveFailed')) });
    } finally { setBusy(null); }
  }

  const cols: Col<Expiring>[] = [
    {
      key: 'endsAt', head: tr('expiring.endsAt'),
      cell: (r) => {
        const d = daysLeft(r.endsAt);
        return (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs">{uzDate(r.endsAt, locale)}</span>
            <Pill tone={d <= 3 ? 'bad' : d <= 7 ? 'warn' : 'neutral'}>{tr('expiring.daysLeft', { n: d })}</Pill>
          </span>
        );
      },
    },
    { key: 'user', head: tr('expiring.user'), cell: (r) => <PersonCell p={r.user} /> },
    { key: 'plan', head: tr('expiring.plan'), cell: (r) => r.plan?.name?.[locale] ?? r.plan?.name?.uz ?? r.plan?.code ?? '-' },
    { key: 'amount', head: tr('expiring.amount'), num: true, cell: (r) => <>{som(r.amountTiyin, locale)} <span className="text-[11px] text-muted">{tr('expiring.monthsShort', { n: r.months })}</span></> },
    { key: 'auto', head: tr('expiring.autoReminded'), hideable: true, cell: (r) => (r.remindedAt ? <span className="font-mono text-xs">{uzDate(r.remindedAt, locale)}</span> : '-') },
    { key: 'manual', head: tr('expiring.manualReminded'), cell: (r) => (r.lastManualAt ? <span className="font-mono text-xs">{uzDateTime(r.lastManualAt, locale)}</span> : '-') },
    {
      key: 'act', head: tc('actions'),
      cell: (r) => (
        <button type="button" disabled={r.remindedToday || busy === r.id} onClick={() => void remind(r)} className={`${BTN_GHOST} w-full whitespace-nowrap px-3 py-1 text-xs sm:w-auto`}>
          <BellRingingIcon size={14} aria-hidden="true" />
          {tr(r.remindedToday ? 'expiring.remindedToday' : 'expiring.remind')}
        </button>
      ),
    },
  ];

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {DAYS.map((n) => <button key={n} type="button" aria-pressed={days === n} onClick={() => set({ days: n })} className={chip(days === n)}>{tr('expiring.days', { n })}</button>)}
      </div>
      {err ? <LoadError err={err} onRetry={reload} /> : null}
      {summary ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-navy">{tr('expiring.summary', { count: summary.count, sum: som(summary.amountTiyin, locale), days })}</span>
          {summary.count > 0 ? <Pill tone="warn">{num(summary.count, locale)}</Pill> : null}
        </div>
      ) : null}
      <p className="mt-1 text-xs text-muted">{tr('decision.expiring')}</p>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <DataTable cols={cols} rows={rows} keyOf={(r) => r.id} empty={tr('expiring.empty')} loading={loading} screen="revenue-expiring" rowMenu={(r) => menu(r.id, r.user.id)} />
      <Pager page={f.page} pages={pages} onPage={(p) => set({ page: p })} />
    </>
  );
}

/** PAY solishtiruvi: tasdiqlangan to'lovlarda kutilgan va kelgan summa, bank ko'chirmasi bilan tekshirish uchun. */
function ReconcileTab({ f, set, onExport }: TabProps) {
  const tc = useTranslations('admin.common');
  const tr = useTranslations('admin.revenue');
  const ts = useTranslations('admin.subs');
  const locale = useLocale();
  const menu = useRowMenu();
  const diff = f.diff === '1' || f.diff === 'none' ? f.diff : '';
  const { data, pages, loading, err, reload } = useAdminList<Reconcile>('/admin/revenue/reconcile', { q: f.q, diff, page: f.page, limit: LIMIT });
  const s = (data as RecPage | null)?.summary;
  const [q, setQ] = useState(f.q);
  useEffect(() => setQ(f.q), [f.q]);
  useEffect(() => { if (data) onExport('reconcile', { path: '/admin/revenue/reconcile', filters: { q: f.q, diff }, total: data.total }); }, [data, f.q, diff, onExport]);

  const cols: Col<Reconcile>[] = [
    { key: 'at', head: tr('reconcile.at'), cell: (r) => <span className="font-mono text-xs">{uzDateTime(r.at, locale)}</span> },
    // Obuna o'chgan bo'lsa raqam yo'q (LEFT JOIN): tasdiq qatori baribir ko'rinadi
    { key: 'no', head: ts('no'), cell: (r) => (r.no ? <Link href={`/admin/subscriptions?open=${r.subscriptionId}`} className="font-mono text-xs font-semibold text-navy hover:underline">{r.no}</Link> : '-') },
    { key: 'user', head: tr('reconcile.user'), cell: (r) => <PersonCell p={r.user} /> },
    { key: 'expected', head: tr('reconcile.expectedCol'), num: true, cell: (r) => (r.expectedTiyin == null ? '-' : som(r.expectedTiyin, locale)) },
    {
      key: 'received', head: tr('reconcile.receivedCol'), num: true,
      cell: (r) => {
        if (r.receivedTiyin == null) return <span className="text-muted">{tr('reconcile.notEntered')}</span>;
        const d = r.expectedTiyin == null ? 0 : r.receivedTiyin - r.expectedTiyin;
        return (
          <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
            {som(r.receivedTiyin, locale)}
            {/* Kam kelgan qizil (pul yo'qolgan), ko'p kelgan sariq (qaytarish savoli) */}
            {d ? <Pill tone={d < 0 ? 'bad' : 'warn'}>{d < 0 ? '-' : '+'}{num(Math.round(Math.abs(d) / 100), locale)}</Pill> : null}
          </span>
        );
      },
    },
    { key: 'payRef', head: tr('reconcile.payRef'), hideable: true, cell: (r) => (r.payRef ? <span className="font-mono text-xs">{r.payRef}</span> : '-') },
    { key: 'actor', head: tr('reconcile.operator'), cell: (r) => r.actor?.fullName || (r.actor?.phone ? phoneDisplay(r.actor.phone) : '-') },
  ];

  return (
    <>
      <Toolbar onSubmit={() => set({ q: q.trim() })}>
        <Labeled label={tc('search')} className="w-full sm:w-72">
          <input data-search="1" className={INPUT} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('reconcile.searchHint')} />
        </Labeled>
        <Labeled label={tr('reconcile.filter')} className="w-full sm:w-56">
          <select className={INPUT} value={diff} onChange={(e) => set({ diff: e.target.value })}>
            <option value="">{tr('reconcile.all')}</option>
            <option value="1">{tr('reconcile.onlyDiff')}</option>
            <option value="none">{tr('reconcile.noReceived')}</option>
          </select>
        </Labeled>
        <button type="submit" className={BTN}>{tc('apply')}</button>
      </Toolbar>
      {err ? <LoadError err={err} onRetry={reload} /> : null}
      {s ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat value={num(s.confirmed, locale)} label={tr('reconcile.confirmed')} sub={tr('reconcile.expected', { sum: som(s.expectedTiyin, locale) })} note={tr('decision.expected')} />
          <Stat value={som(s.receivedTiyin, locale)} label={tr('reconcile.received')}
            sub={[s.shortTiyin > 0 ? tr('reconcile.short', { sum: som(s.shortTiyin, locale) }) : null, s.overTiyin > 0 ? tr('reconcile.over', { sum: som(s.overTiyin, locale) }) : null].filter(Boolean).join(', ') || undefined}
            note={tr('decision.received')} />
          <Stat value={num(s.diffCount, locale)} label={tr('reconcile.diffCount')} note={tr('decision.diff')} />
          <Stat value={num(s.noReceived, locale)} label={tr('reconcile.noReceivedCount')}
            pill={s.noReceived > 0 ? <Pill tone="warn">{tr('reconcile.notEntered')}</Pill> : null} note={tr('decision.noReceived')} />
        </div>
      ) : null}
      {/* Farqli filtrda bo'sh ro'yxat yaxshi xabar: ko'chirma bilan mos */}
      <DataTable cols={cols} rows={data?.items ?? []} keyOf={(r) => r.id} empty={tr(diff === '1' ? 'reconcile.emptyDiff' : 'reconcile.empty')} loading={loading}
        screen="revenue-reconcile" rowMenu={(r) => menu(r.subscriptionId, r.user?.id)} />
      <Pager page={f.page} pages={pages} onPage={(p) => set({ page: p })} />
    </>
  );
}

/** Bekorlar: bekor qilingan tasdiq (pul kelgan bo'lsa qaytarish savoli) va to'lanmagan buyurtma. */
function RefundsTab({ f, set, onExport }: TabProps) {
  const tr = useTranslations('admin.revenue');
  const ts = useTranslations('admin.subs');
  const locale = useLocale();
  const menu = useRowMenu();
  const actionText = useActionText();
  const kind = f.kind === 'revoke' || f.kind === 'cancel' ? f.kind : '';
  const { data, pages, loading, err, reload } = useAdminList<Refund>('/admin/revenue/refunds', { kind, page: f.page, limit: LIMIT });
  const s = (data as RefPage | null)?.summary;
  useEffect(() => { if (data) onExport('refunds', { path: '/admin/revenue/refunds', filters: { kind }, total: data.total }); }, [data, kind, onExport]);

  const cols: Col<Refund>[] = [
    { key: 'at', head: tr('refunds.at'), cell: (r) => <span className="font-mono text-xs">{uzDateTime(r.at, locale)}</span> },
    { key: 'action', head: tr('refunds.action'), cell: (r) => actionText(r.action) },
    { key: 'no', head: ts('no'), cell: (r) => (r.no ? <Link href={`/admin/subscriptions?open=${r.subscriptionId}`} className="font-mono text-xs font-semibold text-navy hover:underline">{r.no}</Link> : '-') },
    { key: 'user', head: tr('refunds.user'), cell: (r) => <PersonCell p={r.user} /> },
    { key: 'amount', head: tr('refunds.amount'), num: true, cell: (r) => (r.amountTiyin == null ? '-' : som(r.amountTiyin, locale)) },
    // Pul kelgan-kelmagani faqat bekor qilingan tasdiqda ma'noli: to'lanmagan buyurtmada pul bo'lmagan
    { key: 'money', head: tr('refunds.moneyReceived'), cell: (r) => (r.action === 'subscription.revoke' ? <Pill tone={r.moneyReceived ? 'ok' : 'neutral'}>{tr(r.moneyReceived ? 'refunds.yes' : 'refunds.no')}</Pill> : '-') },
    { key: 'wasEndsAt', head: tr('refunds.wasEndsAt'), hideable: true, cell: (r) => (r.wasEndsAt ? <span className="font-mono text-xs">{uzDate(r.wasEndsAt, locale)}</span> : '-') },
    { key: 'reason', head: tr('refunds.reason'), cell: (r) => <span className="break-words">{r.reason ?? '-'}</span> },
    { key: 'actor', head: tr('refunds.actor'), cell: (r) => r.actor?.fullName || (r.actor?.phone ? phoneDisplay(r.actor.phone) : '-') },
  ];

  return (
    <>
      <div className={`${CARD} mt-5 flex flex-wrap items-end gap-2 p-3`}>
        <Labeled label={tr('refunds.kind')} className="w-full sm:w-64">
          <select className={INPUT} value={kind} onChange={(e) => set({ kind: e.target.value })}>
            <option value="">{tr('refunds.all')}</option>
            <option value="revoke">{tr('refunds.revoke')}</option>
            <option value="cancel">{tr('refunds.cancel')}</option>
          </select>
        </Labeled>
      </div>
      {err ? <LoadError err={err} onRetry={reload} /> : null}
      {s ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className={`${CARD} min-w-0 p-4`}>
            <p className="text-sm font-semibold text-navy">{tr('refunds.revokes', { n: s.revokes })}</p>
            <p className="mt-0.5 font-mono text-[11px] text-muted">{tr('refunds.revokesPaid', { n: s.revokesPaid, sum: som(s.revokesPaidTiyin, locale) })}</p>
            <p className="mt-2 text-xs text-muted">{tr('decision.refund')}</p>
          </div>
          <div className={`${CARD} min-w-0 p-4`}>
            <p className="text-sm font-semibold text-navy">{tr('refunds.cancels', { n: s.cancels })}</p>
            <p className="mt-2 text-xs text-muted">{tr('decision.cancel')}</p>
          </div>
        </div>
      ) : null}
      <DataTable cols={cols} rows={data?.items ?? []} keyOf={(r) => r.id} empty={tr('refunds.empty')} loading={loading}
        screen="revenue-refunds" rowMenu={(r) => menu(r.subscriptionId, r.user?.id)} />
      <Pager page={f.page} pages={pages} onPage={(p) => set({ page: p })} />
    </>
  );
}
