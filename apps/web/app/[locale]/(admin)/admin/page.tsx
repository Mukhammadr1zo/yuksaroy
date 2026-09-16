'use client';
/**
 * Admin bosh sahifasi: bugun nima kutmoqda va tizim tirikmi.
 * Har navbat o'z bo'limiga havola, chunki bu yerda ish qilinmaydi, faqat qayerga borish hal qilinadi.
 */
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { num, uzDateTime } from '@/lib/format';
import { CARD, Notice, PageHead, errText } from '@/components/admin/kit';

type Health = {
  db: { ok: boolean; ms?: number; error?: string };
  counts: { listingsPendingReview: number; orgsPendingKyc: number; terminalClaimsPending: number; premiumPending: number; ordersPending: number };
  recent: { users: number; orders: number; listings: number };
  oldestPending: string | null;
  /** Yiqilgan so'rovlar nomi: bo'sh bo'lsa hammasi joyida. */
  failed?: string[];
};
type Overview = { users: number; blocked: number; orgs: number; terminals: number; sidings: number; listings: number; orders: number; inquiries: number; messages: number; reviews: number };

const QUEUE: { key: keyof Health['counts']; label: string; href: string }[] = [
  { key: 'listingsPendingReview', label: 'pendingListings', href: '/admin/moderation?tab=listings' },
  { key: 'orgsPendingKyc', label: 'pendingKyc', href: '/admin/moderation?tab=kyc' },
  { key: 'terminalClaimsPending', label: 'pendingClaims', href: '/admin/moderation?tab=claims' },
  { key: 'premiumPending', label: 'pendingPremium', href: '/admin/moderation?tab=premium' },
  { key: 'ordersPending', label: 'pendingOrders', href: '/admin/orders?status=PENDING' },
];
const OVERVIEW: (keyof Overview)[] = ['users', 'blocked', 'orgs', 'terminals', 'sidings', 'listings', 'orders', 'inquiries', 'messages', 'reviews'];
const RECENT: (keyof Health['recent'])[] = ['users', 'orders', 'listings'];
const RECENT_LABEL: Record<keyof Health['recent'], string> = { users: 'newUsers', orders: 'newOrders', listings: 'newListings' };

export default function AdminHomePage() {
  const t = useTranslations('admin');
  const th = useTranslations('admin.home');
  const to = useTranslations('admin.overview');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const [health, setHealth] = useState<Health | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => {
    api<Health>('/admin/health').then(setHealth).catch(setErr);
    // Umumiy raqamlar yiqilsa sahifa buzilmasin: navbat va salomatlik muhimroq
    api<Overview>('/admin/overview').then(setOverview).catch(() => {});
  }, []);

  const total = health ? Object.values(health.counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <>
      <PageHead title={t('title')} lead={th('lead')} />
      {err ? <Notice tone="err">{errText(err, t, t.has, tc('loadFailed'))}</Notice> : null}
      {!health && !err ? <p className="mt-5 text-sm text-muted">{tc('loading')}</p> : null}
      {/* Bir qism yiqilsa qolgani baribir ko'rsatiladi, lekin qaysi biri ekani aytiladi */}
      {health?.failed?.length ? <Notice tone="err">{tc('loadFailed')} ({health.failed.join(', ')})</Notice> : null}

      {health ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <section className={`${CARD} p-4`}>
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted">{th('queue')}</h2>
            {total === 0 ? <p className="mt-3 text-sm text-muted">{th('queueEmpty')}</p> : (
              <ul className="mt-2 divide-y divide-line/70">
                {QUEUE.map(({ key, label, href }) => {
                  const n = health.counts[key];
                  const inner = (
                    <>
                      <span className={`w-12 shrink-0 font-display text-2xl font-bold tabular-nums ${n ? 'text-navy' : 'text-muted'}`}>{num(n, locale)}</span>
                      <span className={`text-sm ${n ? 'text-ink' : 'text-muted'}`}>{th(label)}</span>
                    </>
                  );
                  return (
                    <li key={key}>
                      {/* Bo'sh navbatga havola kerak emas: bosib borsa bo'sh ro'yxat ko'radi */}
                      {n ? <Link href={href} className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors duration-150 hover:bg-sand">{inner}</Link>
                        : <div className="flex items-center gap-3 px-2 py-1.5">{inner}</div>}
                    </li>
                  );
                })}
              </ul>
            )}
            {health.oldestPending ? <p className="mt-3 text-xs text-muted">{th('oldestPending')}: <span className="font-mono">{uzDateTime(health.oldestPending, locale)}</span></p> : null}
          </section>

          <section className={`${CARD} p-4`}>
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted">{th('health')}</h2>
            <p className="mt-3 text-sm">
              {th('db')}: {health.db.ok
                ? <span className="font-mono text-teal-ink">{th('dbOk', { ms: health.db.ms ?? 0 })}</span>
                : <span className="font-mono font-semibold text-red-700">{th('dbFail')}</span>}
            </p>
            <p className="mt-4 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted">{th('last24h')}</p>
            <dl className="mt-1 grid grid-cols-3 gap-2">
              {RECENT.map((k) => (
                <div key={k}>
                  <dd className="font-display text-2xl font-bold tabular-nums text-navy">{num(health.recent[k], locale)}</dd>
                  <dt className="text-xs text-muted">{th(RECENT_LABEL[k])}</dt>
                </div>
              ))}
            </dl>
          </section>
        </div>
      ) : null}

      {overview ? (
        <dl className={`${CARD} mt-4 grid grid-cols-2 gap-x-3 gap-y-3 p-4 sm:grid-cols-5`}>
          {OVERVIEW.map((k) => (
            <div key={k}>
              <dd className={`font-display text-lg font-bold tabular-nums ${k === 'blocked' && overview[k] ? 'text-red-700' : 'text-navy'}`}>{num(overview[k], locale)}</dd>
              <dt className="font-mono text-[11px] uppercase tracking-wide text-muted">{to(k)}</dt>
            </div>
          ))}
        </dl>
      ) : null}
    </>
  );
}
