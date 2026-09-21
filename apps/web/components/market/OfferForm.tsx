'use client';
// Taklif formasi: narx so'mda (tiyinga aylanadi) va izoh. Mehmonga kirish havolasi, bergan odamga o'z taklifi.
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ApiError, api, hasSession, post } from '@/lib/api';
import { som, uzDateTime } from '@/lib/format';
import type { MarketOffer, MarketRequest } from '@/lib/types-market';
import { BTN_NAVY, Field, INPUT, Notice } from '@/components/kabinet/bits';
import { OfferStatusPill } from './bits';

export function OfferForm({ request, next }: { request: MarketRequest; next: string }) {
  const t = useTranslations('market.offer');
  const te = useTranslations('market.err');
  const locale = useLocale();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [mine, setMine] = useState<MarketOffer | null>(request.myOffer ?? null);
  const [own, setOwn] = useState(false);
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);

  // Sahifa keshlangan va cookie'siz: o'z taklifim va "bu mening so'rovim" faqat brauzerda ma'lum bo'ladi
  useEffect(() => {
    if (!hasSession()) { setAuthed(false); return; }
    setAuthed(true);
    api<MarketRequest>(`/market/requests/${encodeURIComponent(request.no)}`)
      .then((r) => { if (r.offers) setOwn(true); if (r.myOffer) setMine(r.myOffer); })
      .catch(() => {});
  }, [request.no]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const o = await post<MarketOffer>(`/market/requests/${request.id}/offers`, {
        priceTiyin: price ? Math.round(Number(price) * 100) : undefined,
        message: message.trim() || undefined,
      });
      setMine(o); setJustSent(true);
    } catch (e) {
      const code = e instanceof ApiError ? String(e.body?.code ?? '') : '';
      setErr(code && t.has(code) ? code : code === 'RATE_LIMITED' ? 'RATE_LIMITED' : 'generic');
    } finally { setBusy(false); }
  }

  if (authed === null) return null;
  if (!authed) return <Notice tone="warn">{t('loginNeeded')} <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold underline underline-offset-4">{t('loginCta')}</Link></Notice>;
  if (own) return <Notice tone="warn">{t('OWN_REQUEST')}</Notice>;
  if (mine) {
    return (
      <div className="rounded-card border border-teal bg-teal-soft/40 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{t('mine')}</span><OfferStatusPill status={mine.status} /><span className="ml-auto font-mono text-xs text-muted">{uzDateTime(mine.createdAt, locale)}</span></div>
        <p className="mt-1 font-mono text-navy tabular-nums">{mine.priceTiyin != null ? som(mine.priceTiyin, locale) : t('onRequest')}</p>
        {mine.message ? <p className="mt-1 whitespace-pre-line text-ink/85">{mine.message}</p> : null}
        {justSent ? <p className="mt-2 text-teal-ink">{t('sent')}. {t('sentBody')}</p> : null}
      </div>
    );
  }
  if (request.status !== 'OPEN') return <Notice tone="warn">{t('REQUEST_NOT_OPEN')}</Notice>;

  return (
    <form onSubmit={send} className="grid gap-3">
      <Field label={t('price')} hint={t('priceHint')}>
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
