'use client';
/**
 * Admin bosh sahifasi: ish kuni shu yerdan boshlanadi.
 *
 * Ilgari bu yerda uchta raqamlar to'plami turardi va ulardan hech narsa qilib bo'lmasdi.
 * Endi uch savolga javob beradi: hozir nima kutmoqda, eng uzog'i qancha kutdi, va
 * oxirgi paytda nima bo'ldi.
 *
 * "Eng uzoq kutgan" alohida ko'rsatiladi, chunki navbatdagi son o'zi hech narsa demaydi:
 * ikkita e'lon uch kundan beri turgani beshta e'lon bugun kelganidan yomonroq.
 */
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { num, uzDateTime } from '@/lib/format';
import { CARD, Notice, PageHead, Pill, errText, useActionText } from '@/components/admin/kit';

type Health = {
  db: { ok: boolean; ms?: number; error?: string };
  counts: { listingsPendingReview: number; orgsPendingKyc: number; terminalClaimsPending: number; premiumPending: number; subscriptionPending: number; ordersPending: number; urgentOpen: number };
  recent: { users: number; orders: number; listings: number };
  /** Har navbatning eng eskisi; faqat ?full=1 bilan keladi */
  oldest?: Partial<Record<string, string | null>>;
  /** Yiqilgan so'rovlar nomi: bo'sh bo'lsa hammasi joyida. */
  failed?: string[];
};
type Actor = { id: string; phone: string; fullName: string | null };
type AuditRow = { id: string; action: string; entity: string | null; meta: unknown; createdAt: string; actor: Actor | null };

const QUEUE: { key: keyof Health['counts']; label: string; href: string }[] = [
  { key: 'listingsPendingReview', label: 'pendingListings', href: '/admin/moderation?tab=listings' },
  { key: 'orgsPendingKyc', label: 'pendingKyc', href: '/admin/moderation?tab=kyc' },
  { key: 'terminalClaimsPending', label: 'pendingClaims', href: '/admin/moderation?tab=claims' },
  { key: 'premiumPending', label: 'pendingPremium', href: '/admin/moderation?tab=premium' },
  { key: 'subscriptionPending', label: 'pendingSubscription', href: '/admin/moderation?tab=subscription' },
  { key: 'ordersPending', label: 'pendingOrders', href: '/admin/orders?status=PENDING' },
  // Shoshilinch so'rov ham shu yerda: ilgari u faqat o'z ekranida turardi va bosh sahifaga
  // qaragan operator ochiq so'rov borligini bilmasdi
  { key: 'urgentOpen', label: 'pendingUrgent', href: '/admin/urgent?status=OPEN' },
];
const RECENT: { key: keyof Health['recent']; label: string }[] = [
  { key: 'users', label: 'newUsers' }, { key: 'orders', label: 'newOrders' }, { key: 'listings', label: 'newListings' },
];

/** Kunlarda kutish: navbatdagi son emas, yosh muhim. */
const daysWaiting = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

