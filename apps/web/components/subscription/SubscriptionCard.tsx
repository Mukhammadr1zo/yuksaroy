'use client';
// Obuna: holat, buyurtma berish, to'lov ko'rsatmasi. Premium (e'lon uchun) bilan bir xil
// qo'lda to'lov yo'li: buyurtma PENDING, admin tasdiqlaydi, obuna ACTIVE bo'ladi.
// Kabinet (/dashboard/subscription) va Telegram Mini App (/tg/subscription) shu bitta kartani ko'rsatadi:
// api() ikkalasida ham o'z sessiyasini biladi (cookie yoki Bearer).
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircleIcon, LockSimpleOpenIcon } from '@phosphor-icons/react';
import { api, post } from '@/lib/api';
import { som, uzDate, uzDateTime } from '@/lib/format';
import { BTN_GHOST, BTN_PRIMARY, INPUT, Notice } from '@/components/kabinet/bits';
import { ConsentLine } from '@/components/site/ConsentLine';

type Pending = { id: string; no: string; months: number; amountTiyin: number; createdAt: string; payInstructions: { method: string; details: string } };
type Grant = 'PHONE' | 'WAGON';
type Plan = { grant: Grant; active: boolean; endsAt: string | null; pricePerMonthSom: number };
type Me = { active: boolean; endsAt: string | null; expired: { endsAt: string; reveals: number } | null; pricePerMonthSom: number; phoneRevealDaily: number; wagonSearchFree: number; plans: Plan[]; pending: Pending | null };
type Created = { order: { id: string; no: string; months: number; amountTiyin: number }; payInstructions: { details: string } };

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function SubscriptionCard() {
  const t = useTranslations('subscription');
  const locale = useLocale();
  const [me, setMe] = useState<Me | null>(null);
  const [failed, setFailed] = useState(false);
  const [months, setMonths] = useState(1);
  /** Bo'sh qator = to'liq obuna (ikkala ruxsat). 'WAGON' = faqat vagon qidiruvi. */
  const [plan, setPlan] = useState<'' | 'WAGON'>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  useEffect(() => { api<Me>('/subscription/me').then(setMe).catch(() => setFailed(true)); }, []);

  async function cancelOrder(id: string) {
    setBusy(true); setErr(false);
    try { setMe(await post<Me>(`/subscription/orders/${id}/cancel`, {})); setCreated(null); }
    catch {
      setErr(true);
      // Admin ayni damda tasdiqlagan bo'lishi mumkin: shunda kutilayotgan buyurtma yo'qoladi
      // va karta forma blokiga o'tadi, u yerdagi xato matni esa boshqa gap
      api<Me>('/subscription/me').then((m) => { setMe(m); setErr(!!m.pending); }).catch(() => {});
    } finally { setBusy(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(false);
    try { setCreated(await post<Created>('/subscription/orders', plan ? { months, grant: plan } : { months })); }
    catch { setErr(true); } finally { setBusy(false); }
  }

  if (failed) return <p role="alert" className="text-sm text-red-700">{t('loadFailed')}</p>;
  if (!me) return <p className="text-sm text-muted">{t('title')}</p>;

  // Kutilayotgan buyurtma: hozir yaratilgani yoki oldingi safar yaratilib to'lanmagani
  const pending = created
    ? { id: created.order.id, no: created.order.no, months: created.order.months, amountTiyin: created.order.amountTiyin, details: created.payInstructions.details }
    : me.pending ? { id: me.pending.id, no: me.pending.no, months: me.pending.months, amountTiyin: me.pending.amountTiyin, details: me.pending.payInstructions.details } : null;

  const wagonPlan = me.plans?.find((p) => p.grant === 'WAGON');
  /*
   * Vagon tarifi faqat u ARZONROQ bo'lganda taklif qilinadi.
   *
   * Narxlar teng bo'lsa alohida tarifning ma'nosi yo'q: odam bir xil pulga kamroq
   * narsa olardi. Admin narxni tushirgan kunda tanlov o'zi paydo bo'ladi, ya'ni
   * bayroq ham, deploy ham kerak emas.
   */
  const wagonCheaper = !!wagonPlan && wagonPlan.pricePerMonthSom < me.pricePerMonthSom;
  const perMonth = plan === 'WAGON' && wagonPlan ? wagonPlan.pricePerMonthSom : me.pricePerMonthSom;
  // Ruxsatlar bir xil bo'lsa ro'yxat chizilmaydi: bugungi obunachilarga u hech narsa bermaydi
  const mixed = (me.plans ?? []).some((p) => p.active !== me.plans[0]!.active || p.endsAt !== me.plans[0]!.endsAt);

  return (
    <>
      <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
      <p className="mt-1 max-w-2xl text-muted">{t('lead')}</p>
      {/* Uchta chegara: odam "to'laymanmi" degan qarorni aynan shu uch qator bilan qabul qiladi.
          Qamrov sanog'i (nechta terminal bor) bu yerda emas - u qarorga hech narsa bermaydi. */}
      <ul className="mt-3 max-w-md space-y-1.5 text-sm text-ink/85">
        <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" aria-hidden="true" />{t('limits.phones', { n: me.phoneRevealDaily })}</li>
        <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" aria-hidden="true" />{t('limits.wagon', { free: me.wagonSearchFree })}</li>
        <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" aria-hidden="true" />{t('limits.chat')}</li>
      </ul>

      <section className={`mt-6 flex items-center gap-3 rounded-card border p-5 ${me.active ? 'border-teal bg-teal-soft' : 'border-line bg-white'}`}>
        {me.active ? <CheckCircleIcon size={28} weight="fill" className="shrink-0 text-teal" aria-hidden="true" /> : <LockSimpleOpenIcon size={28} className="shrink-0 text-muted" aria-hidden="true" />}
        <div>
          <p className="font-semibold">{me.active ? t('active') : me.expired ? t('expiredTitle') : t('inactive')}</p>
          {me.active && me.endsAt ? <p className="font-mono text-sm text-muted">{t('activeUntil', { until: uzDateTime(me.endsAt, locale) })}</p> : null}
          {!me.active && me.expired ? (
            <p className="font-mono text-sm text-muted">
              {t('expiredOn', { date: uzDate(me.expired.endsAt, locale) })}
              {me.expired.reveals ? ` · ${t('expiredReveals', { count: me.expired.reveals })}` : ''}
            </p>
          ) : null}
        </div>
      </section>

      {mixed ? (
        <ul className="mt-3 max-w-md space-y-1 text-sm">
          {me.plans.map((p) => (
            <li key={p.grant} className="flex flex-wrap justify-between gap-2">
              <span className="text-muted">{t(`grant.${p.grant}`)}</span>
              <span className={`font-mono ${p.active ? 'font-semibold text-navy' : 'text-muted'}`}>
                {p.active && p.endsAt ? t('grantUntil', { until: uzDate(p.endsAt, locale) }) : t('grantOff')}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {pending ? (
        <section className="mt-6 max-w-md rounded-card border border-line bg-white p-5 text-sm">
          <Notice tone="ok">{t('pending')}</Notice>
          <dl className="mt-3 space-y-1">
            <div className="flex justify-between gap-4"><dt className="text-muted">{t('orderNo')}</dt><dd className="font-mono">{pending.no}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">{t('months')}</dt><dd className="font-mono">{t('month', { n: pending.months })}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">{t('amount')}</dt><dd className="font-mono font-semibold tabular-nums">{som(pending.amountTiyin, locale)}</dd></div>
          </dl>
          <p className="mt-3 text-xs font-semibold text-muted">{t('pay')}</p>
          <p className="mt-1 whitespace-pre-line rounded-xl bg-sand p-3">{pending.details}</p>
          <p className="mt-2 text-xs text-muted">{t('afterPay')}</p>
          {/* Muddatni o'zgartirishning yagona yo'li: ochiq buyurtma turganda forma chizilmaydi */}
          <p className="mt-3 text-xs text-muted">{t('cancelHint')}</p>
          {err ? <Notice tone="err">{t('cancelFailed')}</Notice> : null}
          <button type="button" disabled={busy} onClick={() => cancelOrder(pending.id)} className={`${BTN_GHOST} mt-2`}>
            {busy ? t('cancelling') : t('cancelOrder')}
          </button>
        </section>
      ) : (
        <form onSubmit={submit} className="mt-6 max-w-md space-y-4 rounded-card border border-line bg-white p-5">
          {wagonCheaper ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">{t('plan.label')}</legend>
              {([['', 'full', me.pricePerMonthSom], ['WAGON', 'wagon', wagonPlan!.pricePerMonthSom]] as const).map(([value, key, price]) => (
                <label key={key} className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${plan === value ? 'border-teal bg-teal-soft' : 'border-line'}`}>
                  <input
                    type="radio" name="plan" value={value} checked={plan === value}
                    onChange={() => setPlan(value)} className="mt-1"
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold text-navy">{t(`plan.${key}`)}</span>
                    <span className="block text-xs text-muted">{t(`plan.${key}Note`)}</span>
                    <span className="mt-1 block font-mono text-sm tabular-nums text-navy">{t('perMonth', { price: som(price * 100, locale) })}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}
          <label className="block text-sm font-semibold">{t('months')}
            <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className={`${INPUT} mt-1 font-mono`}>
              {MONTHS.map((n) => <option key={n} value={n}>{t('month', { n })}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-sand px-4 py-3">
            <span className="font-mono text-sm text-muted tabular-nums">{t('perMonth', { price: som(perMonth * 100, locale) })}</span>
            <span className="font-mono text-lg font-bold text-navy tabular-nums">{t('total')}: {som(months * perMonth * 100, locale)}</span>
          </div>
          {err ? <Notice tone="err">{t('failed')}</Notice> : null}
          <button type="submit" disabled={busy} className={BTN_PRIMARY}>{busy ? t('sending') : me.active || me.expired ? t('extend') : t('submit')}</button>
          <ConsentLine />
        </form>
      )}
    </>
  );
}
