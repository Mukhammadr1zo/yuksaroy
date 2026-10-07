'use client';
/**
 * Admin bosh sahifasi (Boshqaruv 3.0): ish kuni shu yerdan boshlanadi.
 *
 * Uch savolga javob beradi: bugun nima kutmoqda (va qaysi biri eng uzoq kutdi), pul qayerda
 * turibdi, nima o'smoqda yoki tushmoqda. To'rt so'rov parallel va har biri alohida yiqiladi:
 * /admin/home (hamma admin), /admin/home/money (faqat ega: tushum), /admin/audit?actor=me,
 * /admin/tasks?assignee=me (menga biriktirilgan ish; yiqilsa jim, blok shunchaki chizilmaydi).
 *
 * Qoida: har son yonida qaror matni (i18n home.decision.*) yoki son chizilmaydi.
 * Sog' baza, "oxirgi sutkada" uch son va umumiy amallar tasmasi shu sababli yo'q:
 * ulardan qaror chiqmasdi. Yangi son qo'shilsa qaror matni ham qo'shiladi.
 */
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ORDER_STUCK_DAYS } from '@yuksaroy/domain';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { num, som, uzDate, uzDateTime } from '@/lib/format';
import { CARD, Notice, PageHead, Pill, Skeleton, errText, useActionText, useRovingList } from '@/components/admin/kit';
import { useAdminMe } from '@/components/admin/context';
import { ageOf } from '@/components/admin/age';
import { dueTone, type Task } from '@/components/admin/AssignTask';
import { Sparkline } from '@/components/admin/Sparkline';

type Pair = { last7: number; prev7: number };
type AlertCode = 'NO_ACTIVE_PLAN' | 'WAGON_UPSTREAM' | 'AD_EXPIRED' | 'AD_ENDING' | 'DB_SLOW' | 'DB_DOWN' | 'NO_PROVIDER' | 'STUCK_ORDERS';
type Home = {
  db: { ok: boolean; ms?: number };
  /** count > 0 navbatlar, eng uzoq kutgani birinchi */
  work: { key: string; count: number; oldestAt: string | null; href: string }[];
  money: { activeSubscribers: number; expiring7: number; pendingPay: { count: number; amountTiyin: number; oldestAt: string | null } } | null;
  growth: { users: Pair; listings: Pair; requests: Pair; wagon: Pair } | null;
  series: { days: string[]; visits: number[]; reveals: number[]; wagon: number[]; orders: number[] } | null;
  alerts: { code: AlertCode; tone: 'warn' | 'bad'; n?: number; of?: number; ms?: number }[];
  commission: { thisMonth: number; prevMonth: number; threshold: number } | null;
  reveals: { people: number; reveals: number; subscribers: number; freeReveals: number; freeTotal: number; walls: { phone: number; wagon: number } } | null;
  /** Yiqilgan bloklar nomi: bo'sh bo'lsa hammasi joyida */
  failed: string[];
};
type Money = { thisMonthTiyin: number; prevMonthTiyin: number; payments: number };
type AuditRow = { id: string; action: string; entity: string | null; meta: unknown; createdAt: string };
/** GET /admin/tasks?assignee=me&open=1&limit=5: 5 qator, summary butun filtr bo'yicha. */
type MyTasks = { items: Task[]; summary: { open: number; overdue: number } };

