'use client';
/**
 * Tizim sahifasi (faqat ega): ilova, baza, vagon manbasi, navbatlar, kunlik sikl, xatolar,
 * Telegram bot, reklama va tarif, yuklamalar va disk. Bitta so'rov (GET /admin/system), har blok
 * serverda alohida yiqiladi (null) va o'rnida "yuklanmadi" chiqadi, qolgani ko'rinaveradi.
 *
 * Qoida: Pill FAQAT muammoda (sog' holat oddiy mono matn), har qator ostida qaror matni
 * (system.decision.*). Avto yangilanish yo'q: sahifa "hozir nima bo'lyapti" degan savolga
 * bir marta javob beradi, kerak bo'lsa Yangilash bosiladi. Chegaralar (100/300 ms, 410 MB,
 * 26 soat, 10/20%) serverdagi admin-system.ts bilan bir xil; xatolar va kunlik sikl jarayon
 * xotirasidan, ya'ni "ishga tushgandan beri" (restart tozalaydi).
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowsClockwiseIcon } from '@phosphor-icons/react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { num, uzDateTime } from '@/lib/format';
import { BTN_GHOST, CARD, type Col, DataTable, LoadError, Notice, PageHead, Pill, Skeleton } from '@/components/admin/kit';
import { useAdminMe } from '@/components/admin/context';
import { ageOf } from '@/components/admin/age';

type Tone = 'warn' | 'bad';
type Err = { at: string; status: number; code: string; method: string; path: string; msg: string };
type SystemInfo = {
  api: { sha: string | null; startedAt: string; uptimeSec: number; rssMb: number };
  db: { ok: boolean; ms?: number; sizeMb?: number };
  wagon: { configured: boolean; h24: { total: number; errors: number }; d7: { total: number; errors: number }; lastOkAt: string | null; lastErrorAt: string | null } | null;
  queues: { key: string; count: number; oldestAt: string | null }[] | null;
  daily: { at: string; ms: number; ok: boolean; error?: string; result: { keys: number; sessions: number; codes: number; notes: number; reminded: number; expired: number; stale: number } | null } | null;
  /** Yangisi birinchi, 50 tagacha, jarayon boshlanganidan beri */
  errors: Err[];
  telegram: { lastOkAt: string | null; lastFailAt: string | null; lastFailStatus: number | null; okSinceStart: number; failSinceStart: number };
  ads: { active: number; expired: number; ending7: number; draft: number } | null;
  plans: { active: number; phoneActive: number } | null;
  uploads: { files: number; bytes: number; scannedAt: string; capped: boolean; disk: { freeBytes: number; totalBytes: number } | null } | null;
  failed: string[];
};

/** Navbat kaliti -> home.pending* nomi va manzili (bosh sahifa va serverdagi QUEUE_HREF bilan bir xil). */
const QUEUES: Record<string, { label: string; href: string }> = {
  listingsPendingReview: { label: 'pendingListings', href: '/admin/moderation?tab=listings' },
  orgsPendingKyc: { label: 'pendingKyc', href: '/admin/moderation?tab=kyc' },
  terminalClaimsPending: { label: 'pendingClaims', href: '/admin/moderation?tab=claims' },
  premiumPending: { label: 'pendingPremium', href: '/admin/moderation?tab=premium' },
  subscriptionPending: { label: 'pendingSubscription', href: '/admin/moderation?tab=subscription' },
  ordersPending: { label: 'pendingOrders', href: '/admin/orders?status=PENDING' },
  urgentOpen: { label: 'pendingUrgent', href: '/admin/urgent?status=OPEN' },
  contactNew: { label: 'pendingContact', href: '/admin/moderation?tab=contact' },
  reportsNew: { label: 'pendingReports', href: '/admin/moderation?tab=reports' },
  platformInquiriesOpen: { label: 'pendingInquiries', href: '/dashboard/inquiries' },
};

