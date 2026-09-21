'use client';
// Obuna: holat, buyurtma berish, to'lov ko'rsatmasi. Premium (e'lon uchun) bilan bir xil
// qo'lda to'lov yo'li: buyurtma PENDING, admin tasdiqlaydi, obuna ACTIVE bo'ladi.
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircleIcon, LockSimpleOpenIcon } from '@phosphor-icons/react';
import { api, post } from '@/lib/api';
import { som, uzDateTime } from '@/lib/format';
import { BTN_PRIMARY, INPUT, Notice } from '@/components/kabinet/bits';

type Pending = { id: string; months: number; amountTiyin: number; createdAt: string; payInstructions: { method: string; details: string } };
type Me = { active: boolean; endsAt: string | null; pricePerMonthSom: number; pending: Pending | null };
type Created = { order: { id: string; months: number; amountTiyin: number }; payInstructions: { details: string } };

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function SubscriptionPage() {
  const t = useTranslations('subscription');
  const locale = useLocale();
  const [me, setMe] = useState<Me | null>(null);
  const [failed, setFailed] = useState(false);
  const [months, setMonths] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  useEffect(() => { api<Me>('/subscription/me').then(setMe).catch(() => setFailed(true)); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(false);
    try { setCreated(await post<Created>('/subscription/orders', { months })); }
    catch { setErr(true); } finally { setBusy(false); }
  }

  if (failed) return <p role="alert" className="text-sm text-red-700">{t('loadFailed')}</p>;
  if (!me) return <p className="text-sm text-muted">{t('title')}</p>;

  // Kutilayotgan buyurtma: hozir yaratilgani yoki oldingi safar yaratilib to'lanmagani
  const pending = created
    ? { id: created.order.id, months: created.order.months, amountTiyin: created.order.amountTiyin, details: created.payInstructions.details }
    : me.pending ? { id: me.pending.id, months: me.pending.months, amountTiyin: me.pending.amountTiyin, details: me.pending.payInstructions.details } : null;

  return (
    <>
      <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
      <p className="mt-1 max-w-2xl text-muted">{t('lead')}</p>

      <section className={`mt-6 flex items-center gap-3 rounded-card border p-5 ${me.active ? 'border-teal bg-teal-soft' : 'border-line bg-white'}`}>
        {me.active ? <CheckCircleIcon size={28} weight="fill" className="shrink-0 text-teal" aria-hidden="true" /> : <LockSimpleOpenIcon size={28} className="shrink-0 text-muted" aria-hidden="true" />}
        <div>
          <p className="font-semibold">{me.active ? t('active') : t('inactive')}</p>
          {me.active && me.endsAt ? <p className="font-mono text-sm text-muted">{t('activeUntil', { until: uzDateTime(me.endsAt, locale) })}</p> : null}
        </div>
      </section>

      {pending ? (
        <section className="mt-6 max-w-md rounded-card border border-line bg-white p-5 text-sm">
          <Notice tone="ok">{t('pending')}</Notice>
          <dl className="mt-3 space-y-1">
            <div className="flex justify-between gap-4"><dt className="text-muted">{t('orderNo')}</dt><dd className="font-mono">{pending.id}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">{t('months')}</dt><dd className="font-mono">{t('month', { n: pending.months })}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">{t('amount')}</dt><dd className="font-mono font-semibold tabular-nums">{som(pending.amountTiyin, locale)}</dd></div>
          </dl>
          <p className="mt-3 text-xs font-semibold text-muted">{t('pay')}</p>
          <p className="mt-1 whitespace-pre-line rounded-xl bg-sand p-3">{pending.details}</p>
          <p className="mt-2 text-xs text-muted">{t('afterPay')}</p>
        </section>
      ) : (
        <form onSubmit={submit} className="mt-6 max-w-md space-y-4 rounded-card border border-line bg-white p-5">
          <label className="block text-sm font-semibold">{t('months')}
            <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className={`${INPUT} mt-1 font-mono`}>
              {MONTHS.map((n) => <option key={n} value={n}>{t('month', { n })}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-sand px-4 py-3">
            <span className="font-mono text-sm text-muted tabular-nums">{t('perMonth', { price: som(me.pricePerMonthSom * 100, locale) })}</span>
            <span className="font-mono text-lg font-bold text-navy tabular-nums">{t('total')}: {som(months * me.pricePerMonthSom * 100, locale)}</span>
          </div>
          {err ? <Notice tone="err">{t('failed')}</Notice> : null}
          <button type="submit" disabled={busy} className={BTN_PRIMARY}>{busy ? t('sending') : me.active ? t('extend') : t('submit')}</button>
        </form>
      )}
    </>
  );
}