/** Navbat kaliti -> home.* nomi (serverdagi QueueKey bilan bir xil ro'yxat). */
const WORK_LABEL: Record<string, string> = {
  listingsPendingReview: 'pendingListings', orgsPendingKyc: 'pendingKyc', terminalClaimsPending: 'pendingClaims',
  premiumPending: 'pendingPremium', subscriptionPending: 'pendingSubscription', ordersPending: 'pendingOrders',
  urgentOpen: 'pendingUrgent', contactNew: 'pendingContact', reportsNew: 'pendingReports', platformInquiriesOpen: 'pendingInquiries',
};
/** Ogohlantirishdan qaror sahifasiga. Baza haqidagisi Tizim sahifasiga, u faqat egada bor: operatorga havola yo'q (serverga qarash kerak). */
const ALERT_HREF: Partial<Record<AlertCode, string>> = {
  NO_ACTIVE_PLAN: '/admin/plans?new=1', WAGON_UPSTREAM: '/admin/audit?action=wagon.search', AD_EXPIRED: '/admin/ads', AD_ENDING: '/admin/ads',
  // Jurnalda har so'rovning viloyati, turi va necha odamga ketgani: qayerda ijrochi yo'qligi shundan ko'rinadi
  NO_PROVIDER: '/admin/audit?action=request.fanout',
  // Server sanagan shart bilan aynan o'sha buyurtmalar: majburiy holat tugmasi shu ro'yxatning varag'ida
  STUCK_ORDERS: '/admin/orders?status=STUCK',
};
const alertHref = (code: AlertCode, isOwner: boolean) => (code === 'DB_SLOW' || code === 'DB_DOWN' ? (isOwner ? '/admin/system' : undefined) : ALERT_HREF[code]);
const GROWTH = [
  { k: 'users', label: 'growthUsers', href: '/admin/users?sort=createdAt&dir=desc', decision: 'users' },
  { k: 'listings', label: 'growthListings', href: '/admin/listings?status=ACTIVE&sort=createdAt&dir=desc', decision: 'listings' },
  { k: 'requests', label: 'growthRequests', href: '/admin/market', decision: 'requests' },
  { k: 'wagon', label: 'growthWagon', href: '/admin/audit?action=wagon.search', decision: 'wagon' },
] as const;
const SERIES = [
  { k: 'visits', label: 'seriesVisits', href: '/admin/visits', decision: 'visits' },
  { k: 'reveals', label: 'seriesReveals', href: '/admin/audit?action=contact', decision: 'reveals' },
  { k: 'wagon', label: 'seriesWagon', href: '/admin/audit?action=wagon.search', decision: 'wagonSeries' },
  { k: 'orders', label: 'seriesOrders', href: '/admin/orders', decision: 'orders' },
] as const;
/** Bloklarga bog'lanmagan yiqilishlar (plans, wagon, ads) ogohlantirish bo'limida bitta xabar bo'ladi. */
const BLOCKS = ['work', 'money', 'growth', 'series', 'commission', 'reveals'];

const H2 = 'font-mono text-[11px] font-semibold uppercase tracking-wide text-muted';
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const days = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

/** Foiz farqi nishoni. Oldingi oyna nol bo'lsa foiz yo'q: "yangi". warnAt: shundan past tushish sariq. */
function Delta({ cur, prev, warnAt }: { cur: number; prev: number; warnAt: number }) {
  const th = useTranslations('admin.home');
  if (!prev) return cur > 0 ? <Pill tone="ok">{th('deltaNew')}</Pill> : null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  return <Pill tone={pct > 0 ? 'ok' : pct < warnAt ? 'warn' : 'neutral'}>{th('delta', { pct: pct > 0 ? `+${pct}` : String(pct) })}</Pill>;
}

