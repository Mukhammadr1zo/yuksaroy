'use client';
// So'rov tafsiloti: faktlar, ochiq holat havolasi (nusxalash), takliflar, tanlash (award), yopish (close).
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ApiError, api, post } from '@/lib/api';
import { som, uzDateTime } from '@/lib/format';
import { asList, offerName, type UrgentRequest } from '@/lib/types-urgent';
import { BTN_GHOST, BTN_NAVY, Notice } from '@/components/kabinet/bits';
import { OfferStatusPill, UrgentStatusPill, useUrgentLabels } from '@/components/kabinet/UrgentBits';

/** GET /urgent/:id bo'lmasa (shartnomada alohida tafsilot yo'li yo'q) ro'yxatdan topiladi. */
async function loadOne(id: string): Promise<UrgentRequest | null> {
  try { return await api<UrgentRequest>(`/urgent/${id}`); }
  catch (e) { if (!(e instanceof ApiError && e.status === 404)) throw e; }
  return asList<UrgentRequest>(await api<unknown>('/urgent?scope=mine')).find((r) => r.id === id) ?? null;
}

export default function UrgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('urgent.detail');
  const locale = useLocale();
  const tc = useTranslations('kabinet.common');
  const L = useUrgentLabels();
  const [r, setR] = useState<UrgentRequest | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');

  const load = () => loadOne(id).then(setR).catch(() => { setErr(tc('loadFailed')); setR(null); });
  useEffect(() => { void load(); setOrigin(window.location.origin); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(what: 'award' | 'close', offerId?: string) {
    if (what === 'close' && !window.confirm(t('confirmClose'))) return;
    setBusy(offerId ?? what); setErr(null);
    try { await post(`/urgent/${id}/${what}`, offerId ? { offerId } : {}); await load(); }
    catch { setErr(tc('failed')); } finally { setBusy(null); }
  }
  async function copy(url: string) {
    // Clipboard bo'lmasa (http, eski brauzer) input fokusda tanlanadi, qo'lda nusxalash mumkin
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
  }

  if (r === undefined) return <div className="mx-auto max-w-4xl px-6 py-10 text-sm text-muted">{tc('loading')}</div>;
  if (!r) return <div className="mx-auto max-w-4xl"><Notice tone="err">{err ?? t('notFound')}</Notice><Link href="/dashboard/urgent" className={`${BTN_GHOST} mt-4 inline-block`}>{t('back')}</Link></div>;

  const url = r.statusUrl ?? (r.statusToken && origin ? `${origin}/status/${r.statusToken}` : null);
  const offers = r.offers ?? [];
  const canClose = r.status === 'OPEN' || r.status === 'AWARDED';
  const facts: [string, string][] = [
    [t('region'), L.region(r.regionCode)],
    [t('station'), r.stationName ?? '·'],
    [t('wagons'), r.wagonCount != null ? String(r.wagonCount) : '·'],
    [t('phone'), r.contactPhone],
    [t('created'), uzDateTime(r.createdAt, locale)],
  ];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/dashboard/urgent" className="text-sm font-semibold text-teal-ink hover:text-navy">{t('back')}</Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold">{r.no}</h1>
        <span className="rounded-full bg-teal-soft px-3 py-1 text-xs font-semibold text-teal-ink">{L.kind[r.kind] ?? r.kind}</span>
        <UrgentStatusPill status={r.status} />
        {canClose ? <button type="button" onClick={() => act('close')} disabled={busy !== null} className={`${BTN_GHOST} ml-auto`}>{busy === 'close' ? t('closing') : t('close')}</button> : null}
      </div>
      {err ? <div className="mt-4"><Notice tone="err">{err}</Notice></div> : null}
      {r.status === 'AWARDED' ? <div className="mt-4"><Notice tone="ok">{t('awardedNote')}</Notice></div> : null}

      <dl className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {facts.map(([k, v]) => <div key={k} className="rounded-card border border-line bg-white px-4 py-3"><dt className="text-xs text-muted">{k}</dt><dd className="mt-1 break-words font-mono text-sm font-semibold">{v}</dd></div>)}
      </dl>
      <section className="mt-4 rounded-card border border-line bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('description')}</h2>
        <p className="mt-2 whitespace-pre-line text-sm">{r.description}</p>
      </section>

      {url ? (
        <section className="mt-4 rounded-card border border-line bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('statusLink')}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-xl border border-line bg-sand px-3 py-2 font-mono text-xs" />
            <button type="button" onClick={() => copy(url)} className={BTN_NAVY}>{copied ? t('copied') : t('copy')}</button>
          </div>
          <p className="mt-1 text-xs text-muted">{t('statusLinkHint')}</p>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg font-bold">{t('offers')} <span className="font-mono text-sm text-muted">{offers.length}</span></h2>
        {offers.length === 0 ? <p className="mt-2 rounded-card border border-dashed border-line bg-white p-6 text-sm text-muted">{t('noOffers')}</p> : null}
        <ul className="mt-3 space-y-2">
          {offers.map((o) => (
            <li key={o.id} className={`rounded-card border bg-white p-4 ${o.status === 'AWARDED' ? 'border-teal' : 'border-line'}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold">{offerName(o) ?? '·'}</span>
                <OfferStatusPill status={o.status} />
                <span className="ml-auto font-mono text-xs text-muted">{uzDateTime(o.createdAt, locale)}</span>
              </div>
              <p className="mt-2 font-mono text-sm text-navy tabular-nums">
                {o.priceTiyin != null ? som(o.priceTiyin, locale) : t('onRequest')}{o.etaMinutes != null ? ` · ${t('eta', { min: o.etaMinutes })}` : ''}
              </p>
              {o.message ? <p className="mt-1 whitespace-pre-line text-sm text-ink/85">{o.message}</p> : null}
              {r.status === 'OPEN' && o.status === 'SENT' ? (
                <button type="button" onClick={() => act('award', o.id)} disabled={busy !== null} className={`${BTN_NAVY} mt-3`}>{busy === o.id ? t('awarding') : t('award')}</button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
