'use client';
// Taklif formasi: narx so'mda (tiyinga aylanadi) va izoh. Mehmonga kirish havolasi, bergan odamga o'z taklifi.
// preview: namuna so'rovda forma o'chirilgan holda ko'rsatiladi, serverga hech narsa ketmaydi. Namunaning maqsadi
// sahifa qanday ko'rinishini ko'rsatish, eng muhim qismi (qanday taklif beriladi) yashirin qolmasin.
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ApiError, hasSession, post } from '@/lib/api';
import { regionRouteKm } from '@yuksaroy/domain';
import { som, somPerKm, uzDateTime } from '@/lib/format';
import type { MarketOffer, MarketRequest } from '@/lib/types-market';
import { BTN_NAVY, Field, INPUT, Notice } from '@/components/kabinet/bits';
import { OfferStatusPill } from './bits';

export function OfferForm({ request, next, preview = false, me = null }: {
  request: MarketRequest; next: string; preview?: boolean;
  /** Brauzerda o'qilgan so'rov: o'z taklifim va "bu mening so'rovim" shundan. Ota komponent beradi. */
  me?: MarketRequest | null;
}) {
  const t = useTranslations('market.offer');
  const te = useTranslations('market.err');
  const locale = useLocale();
  const [authed, setAuthed] = useState<boolean | null>(null);
  // Yuborilgan taklif shu yerda qoladi, qolgani ota komponentdan keladi
  const [sent, setSent] = useState<MarketOffer | null>(null);
  const mine = sent ?? me?.myOffer ?? null;
  const own = !!me?.offers;
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);
  /**
   * Yo'l uzunligi viloyat markazlaridan. Narx yozilganda maslahat satri so'm/km ga aylanadi:
   * tashuvchi o'z narxini odatdagi km narxi bilan solishtira oladi. Xizmat so'rovida yo'nalish
   * yo'q, shuning uchun null bo'ladi va hech narsa ko'rsatilmaydi.
   */
  const routeKm = regionRouteKm(request.fromRegion, request.toRegion);
  const priceNum = Number(price);
  const perKm = routeKm != null && Number.isFinite(priceNum) && priceNum > 0 ? somPerKm(priceNum * 100, routeKm, locale) : null;

  useEffect(() => { if (!preview) setAuthed(hasSession()); }, [preview]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const o = await post<MarketOffer>(`/market/requests/${request.id}/offers`, {
        priceTiyin: price ? Math.round(Number(price) * 100) : undefined,
        message: message.trim() || undefined,
      });
      setSent(o); setJustSent(true);
    } catch (e) {
      const code = e instanceof ApiError ? String(e.body?.code ?? '') : '';
      setErr(code && t.has(code) ? code : code === 'RATE_LIMITED' ? 'RATE_LIMITED' : 'generic');
    } finally { setBusy(false); }
  }

  if (preview) {
    return (
      <fieldset disabled className="grid gap-3 opacity-70" aria-label={t('price')}>
        <Field label={t('price')} hint={t('priceHint')}><input className={`${INPUT} font-mono`} type="number" inputMode="numeric" readOnly /></Field>
        <Field label={t('message')}><textarea className={INPUT} rows={3} placeholder={t('messagePh')} readOnly /></Field>
        <div><button type="button" className={BTN_NAVY}>{t('send')}</button></div>
      </fieldset>
    );
  }
  if (authed === null) return null;
  if (!authed) return <Notice tone="warn">{t('loginNeeded')} <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold underline underline-offset-4">{t('loginCta')}</Link></Notice>;
  if (own) return <Notice tone="warn">{t('OWN_REQUEST')}</Notice>;
  if (mine) {
    return (
      <div className="rounded-card border border-teal bg-teal-soft/40 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{t('mine')}</span><OfferStatusPill status={mine.status} /><span className="ml-auto font-mono text-xs text-muted">{uzDateTime(mine.createdAt, locale)}</span></div>
        <p className="mt-1 font-mono text-navy tabular-nums">
          {mine.priceTiyin != null ? som(mine.priceTiyin, locale) : t('onRequest')}
          {mine.priceTiyin != null && routeKm != null ? ` · ${somPerKm(mine.priceTiyin, routeKm, locale)}` : ''}
        </p>
        {mine.message ? <p className="mt-1 whitespace-pre-line text-ink/85">{mine.message}</p> : null}
        {justSent ? <p className="mt-2 text-teal-ink">{t('sent')}. {t('sentBody')}</p> : null}
      </div>
    );
  }
  if (request.status !== 'OPEN') return <Notice tone="warn">{t('REQUEST_NOT_OPEN')}</Notice>;

  return (
    <form onSubmit={send} className="grid gap-3">
      {/* Maslahat slotining o'zi ishlatiladi: narx yozilishi bilan so'm/km chiqadi, bo'shatilsa eski matn qaytadi */}
      <Field label={t('price')} hint={perKm ?? t('priceHint')}>
        <input className={`${INPUT} font-mono`} type="number" min={0} step={1000} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
      </Field>
      <Field label={t('message')}>
        <textarea className={INPUT} rows={3} maxLength={1000} placeholder={t('messagePh')} value={message} onChange={(e) => setMessage(e.target.value)} />
      </Field>
      {err ? (
        <Notice tone="err">
          {err === 'generic' || err === 'RATE_LIMITED' ? te(err) : t(err)}
          {err === 'NOT_PROVIDER' ? <> <Link href="/dashboard/market?tab=profile" className="font-semibold underline underline-offset-4">{t('NOT_PROVIDER_CTA')}</Link></> : null}
        </Notice>
      ) : null}
      <div><button type="submit" disabled={busy} className={BTN_NAVY}>{busy ? t('sending') : t('send')}</button></div>
    </form>
  );
}