/** Bitta son kartasi: son, nomi, ostida taqqos satri, nishon va qaror matni. Havola bo'lsa butun karta bosiladi. */
function Stat({ href, value, label, sub, pill, note, children }: {
  href?: string; value: React.ReactNode; label: string; sub?: React.ReactNode; pill?: React.ReactNode; note?: string; children?: React.ReactNode;
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
      {children}
      {note ? <span className="mt-2 block text-xs text-muted">{note}</span> : null}
    </>
  );
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

function Block({ children }: { children: React.ReactNode }) {
  return <div className={`${CARD} p-4`}>{children}</div>;
}

/** Bugungi ish ro'yxati: j/k va Enter bilan yuriladi (kit useRovingList, jadval bilan bir xil odat). */
function WorkList({ rows }: { rows: Home['work'] }) {
  const th = useTranslations('admin.home');
  const locale = useLocale();
  const router = useRouter();
  const rov = useRovingList(rows.length, { onOpen: (i) => router.push(rows[i]!.href) });
  return (
    <ul {...rov.containerProps} className={`${CARD} mt-2 divide-y divide-line/70 outline-none`}>
      {rows.map((r, i) => {
        const age = r.oldestAt ? ageOf(r.oldestAt) : null;
        return (
          <li key={r.key} {...rov.itemProps(i)} onFocus={() => rov.setIndex(i)}
            className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal">
            {/* Havola Tab to'xtash joyi emas (tabIndex -1): qator o'zi fokus oladi, Enter ochadi */}
            <Link href={r.href} tabIndex={-1} className="flex items-center gap-3 px-4 py-3 hover:bg-sand/60">
              <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{th(WORK_LABEL[r.key] ?? r.key)}</span>
              {/* Yosh son yonida: qaysi navbat unutilganini son emas, kutgan vaqti aytadi */}
              {age ? <Pill tone={age.tone}>{th(`age.${age.key}`, { n: age.n })}</Pill> : null}
              <span className="w-12 text-right font-mono text-base font-bold tabular-nums text-navy">{num(r.count, locale)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Menga biriktirilgan ish: 5 tagacha qator, muddati o'tgan tepada (server tartibi). Butun qator
 * havola (task.href), j/k va Enter navbat ro'yxati bilan bir xil odat (alohida hook chaqiruvi).
 * Faqat open > 0 bo'lganda chiziladi: nol vazifa qaror bermaydi.
 */
function MineTasks({ data }: { data: MyTasks }) {
  const th = useTranslations('admin.home');
  const tt = useTranslations('admin.tasks');
  const locale = useLocale();
  const router = useRouter();
  const rov = useRovingList(data.items.length, { onOpen: (i) => router.push(data.items[i]!.href) });
  return (
    <div className={`${CARD} mt-2 p-4`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink">
          {th('mineTasks')}
          <span className="ml-2 font-mono text-xs tabular-nums text-navy">{th('mineTasksCount', { n: data.summary.open })}</span>
        </span>
        <span className="flex items-center gap-3">
          {data.summary.overdue > 0 ? <Pill tone="bad">{th('mineTasksOverdue', { n: data.summary.overdue })}</Pill> : null}
          <Link href="/admin/moderation?mine=1" className="text-xs font-semibold text-teal-ink hover:underline">{th('mineTasksAll')}</Link>
        </span>
      </div>
      <ul {...rov.containerProps} className="mt-2 divide-y divide-line/70 outline-none">
        {data.items.map((x, i) => {
          const due = dueTone(x.dueAt);
          return (
            <li key={x.id} {...rov.itemProps(i)} onFocus={() => rov.setIndex(i)}
              className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal">
              <Link href={x.href} tabIndex={-1} className="flex items-center gap-3 py-2 hover:bg-sand/60">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{x.title ?? x.entityId}</span>
                  <span className="block text-xs text-muted">{th(WORK_LABEL[x.queue] ?? x.queue)}</span>
                </span>
                {due ? <Pill tone={due.tone}>{due.key === 'dueBy' ? tt('dueBy', { date: uzDate(x.dueAt!, locale) }) : tt(due.key)}</Pill> : null}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted">{th('mineTasksDecision')}</p>
    </div>
  );
}

export default function AdminHomePage() {
  const t = useTranslations('admin');
  const th = useTranslations('admin.home');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const { me, isOwner } = useAdminMe();
  const actionText = useActionText();
  const [home, setHome] = useState<Home | null>(null);
  const [homeErr, setHomeErr] = useState<unknown>(null);
  const [money, setMoney] = useState<Money | null | 'err'>(null);
  const [mine, setMine] = useState<AuditRow[] | null | 'err'>(null);
  const [tasks, setTasks] = useState<MyTasks | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setHome(null); setHomeErr(null); setMoney(null); setMine(null); setTasks(null);
    api<Home>('/admin/home').then(setHome).catch(setHomeErr);
    // Tushum faqat egaga: operator uchun so'rov umuman ketmaydi (403 xabari emas, karta yo'q)
    if (isOwner) api<Money>('/admin/home/money').then(setMoney).catch(() => setMoney('err'));
    api<{ items: AuditRow[] }>(`/admin/audit?actor=${me.id}&limit=8`).then((r) => setMine(r.items)).catch(() => setMine('err'));
    // Yiqilsa jim: vazifa bloki ikkilamchi, navbat ro'yxati baribir bor
    api<MyTasks>('/admin/tasks?assignee=me&open=1&limit=5').then(setTasks).catch(() => {});
  }, [me.id, isOwner, tick]);

  const failed = (name: string) => !!home?.failed?.includes(name);
  const total = home ? sum(home.work.map((w) => w.count)) : 0;
  // Eng uzoq kutgan ish qaysi navbatda bo'lsa ham, uning yoshi sarlavhada turadi
  const waited = home ? Math.max(0, ...home.work.filter((w) => w.oldestAt).map((w) => days(w.oldestAt!))) : 0;
  const otherFailed = home?.failed?.filter((f) => !BLOCKS.includes(f)) ?? [];

  const c = home?.commission ?? null;
  // Belgi ikki oyning kattasi bo'yicha: e'lon 30 kun oldin chiqishi kerak, ya'ni
  // qaror chegaraga yetgunga qadar qabul qilinadi. Ommaviy matn "100 tadan ortiq"
  // deydi, shuning uchun o'tganini qat'iy > bilan sanaymiz.
  const peak = c ? Math.max(c.thisMonth, c.prevMonth) : 0;
  const over = !!c && peak > c.threshold;
  const near = !!c && peak >= c.threshold * 0.8;

  // To'lov devorida to'xtagan odamlar, ikki devor jami: karta shu son bor bo'lganda ham
  // chiziladi, bepul oyna o'chiq bo'lsa ham - maxraj narx qarori uchun aynan shu paytda kerak
  const wall = home?.reveals ? home.reveals.walls.phone + home.reveals.walls.wagon : 0;

  const pendAge = home?.money?.pendingPay.oldestAt ? ageOf(home.money.pendingPay.oldestAt) : null;
  const link = 'text-xs font-semibold text-teal-ink hover:underline';

  return (
    <>
      <PageHead title={t('nav.home')} lead={th('lead')} />
      {homeErr ? (
        <Notice tone="err">
          {errText(homeErr, t, t.has, tc('loadFailed'))}
          <button type="button" onClick={() => setTick((n) => n + 1)} className="ml-2 font-semibold underline">{th('retry')}</button>
        </Notice>
      ) : null}

      {/* A. Ogohlantirishlar: bo'sh bo'lsa bo'lim umuman yo'q, sog' holat haqida hech narsa chizilmaydi */}
      {home && (home.alerts.length || otherFailed.length) ? (
        <section className="mt-5" aria-label={th('alerts')}>
          {home.alerts.map((a) => {
            const href = alertHref(a.code, isOwner);
            return (
              <Notice key={a.code} tone={a.tone === 'bad' ? 'err' : 'warn'}>
                {th(`alert.${a.code}`, { n: a.n ?? 0, of: a.of ?? 0, ms: a.ms ?? 0, days: ORDER_STUCK_DAYS })}
                {href ? <Link href={href} className="ml-2 font-semibold underline">{th('alertGo')}</Link> : null}
              </Notice>
            );
          })}
          {otherFailed.length ? <Notice tone="err">{th('blockFailed', { name: th('alerts') })} ({otherFailed.join(', ')})</Notice> : null}
        </section>
      ) : null}

      {/* B. Bugungi ish: ro'yxat, eng uzoq kutgani birinchi. Qaror: birinchi nimani ochaman */}
      <section className="mt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={H2}>
            {th('work')}
            {home ? <span className="ml-2 font-mono text-xs tabular-nums text-navy">{num(total, locale)}</span> : null}
          </h2>
          {waited >= 1 ? <Pill tone={waited >= 3 ? 'bad' : 'warn'}>{th('waitingDays', { days: waited })}</Pill> : null}
        </div>
        {/* Menga biriktirilgan: navbatlardan oldin, chunki jamoadosh yoki egasi aynan shuni kutmoqda */}
        {tasks && tasks.summary.open > 0 ? <MineTasks data={tasks} /> : null}
        {!home && !homeErr ? <div className={`${CARD} mt-2 p-4`}><Skeleton rows={4} /></div>
          : failed('work') ? <Notice tone="err">{th('blockFailed', { name: th('work') })}</Notice>
          : home && !home.work.length ? <p className={`${CARD} mt-2 border-dashed px-6 py-10 text-center text-sm text-muted`}>{th('workEmpty')}</p>
          : home ? <WorkList rows={home.work} /> : null}
      </section>

      {/* C. Pul: tushum faqat egaga; qolgani hamma adminga */}
      <section className="mt-5">
        <h2 className={H2}>{th('money')}</h2>
        {failed('money') ? <Notice tone="err">{th('blockFailed', { name: th('money') })}</Notice> : null}
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {isOwner ? (
            money === null ? <Block><Skeleton rows={3} /></Block>
              : money === 'err' ? <Block><Notice tone="err">{th('blockFailed', { name: th('revenueThisMonth') })}</Notice></Block>
              // Qaror: narx, tarif, reklama siyosati
              : <Stat href="/admin/revenue" value={som(money.thisMonthTiyin, locale)} label={th('revenueThisMonth')}
                  sub={th('revenuePrevMonth', { sum: som(money.prevMonthTiyin, locale) })} pill={<Delta cur={money.thisMonthTiyin} prev={money.prevMonthTiyin} warnAt={0} />} />
          ) : null}
          {!home && !homeErr ? (
            <><Block><Skeleton rows={3} /></Block><Block><Skeleton rows={3} /></Block><Block><Skeleton rows={3} /></Block></>
          ) : home?.money ? (
            <>
              {/* Qaror: tarif o'zgarishi nechta odamga tegadi */}
              <Stat href="/admin/subscriptions?status=ACTIVE" value={num(home.money.activeSubscribers, locale)} label={th('activeSubs')} />
              {/* Qaror: kimga eslatma qo'ng'irog'i */}
              <Stat href="/admin/subscriptions?status=ACTIVE&sort=endsAt&dir=asc" value={num(home.money.expiring7, locale)} label={th('expiring7')} />
              {/* Qaror: bank ko'chirmasida qancha pul qidiriladi; eng eskisi qancha kutdi */}
              <Stat href="/admin/moderation?tab=subscription" value={num(home.money.pendingPay.count, locale)} label={th('pendingPay')}
                sub={th('pendingPayCount', { count: home.money.pendingPay.count, sum: num(Math.round(home.money.pendingPay.amountTiyin / 100), locale) })}
                pill={pendAge ? <Pill tone={pendAge.tone}>{th('pendingPayOldest', { age: th(`age.${pendAge.key}`, { n: pendAge.n }) })}</Pill> : null} />
            </>
          ) : null}
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* D. O'sish: oxirgi 7 kun va oldingi 7 kun. Namuna qatorlar sanalmagan */}
        <section className="min-w-0">
          <h2 className={H2}>{th('growth')}</h2>
          {failed('growth') ? <Notice tone="err">{th('blockFailed', { name: th('growth') })}</Notice> : null}
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {!home && !homeErr ? GROWTH.map((g) => <Block key={g.k}><Skeleton rows={3} /></Block>)
              : home?.growth ? GROWTH.map((g) => {
                const p = home.growth![g.k];
                return (
                  <Stat key={g.k} href={g.href} value={num(p.last7, locale)} label={th(g.label)} sub={th('prev7', { n: p.prev7 })}
                    pill={<Delta cur={p.last7} prev={p.prev7} warnAt={-20} />} note={th(`decision.${g.decision}`)} />
                );
              }) : null}
          </div>
        </section>

        {/* E. 30 kun: bugun, jami, 7 kun oldingi 7 kunga nisbatan va chiziqcha */}
        <section className="min-w-0">
          <h2 className={H2}>{th('series')}</h2>
          {failed('series') ? <Notice tone="err">{th('blockFailed', { name: th('series') })}</Notice> : null}
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {!home && !homeErr ? SERIES.map((s) => <Block key={s.k}><Skeleton rows={4} /></Block>)
              : home?.series ? SERIES.map((s) => {
                const v = home.series![s.k];
                const today = v[v.length - 1] ?? 0;
                const total30 = sum(v);
                const name = th(s.label);
                return (
                  <Stat key={s.k} href={s.href} value={num(today, locale)} label={`${name}, ${th('today')}`} sub={th('total30', { n: total30 })}
                    pill={<Delta cur={sum(v.slice(-7))} prev={sum(v.slice(-14, -7))} warnAt={-20} />} note={th(`decision.${s.decision}`)}>
                    <Sparkline values={v} aria={th('seriesAria', { name, total: total30, today })} empty={th('seriesEmpty')} />
                  </Stat>
                );
              }) : null}
          </div>
        </section>
      </div>

      {/* F. Komissiya chegarasi, raqam ochish voronkasi, mening amallarim */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {/* Komissiya chegarasi. O'tgan oy yagona to'liq son, shu oy esa tendensiya:
            e'lon 30 kun oldin chiqishi kerak, ya'ni qaror chegaradan oldin qabul qilinadi. */}
        {failed('commission') ? <Notice tone="err">{th('blockFailed', { name: th('commission') })}</Notice> : null}
        {c ? (
          <section className={`${CARD} min-w-0 p-4`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className={H2}>{th('commission')}</h2>
              {near ? <Pill tone={over ? 'bad' : 'warn'}>{th(over ? 'commissionOver' : 'commissionNear')}</Pill> : null}
            </div>
            <dl className="mt-1 grid grid-cols-2 gap-2">
              <div>
                <dd className="font-display text-2xl font-bold tabular-nums text-navy">{num(c.thisMonth, locale)}</dd>
                <dt className="text-xs text-muted">{th('commissionThisMonth')}</dt>
              </div>
              <div>
                <dd className="font-display text-2xl font-bold tabular-nums text-navy">{num(c.prevMonth, locale)}</dd>
                <dt className="text-xs text-muted">{th('commissionPrevMonth')}</dt>
              </div>
            </dl>
            <p className="mt-2 text-xs text-muted">{th('commissionThreshold', { n: c.threshold })}</p>
          </section>
        ) : null}

        {/* Karta bepul oyna yoqilganda yoki devorda to'xtagan odam bo'lganda chiziladi:
            ikkisi ham bo'lmasa bu yerda bir necha nol turardi va hech qanday qarorni
            o'zgartirmasdi. Birinchi qator ODAM, ikkinchisi OCHILISH, uchinchisi yana
            ODAM (devorda to'xtaganlar): birliklari aralashib ketmasin. */}
        {home?.reveals && (home.reveals.freeTotal > 0 || wall > 0) ? (
          <section className={`${CARD} min-w-0 p-4`}>
            <h2 className={H2}>{th('reveals')}</h2>
            <dl className="mt-1 grid grid-cols-2 gap-2">
              {([['revealPeople', home.reveals.people], ['revealSubscribers', home.reveals.subscribers],
                 ['revealCount', home.reveals.reveals], ['revealFree', home.reveals.freeReveals],
                 ['wallPhone', home.reveals.walls.phone], ['wallWagon', home.reveals.walls.wagon]] as const).map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dd className="font-display text-xl font-bold tabular-nums text-navy">{num(v, locale)}</dd>
                  <dt className="text-xs text-muted">{th(k)}</dt>
                </div>
              ))}
            </dl>
            {home.reveals.freeTotal > 0 ? <p className="mt-2 text-xs text-muted">{th('revealWindow', { n: home.reveals.freeTotal })}</p> : null}
            {wall > 0 ? <p className="mt-1 text-xs text-muted">{th('wallNote')}</p> : null}
          </section>
        ) : null}

        {/* Mening oxirgi amallarim: tanaffusdan keyin qayerda to'xtaganini eslash. Kim ustuni yo'q: hammasi meniki */}
        <section className={`${CARD} min-w-0 p-4`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className={H2}>{th('mine')}</h2>
            <span className="flex gap-3">
              <Link href={`/admin/audit?actor=${me.id}`} className={link}>{th('mineAll')}</Link>
              {isOwner ? <Link href="/admin/audit?action=admin" className={link}>{th('teamActions')}</Link> : null}
            </span>
          </div>
          {mine === null ? <Skeleton rows={4} className="mt-3" />
            : mine === 'err' ? <Notice tone="err">{th('blockFailed', { name: th('mine') })}</Notice>
            : !mine.length ? <p className="mt-3 text-sm text-muted">{th('mineEmpty')}</p> : (
              <ul className="mt-2 divide-y divide-line/70">
                {mine.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5 text-sm">
                    <span className="min-w-0 text-ink wrap-anywhere">{actionText(r.action, r.meta)}</span>
                    <span className="ml-auto shrink-0 font-mono text-[11px] text-muted">{uzDateTime(r.createdAt, locale)}</span>
                  </li>
                ))}
              </ul>
            )}
        </section>
      </div>
    </>
  );
}
