'use client';
// So'rov tafsiloti: faktlar, takliflar, tanlash, yopish, ochiq holat havolasini Telegram orqali ulashish yoki nusxalash.
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ApiError, api, post } from '@/lib/api';
import { som, uzDateTime } from '@/lib/format';
import { asList, offerName, type UrgentRequest } from '@/lib/types-urgent';
import { OfferStatusPill, UrgentStatusPill, useUrgentLabels } from '@/components/kabinet/UrgentBits';
import { confirmTg, haptic, useTg } from '@/components/tg/TgProvider';
import { BTN, BTN_GHOST, CARD, Err, Row, Skeleton } from '@/components/tg/bits';

/** GET /urgent/:id yo'q: ro'yxatdan topiladi (kabinet bilan bir xil). */
async function loadOne(id: string): Promise<UrgentRequest | null> {
  try { return await api<UrgentRequest>(`/urgent/${id}`); }
  catch (e) { if (!(e instanceof ApiError && e.status === 404)) throw e; }
  return asList<UrgentRequest>(await api<unknown>('/urgent?scope=mine')).find((r) => r.id === id) ?? null;
}

export default function TgUrgentDetail() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('urgent.detail');
  const locale = useLocale();
  const tu = useTranslations('tg.urgent');
  const tc = useTranslations('tg.common');
  const { tg } = useTg();
  const L = useUrgentLabels();
  const [r, setR] = useState<UrgentRequest | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = () => loadOne(id).then(setR).catch(() => { setErr(tc('loadFailed')); setR(null); });
  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(what: 'award' | 'close', offerId?: string) {
    if (what === 'close' && !(await confirmTg(tg, t('confirmClose')))) return;
    setBusy(offerId ?? what); setErr(null);
    try { await post(`/urgent/${id}/${what}`, offerId ? { offerId } : {}); haptic('medium'); await load(); }
    catch { setErr(tc('failed')); } finally { setBusy(null); }
  }
  const url = r?.statusUrl ?? (r?.statusToken ? `${window.location.origin}/status/${r.statusToken}` : null);
  const share = () => { if (!url || !r) return; haptic(); tg?.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(tu('shareText', { no: r.no }))}`); };
  const copy = async () => { if (!url) return; try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { /* clipboard yo'q */ } };

  if (r === undefined) return <main className="mx-auto max-w-md px-4 pt-4"><Skeleton /></main>;
  if (!r) return <main className="mx-auto max-w-md px-4 py-10 text-center text-sm text-muted">{err ?? tu('notFound')}</main>;
  const offers = r.offers ?? [];
  const canClose = r.status === 'OPEN' || r.status === 'AWARDED';

  return (
    <main className="mx-auto max-w-md px-4 pb-8 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-xl font-bold">{r.no}</h1>
        <span className="rounded-full bg-teal-soft px-3 py-1 text-xs font-semibold text-teal-ink">{L.kind[r.kind] ?? r.kind}</span>
        <UrgentStatusPill status={r.status} />
      </div>
      {err ? <div className="mt-3"><Err>{err}</Err></div> : null}
      {r.status === 'AWARDED' ? <p className="mt-3 rounded-card border border-teal/30 bg-teal-soft px-4 py-3 text-sm text-teal-ink">{t('awardedNote')}</p> : null}

      <section className={`${CARD} mt-4 p-4`}>
        <dl>
          <Row k={t('region')} v={L.region(r.regionCode)} />
          {r.stationName ? <Row k={t('station')} v={r.stationName} /> : null}
          {r.wagonCount != null ? <Row k={t('wagons')} v={String(r.wagonCount)} mono /> : null}
          <Row k={t('phone')} v={r.contactPhone} mono />
          <Row k={t('created')} v={uzDateTime(r.createdAt, locale)} mono />
        </dl>
        <p className="mt-2 whitespace-pre-line text-sm">{r.description}</p>
      </section>

      {url ? (
        <section className={`${CARD} mt-3 p-4`}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('statusLink')}</h2>
          <p className="mt-1 text-xs text-muted">{t('statusLinkHint')}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={share} className={BTN}>{tu('share')}</button>
            <button type="button" onClick={copy} className={BTN_GHOST}>{copied ? tc('copied') : tc('copy')}</button>
          </div>
        </section>
      ) : null}

      <section className="mt-5">
        <h2 className="text-sm font-bold">{t('offers')} <span className="font-mono text-muted">{offers.length}</span></h2>
        {offers.length === 0 ? <p className="mt-2 rounded-card border border-dashed border-line p-4 text-sm text-muted">{t('noOffers')}</p> : null}
        <ul className="mt-2 space-y-2">
          {offers.map((o) => (
            <li key={o.id} className={`${CARD} p-3 ${o.status === 'AWARDED' ? 'border-teal' : ''}`}>
              <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{offerName(o) ?? '·'}</span><OfferStatusPill status={o.status} /><span className="ml-auto font-mono text-xs text-muted">{uzDateTime(o.createdAt, locale)}</span></div>
              <p className="mt-1 font-mono text-sm text-navy tabular-nums">{o.priceTiyin != null ? som(o.priceTiyin, locale) : t('onRequest')}{o.etaMinutes != null ? ` · ${t('eta', { min: o.etaMinutes })}` : ''}</p>
              {o.message ? <p className="mt-1 whitespace-pre-line text-sm">{o.message}</p> : null}
              {r.status === 'OPEN' && o.status === 'SENT' ? <button type="button" onClick={() => act('award', o.id)} disabled={busy !== null} className={`${BTN} mt-2`}>{busy === o.id ? t('awarding') : t('award')}</button> : null}
            </li>
          ))}
        </ul>
      </section>

      {canClose ? <button type="button" onClick={() => act('close')} disabled={busy !== null} className={`${BTN_GHOST} mt-5`}>{busy === 'close' ? t('closing') : t('close')}</button> : null}
    </main>
  );
}