export default function AdminHomePage() {
  const t = useTranslations('admin');
  const th = useTranslations('admin.home');
  const tc = useTranslations('admin.common');
  const ta = useTranslations('admin.audit');
  const locale = useLocale();
  const [health, setHealth] = useState<Health | null>(null);
  const [feed, setFeed] = useState<AuditRow[] | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const actionText = useActionText();

  useEffect(() => {
    // full=1: navbat yoshi faqat shu sahifaga kerak, panelning boshqa ekranlari uni so'ramaydi
    api<Health>('/admin/health?full=1').then(setHealth).catch(setErr);
    // Tasma yiqilsa sahifa buzilmasin: navbat muhimroq
    api<{ items: AuditRow[] }>('/admin/audit?limit=8').then((r) => setFeed(r.items)).catch(() => setFeed([]));
  }, []);

  const total = health ? Object.values(health.counts).reduce((a, b) => a + b, 0) : 0;
  // Eng uzoq kutgan ish qaysi navbatda bo'lsa ham, uning yoshi sarlavhada turadi
  const waited = health?.oldest
    ? Math.max(0, ...Object.values(health.oldest).filter((v): v is string => !!v).map(daysWaiting))
    : null;

  return (
    <>
      <PageHead title={t('title')} lead={th('lead')} />
      {err ? <Notice tone="err">{errText(err, t, t.has, tc('loadFailed'))}</Notice> : null}
      {/* Bir qism yiqilsa qolgani baribir ko'rsatiladi, lekin qaysi biri ekani aytiladi */}
      {health?.failed?.length ? <Notice tone="err">{tc('loadFailed')} ({health.failed.join(', ')})</Notice> : null}
      {!health && !err ? <p className="mt-5 text-sm text-muted">{tc('loading')}</p> : null}

      {health ? (
        <>
          {/* Navbat: har biri bosiladigan kartochka, bo'shi xira turadi */}
          <section className="mt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted">{th('queue')}</h2>
              {waited != null && waited >= 1 ? (
                <Pill tone={waited >= 3 ? 'bad' : 'warn'}>{th('waitingDays', { days: waited })}</Pill>
              ) : null}
            </div>

            {total === 0 ? (
              <p className={`${CARD} mt-2 border-dashed px-6 py-10 text-center text-sm text-muted`}>{th('queueEmpty')}</p>
            ) : (
              <ul className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {QUEUE.map(({ key, label, href }) => {
                  const n = health.counts[key];
                  const at = health.oldest?.[key];
                  const age = n && at ? daysWaiting(at) : null;
                  const body = (
                    <>
                      <span className={`font-display text-3xl font-bold tabular-nums ${n ? 'text-navy' : 'text-muted/50'}`}>{num(n, locale)}</span>
                      <span className={`mt-0.5 block text-sm ${n ? 'text-ink' : 'text-muted'}`}>{th(label)}</span>
                      {/* Yosh aynan shu navbatniki: qaysi biri unutilib qolganini son emas, kun aytadi */}
                      {age != null && age >= 1 ? <span className="mt-1 inline-block font-mono text-[11px] text-amber-ink">{th('queueDays', { days: age })}</span> : null}
                    </>
                  );
                  return (
                    <li key={key}>
                      {/* Bo'sh navbatga havola kerak emas: bosib borsa bo'sh ro'yxat ko'radi */}
                      {n ? (
                        <Link href={href} className={`${CARD} block p-4 transition duration-150 hover:-translate-y-0.5 hover:border-teal hover:shadow-md`}>{body}</Link>
                      ) : (
                        <div className={`${CARD} p-4`}>{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

          </section>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_minmax(0,320px)]">
            {/* Oxirgi amallar: panelda kim nima qilgani ko'rinib tursin */}
            <section className={`${CARD} min-w-0 p-4`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted">{th('activity')}</h2>
                <Link href="/admin/audit" className="text-xs font-semibold text-teal-ink underline">{t('nav.audit')}</Link>
              </div>
              {feed === null ? <p className="mt-3 text-sm text-muted">{tc('loading')}</p>
                : !feed.length ? <p className="mt-3 text-sm text-muted">{th('activityEmpty')}</p> : (
                  <ul className="mt-2 divide-y divide-line/70">
                    {feed.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5 text-sm">
                        {/* Avval kim, keyin nima qilgani: qator gap bo'lib o'qiladi */}
                        <span className="min-w-0 font-semibold wrap-anywhere">{r.actor ? r.actor.fullName || r.actor.phone : ta('system')}</span>
                        <span className="min-w-0 text-muted wrap-anywhere">{actionText(r.action, r.meta)}</span>
                        <span className="ml-auto shrink-0 font-mono text-[11px] text-muted">{uzDateTime(r.createdAt, locale)}</span>
                      </li>
                    ))}
                  </ul>
                )}
            </section>

            <section className={`${CARD} min-w-0 p-4`}>
              <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted">{th('health')}</h2>
              <p className="mt-2 text-sm">
                {th('db')}: {health.db.ok
                  ? <span className="font-mono text-teal-ink">{th('dbOk', { ms: health.db.ms ?? 0 })}</span>
                  : <span className="font-mono font-semibold text-red-700">{th('dbFail')}</span>}
              </p>
              <p className="mt-4 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted">{th('last24h')}</p>
              <dl className="mt-1 grid grid-cols-3 gap-2">
                {RECENT.map(({ key, label }) => (
                  <div key={key}>
                    <dd className="font-display text-2xl font-bold tabular-nums text-navy">{num(health.recent[key], locale)}</dd>
                    <dt className="text-xs text-muted">{th(label)}</dt>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </>
      ) : null}
    </>
  );
}