const HOUR = 3_600_000;
/** 512 MB konteyner chegarasining 80%: undan oshsa OOM yaqin. */
const MEM_WARN_MB = 410;
const DB_WARN_MS = 100;
const DB_BAD_MS = 300;
/** Kunlik sikl 26 soatdan eski: to'xtagan (24 soatlik jadval + 2 soat zaxira). */
const STALE_DAILY_MS = 26 * HOUR;
const GB = 1_073_741_824;
const H2 = 'font-mono text-[11px] font-semibold uppercase tracking-wide text-muted';
const LINK = 'text-xs font-semibold text-teal-ink hover:underline';

/** Vagon manbasi: xato yarmidan ko'p bo'lsa qizil, bitta bo'lsa ham sariq, xato yo'q bo'lsa nishon yo'q. */
const wagonTone = (errors: number, total: number): Tone | null => (errors <= 0 ? null : errors >= total / 2 ? 'bad' : 'warn');
const sha7 = (s: string) => s.slice(0, 7);

function Block({ title, children, wide, right }: { title: string; children: React.ReactNode; wide?: boolean; right?: React.ReactNode }) {
  return (
    <section className={`${CARD} min-w-0 p-4 ${wide ? 'lg:col-span-2' : ''}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={H2}>{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

/** Bir qator: nom, qiymat (mono), ostida qaror matni. Telefonda nom va qiymat ustma-ust tushadi (wrap). */
function Row({ k, v, note }: { k: string; v: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-line/70 py-2 last:border-0">
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="flex flex-wrap items-center justify-end gap-2 font-mono text-sm tabular-nums text-navy">{v}</dd>
      {note ? <dd className="basis-full text-xs text-muted">{note}</dd> : null}
    </div>
  );
}

/** Muammo bo'lsa qiymat Pill ichida, aks holda oddiy matn: sog' holatga nishon yo'q. */
function Val({ tone, children }: { tone: Tone | null; children: React.ReactNode }) {
  return tone ? <Pill tone={tone}>{children}</Pill> : <>{children}</>;
}

export default function AdminSystemPage() {
  const t = useTranslations('admin');
  const ts = useTranslations('admin.system');
  const th = useTranslations('admin.home');
  const locale = useLocale();
  const { isOwner } = useAdminMe();
  const [data, setData] = useState<SystemInfo | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [at, setAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true); setErr(null);
    api<SystemInfo>('/admin/system').then((d) => { setData(d); setAt(new Date()); }).catch(setErr).finally(() => setLoading(false));
  }, []);
  // Operator uchun so'rov umuman ketmaydi: server 403 berardi, ekranda esa "faqat ega" matni yetadi
  useEffect(() => { if (isOwner) load(); }, [isOwner, load]);

  if (!isOwner) return <Notice tone="warn">{t('forbidden')}</Notice>;

  // Build vaqtida qotadi (NEXT_PUBLIC_*): web obrazi qaysi commitdan qurilgani
  const webSha = process.env.NEXT_PUBLIC_GIT_SHA || null;
  const now = Date.now();
  const failed = (name: string) => <Notice tone="err">{ts('blockFailed', { name })}</Notice>;

  const errCols: Col<Err & { k: string }>[] = [
    { key: 'at', head: ts('errAt'), cell: (e) => <span className="font-mono text-xs">{uzDateTime(e.at, locale)}</span> },
    // 5xx bizning xato (qizil), 4xx mijoz yoki ruxsat (sariq): ikkisi ham ko'rinadi, lekin bir xil og'irlikda emas
    { key: 'code', head: ts('errCode'), cell: (e) => <Pill tone={e.status >= 500 ? 'bad' : 'warn'}>{e.status} {e.code}</Pill> },
    { key: 'req', head: ts('errReq'), cell: (e) => <span className="font-mono text-xs break-all">{e.method} {e.path}</span> },
    { key: 'msg', head: ts('errMsg'), cell: (e) => <span className="block max-w-md truncate" title={e.msg}>{e.msg}</span> },
  ];

  return (
    <>
      <PageHead title={t('nav.system')} lead={ts('lead')}>
        {at ? <span className="font-mono text-xs text-muted">{ts('refreshedAt', { time: uzDateTime(at, locale) })}</span> : null}
        <button type="button" onClick={load} disabled={loading} className={BTN_GHOST}>
          <ArrowsClockwiseIcon size={16} aria-hidden="true" className={loading ? 'animate-spin' : ''} />
          {ts('refresh')}
        </button>
      </PageHead>

      {/* Yangilash yiqilsa eski ma'lumot xira turadi, xato ustida: bo'sh ekran o'rniga "qachongi" ko'rinib tursin */}
      {err ? <LoadError err={err} onRetry={load} /> : null}

      {!data && !err ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 9 }, (_, i) => <div key={i} className={`${CARD} p-4`}><Skeleton rows={4} /></div>)}
        </div>
      ) : null}

      {data ? (
        <div className={`mt-5 grid gap-4 lg:grid-cols-2 ${loading ? 'opacity-60' : ''}`} aria-busy={loading || undefined}>
          {/* 1. Ilova: qaysi commit, qachondan beri, qancha xotira */}
          <Block title={ts('app')}>
            <dl className="mt-1">
              <Row k={ts('sha')}
                v={data.api.sha ? (
                  <>
                    <span title={data.api.sha}>{ts('apiSha')} {sha7(data.api.sha)}</span>
                    <button type="button" onClick={() => void navigator.clipboard?.writeText(data.api.sha!)} className={LINK}>{ts('copy')}</button>
                    {webSha ? <span title={webSha}>{ts('webSha')} {sha7(webSha)}</span> : null}
                    {webSha && webSha !== data.api.sha ? <Pill tone="warn">{ts('shaMismatch')}</Pill> : null}
                  </>
                ) : <span className="text-muted">{ts('shaNone')}</span>}
                note={data.api.sha && webSha && webSha !== data.api.sha ? ts('decision.sha') : undefined} />
              <Row k={ts('startedAt')} v={<>{uzDateTime(data.api.startedAt, locale)} <span className="text-muted">{ts('hoursAgo', { n: Math.floor(data.api.uptimeSec / 3600) })}</span></>} note={ts('decision.started')} />
              <Row k={ts('memory')} v={<Val tone={data.api.rssMb > MEM_WARN_MB ? 'warn' : null}>{num(data.api.rssMb, locale)} MB</Val>} note={ts('decision.memory')} />
            </dl>
          </Block>

          {/* 2. Baza: javob vaqti va hajmi; yotgan bo'lsa butun blok bitta xabar */}
          <Block title={ts('db')}>
            {!data.db.ok ? (
              <>
                <Notice tone="err">{ts('dbDown')}</Notice>
                <p className="mt-2 text-xs text-muted">{ts('decision.dbDown')}</p>
              </>
            ) : (
              <dl className="mt-1">
                <Row k={ts('dbMs')} v={<Val tone={(data.db.ms ?? 0) > DB_BAD_MS ? 'bad' : (data.db.ms ?? 0) > DB_WARN_MS ? 'warn' : null}>{num(data.db.ms ?? 0, locale)} ms</Val>} note={ts('decision.db')} />
                {data.db.sizeMb != null ? <Row k={ts('dbSize')} v={`${num(data.db.sizeMb, locale)} MB`} note={ts('decision.dbSize')} /> : null}
              </dl>
            )}
          </Block>

          {/* 3. Vagon manbasi: sozlanganmi, 24 soat va 7 kun xatolari, oxirgi muvaffaqiyat. WAGON_UPSTREAM
              qatorlari xatolar jadvalida ham ko'rinadi: bu bitta hodisa, ikki joyda emas ikki xil son */}
          <Block title={ts('wagon')} right={<Link href="/admin/audit?action=wagon.search" className={LINK}>{ts('audit')}</Link>}>
            {!data.wagon ? failed(ts('wagon')) : (() => {
              const w = data.wagon;
              const staleOk = !!w.lastOkAt && w.h24.total > 0 && now - new Date(w.lastOkAt).getTime() > 24 * HOUR;
              const win = (x: { total: number; errors: number }) => (x.total === 0 ? <span className="text-muted">{ts('noSearches')}</span>
                : <Val tone={wagonTone(x.errors, x.total)}>{ts('errorsOf', { errors: x.errors, total: x.total })}</Val>);
              return (
                <dl className="mt-1">
                  <Row k={ts('configured')} v={w.configured ? ts('configured') : <Pill tone="bad">{ts('notConfigured')}</Pill>} note={w.configured ? undefined : ts('decision.wagonNotConfigured')} />
                  <Row k={ts('h24')} v={win(w.h24)} />
                  <Row k={ts('d7')} v={win(w.d7)} note={ts('decision.wagonErrors')} />
                  <Row k={ts('lastOk')} v={w.lastOkAt ? <Val tone={staleOk ? 'bad' : null}>{uzDateTime(w.lastOkAt, locale)}</Val> : <span className="text-muted">{ts('noneIn7')}</span>}
                    note={staleOk ? ts('decision.wagonStale') : undefined} />
                  <Row k={ts('lastError')} v={w.lastErrorAt ? uzDateTime(w.lastErrorAt, locale) : '-'} />
                </dl>
              );
            })()}
          </Block>

          {/* 4. Navbatlar: 10 qator, eng eskisining yoshi bosh sahifadagi o'lchov bilan (ageOf) */}
          <Block title={ts('queues')}>
            {!data.queues ? failed(ts('queues')) : (
              <ul className="mt-1 divide-y divide-line/70">
                {data.queues.map((q) => {
                  const def = QUEUES[q.key];
                  const age = q.oldestAt ? ageOf(q.oldestAt) : null;
                  return (
                    <li key={q.key}>
                      <Link href={def?.href ?? '/admin'} className={`flex items-center gap-3 py-2 hover:bg-sand/60 ${q.count ? '' : 'text-muted'}`}>
                        <span className="min-w-0 flex-1 text-sm">{def ? th(def.label) : q.key}</span>
                        {age && age.tone !== 'neutral' ? <Pill tone={age.tone}>{th(`age.${age.key}`, { n: age.n })}</Pill> : null}
                        <span className="w-10 text-right font-mono text-sm font-bold tabular-nums">{num(q.count, locale)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted">{ts('decision.queues')}</p>
          </Block>

          {/* 5. Kunlik sikl: oxirgi yugurish va natijasi; jarayon xotirasidan, restartdan keyin "hali yugurmagan" */}
          <Block title={ts('daily')}>
            {!data.daily ? <p className="mt-2 text-sm text-muted">{ts('notYet')}</p> : (() => {
              const d = data.daily;
              const stale = now - new Date(d.at).getTime() > STALE_DAILY_MS;
              return (
                <>
                  {!d.ok ? <Notice tone="err">{ts('dailyFailed', { error: d.error ?? '' })}</Notice> : null}
                  <dl className="mt-1">
                    <Row k={ts('lastRun')} v={<Val tone={stale ? 'bad' : null}>{uzDateTime(d.at, locale)}</Val>} note={ts('decision.daily')} />
                    <Row k={ts('duration')} v={`${num(d.ms, locale)} ms`} />
                    {d.result ? <Row k={ts('result')} v={<span className="text-right text-xs">{ts('resultLine', d.result)}</span>} note={ts('decision.dailyReminded')} /> : null}
                  </dl>
                </>
              );
            })()}
          </Block>

          {/* 7. Telegram bot: oxirgi muvaffaqiyat va xato, hisoblagichlar */}
          <Block title={ts('telegram')}>
            {(() => {
              const tg = data.telegram;
              if (!tg.lastOkAt && !tg.lastFailAt) return <p className="mt-2 text-sm text-muted">{ts('tgNone')}</p>;
              // Oxirgi xabar xato bilan tugagan: bot hozir ishlamayapti degani
              const failing = !!tg.lastFailAt && (!tg.lastOkAt || tg.lastFailAt > tg.lastOkAt);
              return (
                <dl className="mt-1">
                  <Row k={ts('tgOk')} v={tg.lastOkAt ? uzDateTime(tg.lastOkAt, locale) : '-'} />
                  <Row k={ts('tgFail')} v={tg.lastFailAt ? <Val tone={failing ? 'bad' : null}>{uzDateTime(tg.lastFailAt, locale)}{tg.lastFailStatus ? ` (${tg.lastFailStatus})` : ''}</Val> : '-'}
                    note={ts('decision.telegram')} />
                  <Row k={ts('sinceStart')} v={ts('tgCounts', { ok: tg.okSinceStart, fail: tg.failSinceStart })} />
                </dl>
              );
            })()}
          </Block>

          {/* 8. Reklama va tarif: joy sotilganmi, tugayaptimi; telefon ochadigan tarif bormi */}
          <Block title={ts('adsPlans')} right={<Link href="/admin/ads" className={LINK}>{t('nav.ads')}</Link>}>
            {!data.ads || !data.plans ? failed(ts('adsPlans')) : (
              <dl className="mt-1">
                <Row k={ts('adsActive')} v={num(data.ads.active, locale)} note={ts('decision.adsActive')} />
                <Row k={ts('adsExpired')} v={<Val tone={data.ads.expired > 0 ? 'warn' : null}>{num(data.ads.expired, locale)}</Val>} note={ts('decision.adsExpired')} />
                <Row k={ts('adsEnding')} v={num(data.ads.ending7, locale)} note={ts('decision.adsEnding')} />
                <Row k={ts('plansActive')}
                  v={<>{num(data.plans.active, locale)} <Val tone={data.plans.phoneActive === 0 ? 'bad' : null}>{ts('plansPhone', { n: data.plans.phoneActive })}</Val></>}
                  note={data.plans.phoneActive === 0 ? <>{ts('decision.plansPhone')} <Link href="/admin/plans?new=1" className={LINK}>{t('nav.plans')}</Link></> : undefined} />
              </dl>
            )}
          </Block>

          {/* 9. Yuklamalar va disk: fayl soni 10 daqiqa keshdan, disk statfs dan (Windows dev da yo'q, qator chizilmaydi) */}
          <Block title={ts('uploads')}>
            {!data.uploads ? failed(ts('uploads')) : (() => {
              const u = data.uploads;
              const free = u.disk ? u.disk.freeBytes / Math.max(1, u.disk.totalBytes) : null;
              return (
                <dl className="mt-1">
                  <Row k={ts('uploads')}
                    v={<>{ts('files', { n: num(u.files, locale), mb: num(Math.round(u.bytes / 1048576), locale) })}{u.capped ? <Pill tone="warn">{ts('capped')}</Pill> : null}</>}
                    note={<>{ts('decision.uploads')} <span className="font-mono">{ts('scannedAt', { time: uzDateTime(u.scannedAt, locale) })}</span></>} />
                  {u.disk && free !== null ? (
                    <Row k={ts('diskFree')}
                      v={<Val tone={free < 0.1 ? 'bad' : free < 0.2 ? 'warn' : null}>{ts('diskFree', { free: (u.disk.freeBytes / GB).toFixed(1), total: (u.disk.totalBytes / GB).toFixed(1) })}</Val>}
                      note={ts('decision.disk')} />
                  ) : null}
                </dl>
              );
            })()}
          </Block>

          {/* 6. Oxirgi xatolar: butun kenglikda, chunki so'rov yo'li va xabar uzun */}
          <Block title={`${ts('errors')} ${num(data.errors.length, locale)}`} wide right={<span className="text-xs text-muted">{ts('sinceStart')}</span>}>
            {/* Halqada id yo'q: yangisi birinchi tartibda indeks yetadi */}
            {/* Qatorga bitta amal (nusxa): shunda kit j/k va '.' ni yoqadi, xato matni logga yoki chatga bir bosishda ko'chadi */}
            <DataTable cols={errCols} rows={data.errors.map((e, i) => ({ ...e, k: String(i) }))} keyOf={(e) => e.k} empty={ts('errEmpty')}
              rowMenu={(e) => [{ label: ts('copy'), onSelect: () => void navigator.clipboard?.writeText(`${e.status} ${e.code} ${e.method} ${e.path} ${e.msg}`) }]} />
            <p className="mt-2 text-xs text-muted">{ts('decision.errors')}</p>
          </Block>
        </div>
      ) : null}
    </>
  );
}
